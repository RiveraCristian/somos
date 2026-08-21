import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Cliente de Fintoc (iniciacion de pagos por transferencia).
 *
 * Se usa `fetch` contra la API v2 en vez del SDK oficial: son dos endpoints y
 * una firma HMAC, y asi no se arrastra una dependencia mas ni se depende de la
 * forma exacta de su envoltorio.
 *
 * Docs: https://docs.fintoc.com/api/payments-api/checkout-sessions
 */

const API = 'https://api.fintoc.com/v2';

/** Fintoc solo acepta URLs de retorno con HTTPS. */
const esHttps = (url?: string) => Boolean(url && url.startsWith('https://'));

/** Tolerancia del timestamp de la firma, para frenar reenvios viejos. */
const VENTANA_FIRMA_SEG = 5 * 60;

export type EstadoSesion = 'created' | 'in_progress' | 'finished' | 'expired';

export type SesionCheckout = {
  id: string;
  object: string;
  status: EstadoSesion;
  mode: 'test' | 'live';
  amount: number | null;
  currency: string;
  customer_email: string | null;
  redirect_url: string | null;
  session_token: string | null;
  metadata: Record<string, string> | null;
  payment_resource: {
    payment_intent?: { id: string; status: string } | null;
  } | null;
};

/**
 * Fintoc solo se activa con las dos llaves: la secreta crea la sesion en el
 * servidor y la publica monta el widget en el navegador.
 */
export function fintocHabilitado(): boolean {
  return Boolean(process.env.FINTOC_SECRET_KEY && process.env.FINTOC_PUBLIC_KEY);
}

/**
 * Llave publica, para pasarsela al widget.
 *
 * Se lee en el servidor y viaja como prop en vez de usar NEXT_PUBLIC_: esas se
 * incrustan al compilar, y en esta app la configuracion se carga desde .env al
 * arrancar el contenedor, no al construir la imagen.
 */
export function clavePublicaFintoc(): string {
  return process.env.FINTOC_PUBLIC_KEY ?? '';
}

function clave(): string {
  const valor = process.env.FINTOC_SECRET_KEY;
  if (!valor) {
    throw new Error('FINTOC_SECRET_KEY no esta configurada.');
  }
  return valor;
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const respuesta = await fetch(`${API}${ruta}`, {
    ...opciones,
    headers: {
      Authorization: clave(),
      'Content-Type': 'application/json',
      ...opciones.headers,
    },
    cache: 'no-store',
  });

  const texto = await respuesta.text();

  if (!respuesta.ok) {
    throw new Error(`Fintoc respondio ${respuesta.status}: ${texto.slice(0, 400)}`);
  }

  return JSON.parse(texto) as T;
}

/**
 * Crea la sesion de pago.
 *
 * Se pide en modo `embedded` para que la respuesta traiga `session_token`, que
 * es lo que necesita el widget para abrirse dentro de la propia pagina.
 *
 * Verificado contra la API real: en `embedded` Fintoc NO devuelve `redirect_url`
 * (el checkout alojado es el otro modo, y ese exige un success_url HTTPS). Por
 * eso el plan B cuando el widget no monta es la transferencia manual, no un
 * link externo.
 *
 * `amount` va en la unidad minima de la moneda; para CLP eso es el peso, asi
 * que se pasa el monto tal cual, sin multiplicar por cien.
 */
export async function crearSesionCheckout(datos: {
  monto: number;
  correo: string;
  urlExito: string;
  urlCancelacion: string;
  metadata?: Record<string, string>;
  expiraEn?: Date;
}): Promise<SesionCheckout> {
  return pedir<SesionCheckout>('/checkout_sessions', {
    method: 'POST',
    body: JSON.stringify({
      flow: 'payment',
      amount: datos.monto,
      currency: 'CLP',
      payment_method_types: ['bank_transfer'],
      customer_email: datos.correo,
      // Fintoc rechaza URLs que no sean HTTPS, asi que en desarrollo local
      // (http://localhost) simplemente no se mandan. Son opcionales: en modo
      // embebido el widget devuelve el control por callback, y la confirmacion
      // llega igual por webhook o por conciliacion.
      ...(esHttps(datos.urlExito) ? { success_url: datos.urlExito } : {}),
      ...(esHttps(datos.urlCancelacion) ? { cancel_url: datos.urlCancelacion } : {}),
      ui_mode: 'embedded',
      metadata: datos.metadata ?? {},
      ...(datos.expiraEn ? { expires_at: datos.expiraEn.toISOString() } : {}),
    }),
  });
}

/** Consulta el estado de una sesion. Sirve para reconciliar si el webhook no llego. */
export async function obtenerSesionCheckout(id: string): Promise<SesionCheckout | null> {
  try {
    return await pedir<SesionCheckout>(`/checkout_sessions/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

/** ¿La sesion termino con el pago efectivamente cobrado? */
export function sesionPagada(sesion: SesionCheckout): boolean {
  if (sesion.status !== 'finished') return false;
  const intent = sesion.payment_resource?.payment_intent;
  // Si no viene el intent, se confia en el estado de la sesion.
  return !intent || intent.status === 'succeeded';
}

/**
 * Valida el header `Fintoc-Signature`.
 *
 * Formato: `t=<unix>,v1=<hmac hex>`, donde el HMAC-SHA256 se calcula sobre
 * `<t>.<cuerpo crudo>` con el secreto del endpoint de webhook.
 *
 * El cuerpo tiene que ser el texto EXACTO que llego: si se parsea a JSON y se
 * vuelve a serializar, la firma deja de calzar.
 */
export function validarFirmaWebhook(cuerpoCrudo: string, cabecera: string | null): boolean {
  const secreto = process.env.FINTOC_WEBHOOK_SECRET;
  if (!secreto || !cabecera) return false;

  const partes = Object.fromEntries(
    cabecera.split(',').map((trozo) => {
      const [llave, ...resto] = trozo.trim().split('=');
      return [llave, resto.join('=')];
    }),
  );

  const marca = partes.t;
  const firma = partes.v1;
  if (!marca || !firma) return false;

  const segundos = Number(marca);
  if (!Number.isFinite(segundos)) return false;
  if (Math.abs(Date.now() / 1000 - segundos) > VENTANA_FIRMA_SEG) return false;

  const esperada = createHmac('sha256', secreto).update(`${marca}.${cuerpoCrudo}`).digest('hex');

  const a = Buffer.from(esperada, 'utf8');
  const b = Buffer.from(firma, 'utf8');
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export type DiagnosticoFintoc =
  | { ok: true; modo: 'prueba' | 'produccion' }
  | { ok: false; problema: string };

/**
 * Revisa que las llaves de Fintoc tengan la forma correcta y no esten cruzadas.
 *
 * Fintoc no expone un endpoint barato para validar credenciales, asi que esto
 * es solo revision de forma. Igual atrapa el error mas comun y mas confuso:
 * pegar la llave publica en las dos variables. Ahi el cobro falla con un 401
 * del servidor que no le dice nada a nadie.
 */
export function verificarCredencialesFintoc(): DiagnosticoFintoc {
  const secreta = process.env.FINTOC_SECRET_KEY ?? '';
  const publica = process.env.FINTOC_PUBLIC_KEY ?? '';

  if (!secreta) return { ok: false, problema: 'Falta FINTOC_SECRET_KEY (la que empieza con sk_).' };
  if (!publica) return { ok: false, problema: 'Falta FINTOC_PUBLIC_KEY (la que empieza con pk_).' };

  if (secreta === publica) {
    return {
      ok: false,
      problema:
        'FINTOC_SECRET_KEY y FINTOC_PUBLIC_KEY tienen el mismo valor. Son dos llaves distintas: ' +
        'la secreta empieza con sk_ y la publica con pk_.',
    };
  }

  if (!secreta.startsWith('sk_')) {
    return {
      ok: false,
      problema: `FINTOC_SECRET_KEY deberia empezar con sk_, pero empieza con "${secreta.slice(0, 8)}". ` +
        'Parece que quedo la llave publica en el lugar de la secreta.',
    };
  }

  if (!publica.startsWith('pk_')) {
    return {
      ok: false,
      problema: `FINTOC_PUBLIC_KEY deberia empezar con pk_, pero empieza con "${publica.slice(0, 8)}".`,
    };
  }

  const modo = secreta.startsWith('sk_test') ? 'prueba' : 'produccion';

  if (modo === 'prueba' && !publica.startsWith('pk_test')) {
    return {
      ok: false,
      problema: 'Una llave es de prueba y la otra de produccion. Tienen que ser del mismo ambiente.',
    };
  }

  return { ok: true, modo };
}
