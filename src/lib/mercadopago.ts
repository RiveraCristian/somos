import { randomBytes } from 'node:crypto';

import {
  MPNotFoundError,
  MercadoPagoConfig,
  Payment,
  Preference,
  User,
  WebhookSignatureValidator,
} from 'mercadopago';

/**
 * Cliente de Mercado Pago (Checkout Pro), sobre el SDK oficial.
 *
 * Checkout Pro es por REDIRECCION, como Flow: el servidor crea una preferencia
 * con el monto, el comprador se va a mercadopago.cl a pagar y vuelve. Eso deja
 * fuera de este sitio todo dato de tarjeta, y permite pagar sin cuenta de
 * Mercado Pago (como invitado) con los medios que lo admiten.
 *
 * La regla que manda sobre todo el modulo: el estado de un cobro lo dice SOLO
 * la API de pagos, consultada con nuestro access token. Ni el webhook (trae un
 * id, no un estado) ni la URL de regreso (la arma el navegador) prueban nada.
 *
 * Docs: https://www.mercadopago.cl/developers/es/docs/checkout-pro
 */

/** La unica moneda que se cobra. Un pago en otra moneda no es este cobro. */
export const MONEDA = 'CLP';

/** Lo que dura abierta una preferencia. Pasado eso, el intento se da por muerto. */
export const VIGENCIA_PREFERENCIA_MS = 60 * 60 * 1000;

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

/** Lo que este sitio usa de un pago. El SDK tipa todo como opcional. */
export type PagoMp = {
  id: string;
  status: string;
  status_detail?: string;
  transaction_amount?: number;
  transaction_amount_refunded?: number;
  currency_id?: string;
  external_reference?: string | null;
  date_created?: string;
  date_approved?: string | null;
  live_mode?: boolean;
};

/**
 * Mercado Pago se activa con el access token, que es lo unico que Checkout Pro
 * necesita en el servidor. La llave publica no se usa: la redireccion no monta
 * nada de Mercado Pago en el navegador.
 */
export function mercadoPagoHabilitado(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

/** Las credenciales TEST- abren el checkout de pruebas, no el real. */
function credencialDePrueba(): boolean {
  return (process.env.MERCADOPAGO_ACCESS_TOKEN ?? '').startsWith('TEST-');
}

function cliente(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN no esta configurado.');
  return new MercadoPagoConfig({ accessToken, options: { timeout: 10_000 } });
}

function aPagoMp(crudo: {
  id?: number | string;
  status?: string;
  status_detail?: string;
  transaction_amount?: number;
  transaction_amount_refunded?: number;
  currency_id?: string;
  external_reference?: string;
  date_created?: string;
  date_approved?: string;
  live_mode?: boolean;
}): PagoMp {
  return {
    id: String(crudo.id ?? ''),
    status: crudo.status ?? '',
    status_detail: crudo.status_detail,
    transaction_amount: crudo.transaction_amount,
    transaction_amount_refunded: crudo.transaction_amount_refunded,
    currency_id: crudo.currency_id,
    external_reference: crudo.external_reference ?? null,
    date_created: crudo.date_created,
    date_approved: crudo.date_approved ?? null,
    live_mode: crudo.live_mode,
  };
}

// ---------------------------------------------------------------------------
// Referencia externa
// ---------------------------------------------------------------------------

const PATRON_REFERENCIA = /^asistente-(\d+)-([a-f0-9]{12})$/;

/**
 * Referencia externa de un intento de cobro: `asistente-<id>-<azar>`.
 *
 * Lleva el id interno del asistente para que cualquier cobro, visto desde el
 * panel de Mercado Pago, diga de quien es. El azar la hace unica por intento:
 * con Checkout Pro cada preferencia es un intento distinto y el webhook tiene
 * que saber a cual pertenece cada cobro.
 */
export function nuevaReferenciaMp(asistenteId: number): string {
  return `asistente-${asistenteId}-${randomBytes(6).toString('hex')}`;
}

/** El id del asistente que viene dentro de una referencia, o null si no es nuestra. */
export function asistenteDeReferencia(referencia: string | null | undefined): number | null {
  const calce = PATRON_REFERENCIA.exec(referencia ?? '');
  return calce ? Number(calce[1]) : null;
}

// ---------------------------------------------------------------------------
// Preferencias (Checkout Pro)
// ---------------------------------------------------------------------------

export type PreferenciaCreada = { id: string; urlCheckout: string };

function urlDeCheckout(pref: { init_point?: string; sandbox_init_point?: string }): string {
  const url = credencialDePrueba() ? pref.sandbox_init_point : pref.init_point;
  if (!url) throw new Error('Mercado Pago no devolvio la URL del checkout.');
  return url;
}

/**
 * Crea la preferencia de un intento de cobro.
 *
 * Todo lo que importa —monto, moneda, referencia— sale del servidor. El
 * navegador no aporta ni un dato a este llamado: lo unico que recibe de vuelta
 * es la URL a la que tiene que ir.
 */
export async function crearPreferenciaMp(datos: {
  referencia: string;
  monto: number;
  titulo: string;
  correo: string;
  nombre: string;
  urlRetorno: string;
}): Promise<PreferenciaCreada> {
  const ahora = new Date();
  const hasta = new Date(ahora.getTime() + VIGENCIA_PREFERENCIA_MS);

  const preferencia = await new Preference(cliente()).create({
    body: {
      items: [
        {
          id: 'entrada',
          title: datos.titulo,
          quantity: 1,
          unit_price: datos.monto,
          currency_id: MONEDA,
        },
      ],
      payer: { email: datos.correo, name: datos.nombre },
      external_reference: datos.referencia,
      statement_descriptor: 'SOMOS',
      back_urls: {
        success: datos.urlRetorno,
        pending: datos.urlRetorno,
        failure: datos.urlRetorno,
      },
      // Mercado Pago solo acepta volver solo a una URL HTTPS. En local el
      // comprador vuelve con el boton "Volver al sitio" del checkout.
      ...(datos.urlRetorno.startsWith('https://') ? { auto_return: 'approved' } : {}),
      // Pasada la vigencia, la preferencia ya no acepta cobros: un link viejo
      // reabierto dias despues no puede terminar en un segundo pago.
      expires: true,
      expiration_date_from: ahora.toISOString(),
      expiration_date_to: hasta.toISOString(),
      // Los medios en efectivo quedan pendientes hasta que se pagan en caja.
      // Sin este tope, un cupon olvidado podria cobrarse semanas despues.
      date_of_expiration: new Date(ahora.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      metadata: { origen: 'somos' },
    },
    // Si la llamada se reintenta, Mercado Pago devuelve la misma preferencia.
    requestOptions: { idempotencyKey: datos.referencia },
  });

  if (!preferencia.id) throw new Error('Mercado Pago no devolvio el id de la preferencia.');

  return { id: preferencia.id, urlCheckout: urlDeCheckout(preferencia) };
}

/** URL de checkout de una preferencia ya creada, para reutilizarla. */
export async function urlDePreferenciaMp(id: string): Promise<string | null> {
  try {
    const preferencia = await new Preference(cliente()).get({ preferenceId: id });
    return urlDeCheckout(preferencia);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pagos
// ---------------------------------------------------------------------------

/**
 * Un pago por su id. Devuelve null si Mercado Pago dice que no existe, y
 * revienta ante cualquier otra falla: el webhook necesita distinguir "no es
 * nuestro" (se ignora) de "no se pudo preguntar" (se reintenta).
 */
export async function obtenerPagoMp(id: string): Promise<PagoMp | null> {
  try {
    return aPagoMp(await new Payment(cliente()).get({ id }));
  } catch (e) {
    if (e instanceof MPNotFoundError) return null;
    throw e;
  }
}

/**
 * Todos los cobros de un intento, buscados por su referencia externa.
 *
 * Con Checkout Pro puede haber varios: una tarjeta rechazada y despues otra
 * aprobada, dentro de la misma preferencia.
 */
export async function buscarPagosMp(referencia: string): Promise<PagoMp[]> {
  const respuesta = await new Payment(cliente()).search({
    options: {
      external_reference: referencia,
      sort: 'date_created',
      criteria: 'asc',
      limit: 50,
    },
  });

  return (respuesta.results ?? []).map(aPagoMp);
}

// ---------------------------------------------------------------------------
// Evaluacion de un intento
// ---------------------------------------------------------------------------

/** Estado interno (columna `pago_estado`) que corresponde a un intento. */
export type EstadoIntento = 'pendiente' | 'confirmado' | 'rechazado' | 'cancelado' | 'reembolsado';

export type TipoAnomalia =
  | 'pago_duplicado'
  | 'monto_no_coincide'
  | 'moneda_no_coincide'
  | 'reembolso_parcial'
  | 'contracargo';

export type Anomalia = { tipo: TipoAnomalia; pago: PagoMp; detalle: string };

export type EvaluacionIntento = {
  estado: EstadoIntento;
  /** El cobro que define el estado. Es el que se guarda como `pago_externo_pago`. */
  principal: PagoMp | null;
  /** Lo que no calza y alguien tiene que mirar. Nunca cambia el estado por si solo. */
  anomalias: Anomalia[];
};

const EN_CURSO = new Set(['pending', 'in_process', 'authorized', 'in_mediation']);

/**
 * Decide el estado de un intento a partir de sus cobros en Mercado Pago.
 *
 * Es una funcion pura a proposito: es la regla de cuando alguien queda pagado,
 * y tiene que poder probarse sin red ni base de datos.
 *
 * Un cobro aprobado cuenta SOLO si coinciden la referencia, el monto exacto y
 * la moneda. Uno aprobado que no calza no paga nada: queda como anomalia para
 * que alguien lo revise y lo devuelva.
 *
 * Mientras la preferencia siga vigente, un rechazo no cierra el intento: el
 * comprador sigue en el checkout y puede probar con otra tarjeta.
 */
export function evaluarIntento(
  cobros: PagoMp[],
  esperado: { referencia: string; monto: number; vencido: boolean },
): EvaluacionIntento {
  const anomalias: Anomalia[] = [];

  // Un cobro de otra referencia no es de este intento, venga de donde venga.
  const propios = cobros.filter((c) => c.external_reference === esperado.referencia);

  const aprobadosValidos: PagoMp[] = [];

  for (const cobro of propios) {
    if (cobro.status !== 'approved') continue;

    if (cobro.currency_id !== MONEDA) {
      anomalias.push({
        tipo: 'moneda_no_coincide',
        pago: cobro,
        detalle: `Cobro ${cobro.id} aprobado en ${cobro.currency_id ?? '?'}, no en ${MONEDA}.`,
      });
      continue;
    }

    if (cobro.transaction_amount !== esperado.monto) {
      anomalias.push({
        tipo: 'monto_no_coincide',
        pago: cobro,
        detalle: `Cobro ${cobro.id} aprobado por ${cobro.transaction_amount ?? '?'} y se esperaban ${esperado.monto}.`,
      });
      continue;
    }

    if ((cobro.transaction_amount_refunded ?? 0) > 0) {
      anomalias.push({
        tipo: 'reembolso_parcial',
        pago: cobro,
        detalle: `Cobro ${cobro.id} tiene ${cobro.transaction_amount_refunded} devueltos de ${cobro.transaction_amount}.`,
      });
    }

    aprobadosValidos.push(cobro);
  }

  if (aprobadosValidos.length > 0) {
    const [principal, ...extra] = aprobadosValidos;

    // Dos aprobados en la misma preferencia: entro la plata dos veces.
    for (const cobro of extra) {
      anomalias.push({
        tipo: 'pago_duplicado',
        pago: cobro,
        detalle: `Cobro ${cobro.id} aprobado en el mismo intento que el cobro ${principal.id}.`,
      });
    }

    return { estado: 'confirmado', principal, anomalias };
  }

  const ultimo = (estados: (s: string) => boolean) =>
    [...propios].reverse().find((c) => estados(c.status)) ?? null;

  const reembolsado = ultimo((s) => s === 'refunded' || s === 'charged_back');
  if (reembolsado) {
    if (reembolsado.status === 'charged_back') {
      anomalias.push({
        tipo: 'contracargo',
        pago: reembolsado,
        detalle: `Cobro ${reembolsado.id} desconocido por el titular de la tarjeta (contracargo).`,
      });
    }
    return { estado: 'reembolsado', principal: reembolsado, anomalias };
  }

  const enCurso = ultimo((s) => EN_CURSO.has(s));
  if (enCurso) return { estado: 'pendiente', principal: enCurso, anomalias };

  const rechazado = ultimo((s) => s === 'rejected');
  const cancelado = ultimo((s) => s === 'cancelled');

  if (!esperado.vencido) {
    return { estado: 'pendiente', principal: rechazado ?? cancelado, anomalias };
  }

  if (rechazado) return { estado: 'rechazado', principal: rechazado, anomalias };
  return { estado: 'cancelado', principal: cancelado, anomalias };
}

/** Traduce los motivos de rechazo mas comunes de Mercado Pago. */
export function mensajeDeRechazoMp(detalle?: string | null): string {
  const mapa: Record<string, string> = {
    cc_rejected_insufficient_amount: 'La tarjeta no tiene saldo suficiente.',
    cc_rejected_bad_filled_card_number: 'Revisa el número de la tarjeta.',
    cc_rejected_bad_filled_date: 'Revisa la fecha de vencimiento.',
    cc_rejected_bad_filled_security_code: 'Revisa el código de seguridad.',
    cc_rejected_bad_filled_other: 'Revisa los datos de la tarjeta.',
    cc_rejected_call_for_authorize: 'Tu banco tiene que autorizar el pago. Llámalos y reintenta.',
    cc_rejected_card_disabled: 'La tarjeta está inhabilitada. Llama a tu banco.',
    cc_rejected_duplicated_payment: 'Ya hiciste un pago igual. Si fue un error, espera un rato.',
    cc_rejected_high_risk: 'El pago fue rechazado por seguridad. Prueba con otro medio.',
    cc_rejected_max_attempts: 'Demasiados intentos. Prueba con otra tarjeta.',
  };

  return mapa[detalle ?? ''] ?? 'El pago fue rechazado. Prueba con otra tarjeta u otro medio.';
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

/**
 * Valida la firma del webhook con el validador del SDK.
 *
 * El HMAC-SHA256 va sobre `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`,
 * no sobre el cuerpo: por eso hay que pasarle el `data.id` de la query. No se
 * fija tolerancia de tiempo a proposito: reprocesar una notificacion vieja no
 * le hace dano a nadie, porque el estado igual se le pregunta a la API.
 */
export function validarFirmaWebhookMp(datos: {
  idRecurso: string;
  cabeceraFirma: string | null;
  cabeceraRequestId: string | null;
}): boolean {
  const secreto = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secreto || !datos.idRecurso) return false;

  try {
    WebhookSignatureValidator.validate({
      xSignature: datos.cabeceraFirma,
      xRequestId: datos.cabeceraRequestId,
      // Mercado Pago firma el id en minusculas cuando es alfanumerico.
      dataId: datos.idRecurso.toLowerCase(),
      secret: secreto,
    });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Diagnostico para el panel
// ---------------------------------------------------------------------------

export type DiagnosticoMp =
  | { ok: true; cuenta: string; modo: 'prueba' | 'produccion' }
  | { ok: false; problema: string };

/**
 * Pregunta a Mercado Pago si el access token sirve, y de que cuenta es.
 *
 * Existe porque el sintoma de una credencial mala es que "el pago no aparece",
 * que no le dice nada a nadie. Aca se distingue entre token invalido, token de
 * otro pais y un problema de red.
 */
export async function verificarCredencialesMp(): Promise<DiagnosticoMp> {
  const llave = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!llave) return { ok: false, problema: 'Falta MERCADOPAGO_ACCESS_TOKEN.' };

  if (!llave.startsWith('TEST-') && !llave.startsWith('APP_USR-')) {
    return {
      ok: false,
      problema:
        'Ese valor no parece un access token: los de Mercado Pago empiezan con TEST- o APP_USR-. ' +
        'Si copiaste un usuario, una contraseña o un User ID, no sirven: el token está en ' +
        'Tus integraciones > tu aplicación > Credenciales.',
    };
  }

  if (!process.env.MERCADOPAGO_WEBHOOK_SECRET) {
    return {
      ok: false,
      problema:
        'Falta MERCADOPAGO_WEBHOOK_SECRET. Sin la firma, el webhook rechaza todo y los pagos ' +
        'solo se confirman cuando el comprador vuelve al sitio.',
    };
  }

  try {
    const datos = await new User(cliente()).get();

    const cuenta = [datos.nickname ?? datos.email ?? 'cuenta sin nombre', datos.id ? `#${datos.id}` : '']
      .filter(Boolean)
      .join(' ');

    if (datos.site_id && datos.site_id !== 'MLC') {
      return {
        ok: false,
        problema: `Esa cuenta es de ${datos.site_id}, no de Chile (MLC). Los cobros en pesos chilenos van a fallar.`,
      };
    }

    // Las cuentas de prueba de Checkout Pro usan credenciales APP_USR- igual
    // que las reales: el prefijo no basta. La etiqueta de la cuenta, si.
    // Mostrarlo importa: cobrar de verdad creyendo que estas en pruebas, o al
    // reves, son los dos errores caros de esta integracion.
    const esPrueba = llave.startsWith('TEST-') || (datos.tags ?? []).includes('test_user');

    return { ok: true, cuenta, modo: esPrueba ? 'prueba' : 'produccion' };
  } catch (e) {
    const estado = (e as { status?: number }).status;
    if (estado === 401 || estado === 403) {
      return { ok: false, problema: 'Mercado Pago rechazó el access token (no es válido o expiró).' };
    }
    return {
      ok: false,
      problema: `No se pudo contactar a Mercado Pago: ${e instanceof Error ? e.message : 'error de red'}.`,
    };
  }
}
