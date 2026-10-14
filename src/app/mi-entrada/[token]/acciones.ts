'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { conciliarPagosPasarela } from '@/lib/conciliacion';
import { USUARIO_SISTEMA_ID } from '@/lib/constantes';
import { crearSesionCheckout, obtenerSesionCheckout } from '@/lib/fintoc';
import {
  CODIGO_FLOW,
  ErrorFlow,
  crearPagoFlow,
  nuevaOrdenComercio,
  urlDeCheckout,
} from '@/lib/flow';
import { ipDelCliente, permitir } from '@/lib/limitador';
import {
  VIGENCIA_PREFERENCIA_MS,
  crearPreferenciaMp,
  nuevaReferenciaMp,
  urlDePreferenciaMp,
} from '@/lib/mercadopago';
import { pasarelaActiva } from '@/lib/pasarela';
import { prisma } from '@/lib/prisma';

/** Lo que necesita el navegador para abrir el widget de Fintoc en la pagina. */
export type EstadoCobro = {
  error?: string;
  sesionToken?: string;
  /** Checkout alojado, por si el widget no logra montarse. */
  urlRespaldo?: string;
  /** Cambia en cada intento: le avisa al cliente que hay una sesion nueva. */
  intento?: number;
};

export type EstadoVerificacion = { pagado: boolean; codigo?: string };

function urlBase(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

const YA_PAGADA = 'Tu entrada ya está pagada.';

/**
 * Datos del comprador y cuanto le falta pagar, o el motivo por el que no puede.
 * El campo `ok` es el discriminante: sin el, TypeScript no separa bien las dos
 * formas del resultado.
 */
async function situacionDeCobro(token: string) {
  const negar = (error: string) => ({ ok: false as const, error });

  const asistente = await prisma.asistente.findFirst({
    where: { asistenteToken: token, isDeleted: false },
    include: { evento: true, tipoEntrada: true },
  });

  if (!asistente) return negar('No encontramos tu entrada. Revisa el link que te mandamos.');
  if (asistente.asistenteEstado === 'anulado') return negar('Tu entrada está anulada.');
  if (asistente.evento.eventoEstado === 'finalizado') return negar('Este evento ya terminó.');

  const saldo = asistente.asistentePrecio - asistente.asistenteMontoPagado;
  if (saldo <= 0) return negar(YA_PAGADA);

  return { ok: true as const, asistente, saldo };
}

// ---------------------------------------------------------------------------
// Fintoc: se crea una sesion y el widget la abre
// ---------------------------------------------------------------------------

/**
 * Arranca un cobro con Fintoc.
 *
 * No redirige: devuelve el token de la sesion para que el widget se abra encima
 * de la pagina. El pago queda en `pendiente`; quien lo confirma es el webhook o
 * la conciliacion, nunca el navegador.
 */
export async function iniciarPagoEnLinea(
  previo: EstadoCobro,
  formulario: FormData,
): Promise<EstadoCobro> {
  if (pasarelaActiva() !== 'fintoc') {
    return { error: 'El pago en línea no está disponible ahora mismo.' };
  }

  const token = String(formulario.get('token') ?? '');
  const situacion = await situacionDeCobro(token);
  if (!situacion.ok) return { error: situacion.error };

  const { asistente, saldo } = situacion;
  const intento = (previo.intento ?? 0) + 1;

  // Si ya hay un intento abierto y sigue vivo, se reutiliza su sesion en vez de
  // acumular un pago pendiente por cada clic.
  const abierto = await prisma.pago.findFirst({
    where: {
      pagoAsistenteId: asistente.asistenteId,
      pagoProveedor: 'fintoc',
      pagoEstado: 'pendiente',
      isDeleted: false,
      pagoExternoSesion: { not: null },
    },
    orderBy: { pagoFechaDeclarado: 'desc' },
  });

  if (abierto?.pagoExternoSesion) {
    const sesion = await obtenerSesionCheckout(abierto.pagoExternoSesion);
    if (sesion?.session_token && (sesion.status === 'created' || sesion.status === 'in_progress')) {
      return {
        sesionToken: sesion.session_token,
        urlRespaldo: sesion.redirect_url ?? undefined,
        intento,
      };
    }
  }

  try {
    const sesion = await crearSesionCheckout({
      monto: saldo,
      correo: asistente.asistenteCorreo,
      urlExito: `${urlBase()}/mi-entrada/${token}?pago=ok`,
      urlCancelacion: `${urlBase()}/mi-entrada/${token}?pago=cancelado`,
      metadata: {
        asistente_id: String(asistente.asistenteId),
        evento: asistente.evento.eventoSlug,
        tipo_entrada: asistente.tipoEntrada.tipoEntradaSlug,
      },
      expiraEn: new Date(Date.now() + 60 * 60 * 1000),
    });

    if (!sesion.session_token) {
      return { error: 'Fintoc no devolvió la sesión de pago. Intenta de nuevo.' };
    }

    await prisma.pago.create({
      data: {
        pagoAsistenteId: asistente.asistenteId,
        pagoMonto: saldo,
        pagoMetodo: 'fintoc',
        pagoProveedor: 'fintoc',
        pagoEstado: 'pendiente',
        pagoExternoSesion: sesion.id,
        pagoExternoPago: sesion.payment_resource?.payment_intent?.id ?? null,
        createdBy: USUARIO_SISTEMA_ID,
      },
    });

    revalidatePath(`/mi-entrada/${token}`);

    return {
      sesionToken: sesion.session_token,
      urlRespaldo: sesion.redirect_url ?? undefined,
      intento,
    };
  } catch (e) {
    console.error('[fintoc] no se pudo crear la sesion de pago:', e);
    return {
      error: 'No pudimos abrir el pago en línea. Puedes transferir a nuestra cuenta y subir el comprobante.',
    };
  }
}

// ---------------------------------------------------------------------------
// Mercado Pago: Checkout Pro, se crea la preferencia y se va a mercadopago.cl
// ---------------------------------------------------------------------------

export type EstadoCobroMp = { error?: string; url?: string; pagado?: boolean };

/** Intentos de abrir el checkout por entrada y por IP, cada diez minutos. */
const LIMITE_POR_ENTRADA = 8;
const LIMITE_POR_IP = 30;
const VENTANA_LIMITE_MS = 10 * 60 * 1000;

/** Una preferencia se reutiliza mientras le quede al menos esto de vida. */
const MARGEN_REUSO_MS = 15 * 60 * 1000;

/** Estados de Mercado Pago en que ya hay un cobro real andando. */
const COBRO_EN_CURSO = new Set(['pending', 'in_process', 'authorized', 'in_mediation']);

/**
 * Evita que dos clics simultaneos abran dos preferencias para la misma
 * persona. En memoria alcanza: la app corre en un solo proceso.
 */
const abriendo = new Set<number>();

/**
 * Arranca un cobro con Checkout Pro.
 *
 * Lo unico que manda el navegador es el token del link privado. De ahi el
 * servidor saca quien es, si sigue invitado, cuanto debe y si ya pago; el
 * monto, la moneda y la referencia no pasan nunca por el cliente.
 *
 * El pago queda en `pendiente`. Quien lo confirma es el webhook o la
 * conciliacion, nunca el regreso del comprador: volver de Mercado Pago con
 * `status=approved` en la URL no prueba nada, esa URL la escribe cualquiera.
 */
export async function iniciarPagoMercadoPago(
  _previo: EstadoCobroMp,
  formulario: FormData,
): Promise<EstadoCobroMp> {
  if (pasarelaActiva() !== 'mercadopago') {
    return { error: 'El pago en línea no está disponible ahora mismo.' };
  }

  const token = String(formulario.get('token') ?? '');

  // El token es un secreto de 64 caracteres que solo llega por correo. Igual
  // se limita: cada intento le cuesta una llamada a Mercado Pago.
  const ip = ipDelCliente(await headers());
  if (
    !permitir(`mp:ip:${ip}`, LIMITE_POR_IP, VENTANA_LIMITE_MS) ||
    !permitir(`mp:token:${token}`, LIMITE_POR_ENTRADA, VENTANA_LIMITE_MS)
  ) {
    return { error: 'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.' };
  }

  const situacion = await situacionDeCobro(token);
  if (!situacion.ok) {
    return situacion.error === YA_PAGADA ? { pagado: true } : { error: situacion.error };
  }

  const { asistente, saldo } = situacion;

  // Sigue en la lista? Un numero que se saco de la lista despues de reservar
  // ya no esta autorizado a pagar.
  const invitado = asistente.asistenteTelefono
    ? await prisma.invitado.findFirst({
        where: {
          invitadoEventoId: asistente.asistenteEventoId,
          invitadoTelefono: asistente.asistenteTelefono,
          invitadoActivo: true,
          isDeleted: false,
        },
        select: { invitadoId: true },
      })
    : null;

  if (!invitado) {
    return {
      error:
        'Tu número ya no figura en la lista de invitados, así que no podemos cobrarte. ' +
        'Escríbenos por Instagram y lo revisamos.',
    };
  }

  if (abriendo.has(asistente.asistenteId)) {
    return { error: 'Ya estamos abriendo tu pago. Espera un segundo.' };
  }
  abriendo.add(asistente.asistenteId);

  try {
    // Antes de abrir otro intento, se le pregunta a Mercado Pago por los que
    // quedaron abiertos: puede que ya haya pagado y no haya vuelto al sitio.
    const conciliado = await conciliarPagosPasarela(asistente.asistenteId);
    if (conciliado.pagado) {
      revalidatePath(`/mi-entrada/${token}`);
      return { pagado: true };
    }

    const abierto = await prisma.pago.findFirst({
      where: {
        pagoAsistenteId: asistente.asistenteId,
        pagoProveedor: 'mercadopago',
        pagoEstado: 'pendiente',
        isDeleted: false,
      },
      orderBy: { pagoFechaDeclarado: 'desc' },
    });

    // Un cobro real en curso (efectivo por pagar, tarjeta en revision): abrir
    // otro es la receta para cobrar dos veces.
    if (abierto && COBRO_EN_CURSO.has(abierto.pagoExternoEstado ?? '')) {
      return {
        error:
          'Tienes un pago en proceso con Mercado Pago. Apenas se resuelva te llega la entrada ' +
          'por correo; si se rechaza, podrás intentar de nuevo.',
      };
    }

    // Si la preferencia anterior sigue viva, se reutiliza en vez de acumular un
    // intento por cada clic.
    if (
      abierto?.pagoExternoSesion &&
      abierto.pagoMonto === saldo &&
      Date.now() - abierto.pagoFechaDeclarado.getTime() < VIGENCIA_PREFERENCIA_MS - MARGEN_REUSO_MS
    ) {
      const url = await urlDePreferenciaMp(abierto.pagoExternoSesion);
      if (url) return { url };
    }

    const referencia = nuevaReferenciaMp(asistente.asistenteId);

    const preferencia = await crearPreferenciaMp({
      referencia,
      monto: saldo,
      titulo: `Entrada ${asistente.tipoEntrada.tipoEntradaNombre} · ${asistente.evento.eventoNombre}`,
      correo: asistente.asistenteCorreo,
      nombre: asistente.asistenteNombre,
      urlRetorno: `${urlBase()}/mi-entrada/${token}?pago=mp`,
    });

    await prisma.pago.create({
      data: {
        pagoAsistenteId: asistente.asistenteId,
        pagoMonto: saldo,
        pagoMetodo: 'mercadopago',
        pagoProveedor: 'mercadopago',
        pagoEstado: 'pendiente',
        // La preferencia identifica el intento; la referencia es la llave con
        // que el webhook encuentra a quien pertenece cada cobro.
        pagoExternoSesion: preferencia.id,
        pagoReferencia: referencia,
        createdBy: USUARIO_SISTEMA_ID,
      },
    });

    revalidatePath(`/mi-entrada/${token}`);

    return { url: preferencia.urlCheckout };
  } catch (e) {
    console.error('[mercadopago] no se pudo crear la preferencia:', e);
    return { error: 'No pudimos abrir el pago. Intenta de nuevo en un momento.' };
  } finally {
    abriendo.delete(asistente.asistenteId);
  }
}

// ---------------------------------------------------------------------------
// Comun a las pasarelas
// ---------------------------------------------------------------------------

/**
 * Pregunta si el cobro pendiente ya se resolvio y, si entro, emite la entrada.
 *
 * Es seguro exponerlo: solo actua sobre el asistente dueño del token, y solo
 * confirma cuando la pasarela dice que el cobro se hizo. Nunca da un pago por
 * bueno por su cuenta.
 */
export async function verificarPagoEnLinea(token: string): Promise<EstadoVerificacion> {
  if (!token) return { pagado: false };

  const asistente = await prisma.asistente.findFirst({
    where: { asistenteToken: token, isDeleted: false },
    select: { asistenteId: true },
  });

  if (!asistente) return { pagado: false };

  const resultado = await conciliarPagosPasarela(asistente.asistenteId);

  if (resultado.reciencerrado) {
    revalidatePath(`/mi-entrada/${token}`);
  }

  return { pagado: resultado.pagado, codigo: resultado.codigo };
}

// ---------------------------------------------------------------------------
// Transferencia manual con comprobante
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Flow: se crea la orden y se manda al comprador a flow.cl
// ---------------------------------------------------------------------------

export type EstadoCobroFlow = { error?: string; url?: string };

/**
 * Arranca un cobro con Flow.
 *
 * A diferencia de Fintoc y Mercado Pago, aca no hay widget: Flow devuelve una
 * URL y el comprador se va a pagar alla. Por eso esta accion devuelve la URL en
 * vez de un token de sesion, y es el cliente el que navega.
 *
 * El pago queda en `pendiente`. Quien lo confirma es la confirmacion de Flow o
 * la conciliacion — nunca el regreso del comprador al sitio, que no prueba nada:
 * volver de Flow solo significa que el navegador volvio.
 */
export async function iniciarPagoFlow(
  _previo: EstadoCobroFlow,
  formulario: FormData,
): Promise<EstadoCobroFlow> {
  if (pasarelaActiva() !== 'flow') {
    return { error: 'El pago en línea no está disponible ahora mismo.' };
  }

  const token = String(formulario.get('token') ?? '');
  const situacion = await situacionDeCobro(token);
  if (!situacion.ok) return { error: situacion.error };

  const { asistente, saldo } = situacion;

  // Flow exige que urlConfirmation sea alcanzable desde internet. En local no
  // lo es, y en vez de fallar con un error de Flow que no se entiende, se dice
  // aca lo que pasa. El cobro igual se cierra por conciliacion al volver.
  const base = urlBase();
  if (!base.startsWith('https://')) {
    return {
      error:
        'Flow necesita que el sitio tenga HTTPS público para confirmar el pago. ' +
        'En desarrollo local no se puede cobrar con Flow.',
    };
  }

  const ordenComercio = nuevaOrdenComercio(asistente.asistenteId);

  try {
    const creado = await crearPagoFlow({
      ordenComercio,
      monto: saldo,
      asunto: `Entrada ${asistente.tipoEntrada.tipoEntradaNombre} · ${asistente.evento.eventoNombre}`,
      correo: asistente.asistenteCorreo,
      urlConfirmacion: `${base}/api/webhooks/flow`,
      urlRetorno: `${base}/mi-entrada/${token}?pago=volvio`,
    });

    await prisma.pago.create({
      data: {
        pagoAsistenteId: asistente.asistenteId,
        pagoMonto: saldo,
        pagoMetodo: 'flow',
        pagoProveedor: 'flow',
        pagoEstado: 'pendiente',
        // El token de Flow es la llave para consultar el estado y para
        // reconocer su confirmacion. Es unico por intento.
        pagoExternoSesion: creado.token,
        pagoExternoPago: String(creado.flowOrder),
        pagoReferencia: ordenComercio,
        createdBy: USUARIO_SISTEMA_ID,
      },
    });

    revalidatePath(`/mi-entrada/${token}`);

    return { url: urlDeCheckout(creado) };
  } catch (e) {
    console.error('[flow] no se pudo crear la orden:', e);

    // Flow valida el correo del pagador y rechaza algunos. Decir "intenta de
    // nuevo" ahi es un consejo falso: por mas veces que lo intente va a fallar
    // igual. Hay que mandarlo a cambiar el correo, que es lo unico que sirve.
    if (e instanceof ErrorFlow && e.codigo === CODIGO_FLOW.correoInvalido) {
      return {
        error:
          `Flow no acepta el correo ${asistente.asistenteCorreo} para cobrar. ` +
          'Escríbenos por Instagram y te cambiamos el correo de tu entrada.',
      };
    }

    return { error: 'No pudimos abrir el pago. Intenta de nuevo en un momento.' };
  }
}
