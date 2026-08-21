'use server';

import { revalidatePath } from 'next/cache';

import { conciliarPagosPasarela } from '@/lib/conciliacion';
import { USUARIO_SISTEMA_ID } from '@/lib/constantes';
import { crearSesionCheckout, obtenerSesionCheckout } from '@/lib/fintoc';
import { cobrarConMercadoPago, pagoAprobado, pagoFallido } from '@/lib/mercadopago';
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
  if (saldo <= 0) return negar('Tu entrada ya está pagada.');

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
// Mercado Pago: el Brick arma el pago y el servidor lo cobra
// ---------------------------------------------------------------------------

export type ResultadoBrick = {
  estado: 'aprobado' | 'en_proceso' | 'rechazado' | 'error';
  mensaje: string;
  codigo?: string;
};

/**
 * Cobra lo que armó el Brick de Mercado Pago.
 *
 * El navegador solo manda el token de la tarjeta y el medio de pago; el monto se
 * toma del tipo de entrada en el servidor. Si viniera del cliente, cualquiera
 * podria pagar mil pesos por una entrada de doce mil.
 */
export async function cobrarConBrick(
  token: string,
  datosFormulario: Record<string, unknown>,
): Promise<ResultadoBrick> {
  if (pasarelaActiva() !== 'mercadopago') {
    return { estado: 'error', mensaje: 'El pago en línea no está disponible ahora mismo.' };
  }

  const situacion = await situacionDeCobro(token);
  if (!situacion.ok) return { estado: 'error', mensaje: situacion.error };

  const { asistente, saldo } = situacion;

  let cobro;
  try {
    cobro = await cobrarConMercadoPago({
      datosFormulario,
      monto: saldo,
      descripcion: `Entrada ${asistente.tipoEntrada.tipoEntradaNombre} · ${asistente.evento.eventoNombre}`,
      referenciaExterna: `asistente-${asistente.asistenteId}`,
      correo: asistente.asistenteCorreo,
    });
  } catch (e) {
    console.error('[mercadopago] fallo el cobro:', e);
    return {
      estado: 'error',
      mensaje: 'No pudimos procesar el pago. Intenta de nuevo o transfiere a nuestra cuenta.',
    };
  }

  const aprobado = pagoAprobado(cobro);

  const pago = await prisma.pago.create({
    data: {
      pagoAsistenteId: asistente.asistenteId,
      pagoMonto: saldo,
      pagoMetodo: 'mercadopago',
      pagoProveedor: 'mercadopago',
      pagoEstado: aprobado ? 'pendiente' : pagoFallido(cobro) ? 'rechazado' : 'pendiente',
      pagoExternoPago: String(cobro.id),
      pagoMotivoRechazo: pagoFallido(cobro) ? (cobro.status_detail ?? 'Pago rechazado.') : null,
      pagoFechaRevisado: pagoFallido(cobro) ? new Date() : null,
      createdBy: USUARIO_SISTEMA_ID,
    },
  });

  // La emision pasa por la conciliacion, que vuelve a preguntarle a Mercado Pago
  // en vez de confiar en la respuesta que ya tenemos en mano. Es un viaje extra,
  // pero deja un solo camino por el que se emiten entradas.
  if (aprobado) {
    const resultado = await conciliarPagosPasarela(asistente.asistenteId);
    revalidatePath(`/mi-entrada/${token}`);

    if (resultado.pagado) {
      return {
        estado: 'aprobado',
        mensaje: 'Pago aprobado. Tu entrada ya está emitida.',
        codigo: resultado.codigo,
      };
    }
  }

  revalidatePath(`/mi-entrada/${token}`);

  if (pagoFallido(cobro)) {
    return {
      estado: 'rechazado',
      mensaje: mensajeDeRechazo(cobro.status_detail),
    };
  }

  return {
    estado: 'en_proceso',
    mensaje: 'Tu pago quedó en revisión. Apenas se apruebe te llega la entrada por correo.',
    codigo: String(pago.pagoId),
  };
}

/** Traduce los motivos de rechazo mas comunes de Mercado Pago. */
function mensajeDeRechazo(detalle?: string): string {
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

  return mapa[detalle ?? ''] ?? 'El pago fue rechazado. Prueba con otra tarjeta o transfiere a nuestra cuenta.';
}

// ---------------------------------------------------------------------------
// Comun a las dos pasarelas
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
