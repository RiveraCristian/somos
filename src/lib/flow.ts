import { createHmac, randomBytes } from 'node:crypto';

/**
 * Cliente de Flow (flow.cl).
 *
 * Se usa `fetch` contra la API en vez del SDK: son dos endpoints y una firma
 * HMAC, y asi no se arrastra una dependencia mas de servidor.
 *
 * Flow se diferencia de las otras dos pasarelas en dos cosas que mandan sobre
 * todo el diseno de este modulo:
 *
 *   1. Es por REDIRECCION. No hay widget: el comprador se va a flow.cl, paga, y
 *      vuelve. No existe un "token de sesion" para montar en la pagina.
 *
 *   2. La confirmacion NO viene firmada. Flow solo hace POST de un `token` a
 *      nuestra urlConfirmation. Por eso el token no alcanza como prueba de
 *      nada: el estado real SIEMPRE se le pregunta a Flow con getStatus, que
 *      si va autenticado con la apiKey y la firma. Quien avisa y quien dice la
 *      verdad son dos canales distintos a proposito.
 *
 * Docs: https://developers.flow.cl/en/api
 */

const API_PRODUCCION = 'https://www.flow.cl/api';
const API_SANDBOX = 'https://sandbox.flow.cl/api';

/** Valores del campo `status` que devuelve getStatus. */
export const ESTADO_FLOW = {
  pendiente: 1,
  pagada: 2,
  rechazada: 3,
  anulada: 4,
} as const;

export type EstadoFlow = {
  flowOrder: number;
  commerceOrder: string;
  requestDate: string;
  status: number;
  subject: string;
  currency: string;
  amount: number;
  payer: string;
  paymentData?: {
    date?: string;
    media?: string;
    amount?: string;
    fee?: string;
    balance?: string;
  } | null;
};

export type PagoCreado = {
  /** URL del checkout de Flow. Hay que mandar al comprador a `url?token=...`. */
  url: string;
  token: string;
  flowOrder: number;
};

/**
 * Flow solo se activa con las DOS credenciales: la apiKey identifica al
 * comercio y la secretKey firma. Con una sola, ninguna llamada pasa.
 */
export function flowHabilitado(): boolean {
  return Boolean(process.env.FLOW_API_KEY && process.env.FLOW_SECRET_KEY);
}

/**
 * Sandbox o produccion.
 *
 * Va en una variable y no se deduce de la llave: las credenciales de Flow no
 * traen prefijo que las distinga, asi que no hay forma de adivinarlo. Cobrar de
 * verdad creyendo que estas en pruebas es el error caro de esta integracion, y
 * prefiero que sea una decision escrita.
 */
export function ambienteFlow(): 'sandbox' | 'produccion' {
  return (process.env.FLOW_AMBIENTE ?? '').trim().toLowerCase() === 'produccion'
    ? 'produccion'
    : 'sandbox';
}

function api(): string {
  return ambienteFlow() === 'produccion' ? API_PRODUCCION : API_SANDBOX;
}

function apiKey(): string {
  const valor = process.env.FLOW_API_KEY;
  if (!valor) throw new Error('FLOW_API_KEY no esta configurada.');
  return valor;
}

function secretKey(): string {
  const valor = process.env.FLOW_SECRET_KEY;
  if (!valor) throw new Error('FLOW_SECRET_KEY no esta configurada.');
  return valor;
}

/**
 * Firma de Flow.
 *
 * Los parametros (todos menos `s`) se ordenan alfabeticamente por nombre y se
 * concatenan como nombre+valor, sin separador alguno; eso se firma con
 * HMAC-SHA256 usando la secretKey, en hexadecimal.
 *
 * Se firma sobre el MISMO mapa de strings que despues se manda: si se firmara
 * una cosa y se enviara otra —un numero formateado distinto, por ejemplo— Flow
 * rechazaria la llamada con un error que no dice cual fue la diferencia.
 */
export function cadenaAFirmar(parametros: Record<string, string>): string {
  return Object.keys(parametros)
    .sort()
    .map((nombre) => `${nombre}${parametros[nombre]}`)
    .join('');
}

function firmar(parametros: Record<string, string>): string {
  return createHmac('sha256', secretKey()).update(cadenaAFirmar(parametros)).digest('hex');
}

/** Identificador de la orden del lado nuestro. Unico por intento de pago. */
export function nuevaOrdenComercio(asistenteId: number): string {
  return `somos-${asistenteId}-${randomBytes(4).toString('hex')}`;
}

/** Codigos de Flow que vale la pena distinguir. */
export const CODIGO_FLOW = {
  /** Flow no acepta el correo del pagador. Reintentar no lo arregla. */
  correoInvalido: 1620,
} as const;

/**
 * Error de la API de Flow, con su codigo.
 *
 * Existe para poder separar "esto lo arregla el comprador" de "esto lo
 * arreglamos nosotros". Sin el codigo, todo termina en el mismo "intenta de
 * nuevo", que para un correo rechazado es un consejo falso: por mas veces que
 * lo intente, va a fallar igual.
 */
export class ErrorFlow extends Error {
  constructor(
    mensaje: string,
    readonly codigo: number | null,
    readonly httpStatus: number,
  ) {
    super(mensaje);
    this.name = 'ErrorFlow';
  }
}

async function pedir<T>(ruta: string, parametros: Record<string, string>, metodo: 'GET' | 'POST') {
  const firmados = { ...parametros, apiKey: apiKey() };
  const cuerpo = new URLSearchParams({ ...firmados, s: firmar(firmados) });

  const url = metodo === 'GET' ? `${api()}${ruta}?${cuerpo}` : `${api()}${ruta}`;

  const respuesta = await fetch(url, {
    method: metodo,
    ...(metodo === 'POST'
      ? {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: cuerpo,
        }
      : {}),
    cache: 'no-store',
  });

  const texto = await respuesta.text();

  if (!respuesta.ok) {
    // Flow responde los errores como JSON con `code` y `message`. Se conservan
    // los dos: "400 Bad Request" a secas no le sirve a nadie, y el codigo es lo
    // unico que permite distinguir un problema que el comprador puede arreglar
    // de uno nuestro.
    let mensaje = texto.slice(0, 300);
    let codigo: number | null = null;
    try {
      const json = JSON.parse(texto) as { message?: string; code?: number };
      if (json.message) mensaje = json.message;
      if (typeof json.code === 'number') codigo = json.code;
    } catch {
      /* se queda con el texto crudo */
    }
    throw new ErrorFlow(mensaje, codigo, respuesta.status);
  }

  return JSON.parse(texto) as T;
}

/**
 * Crea la orden de pago y devuelve a donde hay que mandar al comprador.
 *
 * El monto va en pesos enteros: Flow no acepta decimales en CLP.
 */
export async function crearPagoFlow(datos: {
  ordenComercio: string;
  monto: number;
  asunto: string;
  correo: string;
  urlConfirmacion: string;
  urlRetorno: string;
}): Promise<PagoCreado> {
  return pedir<PagoCreado>(
    '/payment/create',
    {
      commerceOrder: datos.ordenComercio,
      subject: datos.asunto,
      currency: 'CLP',
      amount: String(Math.round(datos.monto)),
      email: datos.correo,
      // 9 = todos los medios que el comercio tenga habilitados en Flow.
      paymentMethod: '9',
      urlConfirmation: datos.urlConfirmacion,
      urlReturn: datos.urlRetorno,
    },
    'POST',
  );
}

/** A donde se manda al comprador despues de crear la orden. */
export function urlDeCheckout(pago: PagoCreado): string {
  return `${pago.url}?token=${encodeURIComponent(pago.token)}`;
}

/**
 * Estado real de un pago, preguntado a Flow.
 *
 * Esta es la UNICA fuente de verdad de un cobro con Flow: ni el retorno del
 * comprador ni el aviso a urlConfirmation prueban nada, porque ninguno viene
 * firmado.
 */
export async function obtenerEstadoFlow(token: string): Promise<EstadoFlow | null> {
  try {
    return await pedir<EstadoFlow>('/payment/getStatus', { token }, 'GET');
  } catch {
    return null;
  }
}

/** ¿El cobro quedo efectivamente hecho? */
export function pagoFlowPagado(estado: EstadoFlow): boolean {
  return estado.status === ESTADO_FLOW.pagada;
}

/** ¿El cobro murio y no va a completarse? */
export function pagoFlowFallido(estado: EstadoFlow): boolean {
  return estado.status === ESTADO_FLOW.rechazada || estado.status === ESTADO_FLOW.anulada;
}

export type DiagnosticoFlow =
  | { ok: true; ambiente: 'sandbox' | 'produccion' }
  | { ok: false; problema: string };

/**
 * Revisa que las credenciales esten y que la firma se arme.
 *
 * No sale a la red: Flow no tiene un endpoint de "quien soy" que se pueda
 * llamar sin crear una orden, y crear ordenes de prueba para diagnosticar
 * ensuciaria el panel del comercio.
 */
export function verificarCredencialesFlow(): DiagnosticoFlow {
  if (!process.env.FLOW_API_KEY) {
    return { ok: false, problema: 'Falta FLOW_API_KEY.' };
  }
  if (!process.env.FLOW_SECRET_KEY) {
    return { ok: false, problema: 'Falta FLOW_SECRET_KEY.' };
  }
  if (!process.env.FLOW_AMBIENTE) {
    return {
      ok: false,
      problema: 'Falta FLOW_AMBIENTE. Ponlo en "sandbox" o en "produccion": no se adivina.',
    };
  }

  return { ok: true, ambiente: ambienteFlow() };
}
