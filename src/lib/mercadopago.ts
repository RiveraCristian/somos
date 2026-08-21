import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

/**
 * Cliente de Mercado Pago (Checkout Bricks + Payments API).
 *
 * Se usa `fetch` contra la API en vez del SDK oficial: son dos endpoints y una
 * firma HMAC, y asi no se arrastra una dependencia mas de servidor.
 *
 * Docs: https://www.mercadopago.cl/developers/es/docs/checkout-bricks
 */

const API = 'https://api.mercadopago.com';

/** Estados que devuelve la API de pagos. */
export type EstadoPagoMp =
  | 'approved'
  | 'authorized'
  | 'in_process'
  | 'in_mediation'
  | 'pending'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back';

export type PagoMp = {
  id: number | string;
  status: EstadoPagoMp;
  status_detail?: string;
  transaction_amount?: number;
  payment_method_id?: string;
  payment_type_id?: string;
  external_reference?: string | null;
  live_mode?: boolean;
};

/**
 * Mercado Pago solo se activa con las dos credenciales: el access token cobra
 * desde el servidor y la llave publica monta el formulario en el navegador.
 */
export function mercadoPagoHabilitado(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN && process.env.MERCADOPAGO_PUBLIC_KEY);
}

/**
 * Llave publica, para pasarsela al Brick.
 *
 * Se lee en el servidor y viaja como prop en vez de usar NEXT_PUBLIC_: esas se
 * incrustan al compilar, y aca la configuracion se carga desde .env al arrancar.
 */
export function clavePublicaMercadoPago(): string {
  return process.env.MERCADOPAGO_PUBLIC_KEY ?? '';
}

function token(): string {
  const valor = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!valor) throw new Error('MERCADOPAGO_ACCESS_TOKEN no esta configurado.');
  return valor;
}

/**
 * Cobra el pago que armó el Brick.
 *
 * `datosFormulario` es tal cual lo que entrega `onSubmit` del Brick: trae el
 * token de la tarjeta, el medio de pago, las cuotas y el pagador. No se
 * reconstruye a mano, solo se le agrega el monto y la referencia desde el
 * servidor — el monto NUNCA se toma del navegador.
 */
export async function cobrarConMercadoPago(datos: {
  datosFormulario: Record<string, unknown>;
  monto: number;
  descripcion: string;
  referenciaExterna: string;
  correo: string;
}): Promise<PagoMp> {
  const cuerpo = {
    ...datos.datosFormulario,
    // El monto y la referencia se fijan en el servidor: si vinieran del cliente,
    // cualquiera podria pagar $1 por una entrada de $12.000.
    transaction_amount: datos.monto,
    description: datos.descripcion,
    external_reference: datos.referenciaExterna,
    statement_descriptor: 'SOMOS',
  };

  const respuesta = await fetch(`${API}/v1/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      // Evita cobrar dos veces si la peticion se reintenta.
      'X-Idempotency-Key': randomUUID(),
    },
    body: JSON.stringify(cuerpo),
    cache: 'no-store',
  });

  const texto = await respuesta.text();

  if (!respuesta.ok) {
    throw new Error(`Mercado Pago respondio ${respuesta.status}: ${texto.slice(0, 400)}`);
  }

  return JSON.parse(texto) as PagoMp;
}

/** Consulta el estado de un pago. Sirve para reconciliar y para el webhook. */
export async function obtenerPagoMercadoPago(id: string): Promise<PagoMp | null> {
  try {
    const respuesta = await fetch(`${API}/v1/payments/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token()}` },
      cache: 'no-store',
    });
    if (!respuesta.ok) return null;
    return (await respuesta.json()) as PagoMp;
  } catch {
    return null;
  }
}

/** ¿El cobro quedo efectivamente hecho? */
export function pagoAprobado(pago: PagoMp): boolean {
  return pago.status === 'approved' || pago.status === 'authorized';
}

/** ¿El cobro murio y no va a completarse? */
export function pagoFallido(pago: PagoMp): boolean {
  return pago.status === 'rejected' || pago.status === 'cancelled';
}

/**
 * Valida la firma del webhook de Mercado Pago.
 *
 * El header `x-signature` viene como `ts=<unix>,v1=<hmac hex>`, y el HMAC-SHA256
 * se calcula sobre el manifiesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * con el secreto del webhook.
 *
 * Ojo: se firma el id del recurso, no el cuerpo. Por eso hay que pasarle el
 * `data.id` que llego (por query o por body) y el header `x-request-id`.
 */
export function validarFirmaWebhookMp(datos: {
  idRecurso: string;
  cabeceraFirma: string | null;
  cabeceraRequestId: string | null;
}): boolean {
  const secreto = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secreto || !datos.cabeceraFirma || !datos.idRecurso) return false;

  const partes = Object.fromEntries(
    datos.cabeceraFirma.split(',').map((trozo) => {
      const [llave, ...resto] = trozo.trim().split('=');
      return [llave, resto.join('=')];
    }),
  );

  const marca = partes.ts;
  const firma = partes.v1;
  if (!marca || !firma) return false;

  // Mercado Pago pide el id en minusculas cuando es alfanumerico.
  const id = datos.idRecurso.toLowerCase();
  const manifiesto = `id:${id};request-id:${datos.cabeceraRequestId ?? ''};ts:${marca};`;

  const esperada = createHmac('sha256', secreto).update(manifiesto).digest('hex');

  const a = Buffer.from(esperada, 'utf8');
  const b = Buffer.from(firma, 'utf8');
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export type DiagnosticoMp =
  | { ok: true; cuenta: string; modo: 'prueba' | 'produccion' }
  | { ok: false; problema: string };

/**
 * Pregunta a Mercado Pago si el access token sirve, y de que cuenta es.
 *
 * Existe porque el sintoma de una credencial mala es que "el pago no aparece",
 * que no le dice nada a nadie. Aca se distingue entre token invalido, token de
 * otra cuenta y un problema de red.
 */
export async function verificarCredencialesMp(): Promise<DiagnosticoMp> {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return { ok: false, problema: 'Falta MERCADOPAGO_ACCESS_TOKEN.' };
  }
  if (!process.env.MERCADOPAGO_PUBLIC_KEY) {
    return { ok: false, problema: 'Falta MERCADOPAGO_PUBLIC_KEY.' };
  }

  const llave = process.env.MERCADOPAGO_ACCESS_TOKEN;

  // Las credenciales de prueba y las de produccion se distinguen por prefijo.
  // Vale la pena mostrarlo: cobrar de verdad creyendo que estas en pruebas, o
  // al reves, son los dos errores caros de esta integracion.
  const modo: 'prueba' | 'produccion' = llave.startsWith('TEST-') ? 'prueba' : 'produccion';

  if (!llave.startsWith('TEST-') && !llave.startsWith('APP_USR-')) {
    return {
      ok: false,
      problema:
        'Ese valor no parece un access token: los de Mercado Pago empiezan con TEST- o APP_USR-. ' +
        'Si copiaste un usuario, una contrasena o un User ID, no sirven — el token esta en ' +
        'Tus integraciones > tu aplicacion > Credenciales.',
    };
  }

  try {
    const respuesta = await fetch(`${API}/users/me`, {
      headers: { Authorization: `Bearer ${llave}` },
      cache: 'no-store',
    });

    if (respuesta.status === 401 || respuesta.status === 403) {
      return { ok: false, problema: 'Mercado Pago rechazo el access token (no es valido o expiro).' };
    }

    if (!respuesta.ok) {
      return { ok: false, problema: `Mercado Pago respondio ${respuesta.status} al verificar.` };
    }

    const datos = (await respuesta.json()) as {
      id?: number;
      nickname?: string;
      email?: string;
      site_id?: string;
    };

    const cuenta = [datos.nickname ?? datos.email ?? 'cuenta sin nombre', datos.id ? `#${datos.id}` : '']
      .filter(Boolean)
      .join(' ');

    if (datos.site_id && datos.site_id !== 'MLC') {
      return {
        ok: false,
        problema: `Esa cuenta es de ${datos.site_id}, no de Chile (MLC). Los cobros en pesos chilenos van a fallar.`,
      };
    }

    return { ok: true, cuenta, modo };
  } catch (e) {
    return {
      ok: false,
      problema: `No se pudo contactar a Mercado Pago: ${e instanceof Error ? e.message : 'error de red'}.`,
    };
  }
}
