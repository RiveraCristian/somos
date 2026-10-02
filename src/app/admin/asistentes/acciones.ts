'use server';

import { revalidatePath } from 'next/cache';

import { guardarComprobante } from '@/lib/archivos';
import { requerirUsuario } from '@/lib/auth';
import { ROLES_ADMIN } from '@/lib/constantes';
import { confirmarPagoYEmitir } from '@/lib/emision';
import { prisma } from '@/lib/prisma';
import { esquemaPagoManual, primerError } from '@/lib/validaciones';

export type EstadoPagoManual = { error?: string; ok?: string };

/**
 * Registra a mano un pago que llego por fuera y emite la entrada.
 *
 * El sitio cobra solo con la pasarela: quien compra no tiene forma de declarar
 * una transferencia. Esta es la valvula de escape para los casos que se salen
 * del camino — pago en efectivo, un banco que la pasarela no cubre, alguien que
 * te transfirio directo. Sin esto no habria manera de darle su entrada a esa
 * persona salvo tocando la base de datos.
 *
 * Queda registrado como pago manual, con quien lo confirmo y cuando, para que
 * la caja siga cuadrando con lo que dice el panel.
 */
export async function registrarPagoManual(
  _previo: EstadoPagoManual,
  formulario: FormData,
): Promise<EstadoPagoManual> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/asistentes');

  const asistenteId = Number(formulario.get('asistenteId'));

  const asistente = await prisma.asistente.findFirst({
    where: { asistenteId, isDeleted: false },
    include: { evento: true, entrada: true },
  });

  if (!asistente) return { error: 'Ese asistente ya no existe.' };
  if (asistente.asistenteEstado === 'anulado') {
    return { error: 'Esa entrada está anulada. Reactívala antes de registrarle un pago.' };
  }
  if (asistente.entrada) {
    return { error: `${asistente.asistenteNombre} ya tiene su entrada emitida.` };
  }

  const analisis = esquemaPagoManual.safeParse({
    monto: formulario.get('monto'),
    metodo: formulario.get('metodo'),
    referencia: formulario.get('referencia'),
    mensaje: formulario.get('mensaje'),
  });

  if (!analisis.success) return { error: primerError(analisis.error) };

  const datos = analisis.data;

  // El comprobante es opcional: si te pagaron en efectivo no hay ninguno. Pero
  // cuando existe conviene guardarlo, porque es el respaldo de por que alguien
  // marco esto como pagado sin que pasara por la pasarela.
  const archivo = formulario.get('comprobante');
  let guardado = null;

  if (archivo instanceof File && archivo.size > 0) {
    try {
      guardado = await guardarComprobante(archivo);
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'No se pudo guardar el comprobante.' };
    }
  }

  const pago = await prisma.pago.create({
    data: {
      pagoAsistenteId: asistente.asistenteId,
      pagoMonto: datos.monto,
      pagoMetodo: datos.metodo,
      pagoProveedor: 'manual',
      pagoReferencia: datos.referencia || null,
      pagoMensaje: datos.mensaje || null,
      ...(guardado
        ? {
            pagoComprobanteArchivo: guardado.archivo,
            pagoComprobanteMime: guardado.mime,
            pagoComprobanteTamano: guardado.tamano,
          }
        : {}),
      createdBy: usuario.usuarioId,
    },
  });

  // Se confirma en el mismo acto: quien registra el pago a mano ya vio la plata.
  // Es la misma funcion que usan los webhooks, asi que la entrada se emite y se
  // manda por correo exactamente igual que en un cobro automatico.
  const resultado = await confirmarPagoYEmitir(pago.pagoId, usuario.usuarioId);

  revalidatePath('/admin/asistentes');
  revalidatePath('/admin/pagos');
  revalidatePath('/admin');

  return {
    ok: resultado.codigo
      ? `Pago registrado y entrada ${resultado.codigo} emitida.`
      : 'Pago registrado.',
  };
}

export type EstadoReserva = { error?: string; ok?: string };

/**
 * Anula una reserva para que esa persona pueda volver a comprar.
 *
 * Para que sirve: la reserva se crea ANTES de pagar y ya ocupa cupo. Quien
 * abandona el pago —cierra la pestana, le rechazan la tarjeta— queda bloqueado
 * por su propio intento: su telefono ya "tiene" una entrada y su correo ya esta
 * tomado. Esto lo libera, y es la salida para la noche de la venta.
 *
 * No se borra la fila: queda como `anulado`, visible en el panel, para que
 * despues se entienda que paso. El cupo y el correo se liberan igual, porque
 * tanto el conteo como el indice unico ignoran las anuladas.
 *
 * Solo sobre reservas SIN entrada emitida. Anular una entrada ya emitida es
 * otra cosa —hay plata de por medio y un QR que podria estar circulando— y no
 * deberia esconderse detras del mismo boton.
 */
export async function anularReserva(
  _previo: EstadoReserva,
  formulario: FormData,
): Promise<EstadoReserva> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/asistentes');
  const asistenteId = Number(formulario.get('asistenteId'));

  const asistente = await prisma.asistente.findFirst({
    where: { asistenteId, isDeleted: false },
    include: { entrada: true },
  });

  if (!asistente) return { error: 'Esa reserva ya no existe.' };
  if (asistente.asistenteEstado === 'anulado') return { error: 'Esa reserva ya estaba anulada.' };

  if (asistente.entrada) {
    return {
      error:
        `${asistente.asistenteNombre} ya tiene su entrada emitida. ` +
        'Anularla es otra cosa: hay un pago hecho y un QR que puede estar circulando.',
    };
  }

  if (asistente.asistenteMontoPagado > 0) {
    return {
      error:
        `A ${asistente.asistenteNombre} ya le entró dinero. ` +
        'Resuelve el reembolso antes de anular, o la caja deja de cuadrar.',
    };
  }

  await prisma.asistente.update({
    where: { asistenteId },
    data: { asistenteEstado: 'anulado', modifiedBy: usuario.usuarioId },
  });

  // Los intentos de cobro que quedaron abiertos se cierran: si no, la
  // conciliacion seguiria preguntandole a la pasarela por un pago de una
  // reserva que ya no existe.
  await prisma.pago.updateMany({
    where: { pagoAsistenteId: asistenteId, pagoEstado: 'pendiente', isDeleted: false },
    data: {
      pagoEstado: 'rechazado',
      pagoMotivoRechazo: 'La reserva se anuló desde el panel.',
      pagoFechaRevisado: new Date(),
      modifiedBy: usuario.usuarioId,
    },
  });

  revalidatePath('/admin/asistentes');
  revalidatePath('/admin/pagos');
  revalidatePath('/admin');

  return {
    ok: `Reserva de ${asistente.asistenteNombre} anulada. Ese número y ese correo quedan libres.`,
  };
}

/**
 * Deshace una anulacion.
 *
 * Puede fallar legitimamente: si la persona ya volvio a comprar, revivir la
 * reserva vieja dejaria dos entradas para un numero que tiene cupo de una. Se
 * revisa antes en vez de dejar que reviente el indice unico con un error que
 * no explica nada.
 */
export async function reactivarReserva(
  _previo: EstadoReserva,
  formulario: FormData,
): Promise<EstadoReserva> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/asistentes');
  const asistenteId = Number(formulario.get('asistenteId'));

  const asistente = await prisma.asistente.findFirst({
    where: { asistenteId, isDeleted: false },
  });

  if (!asistente) return { error: 'Esa reserva ya no existe.' };
  if (asistente.asistenteEstado !== 'anulado') return { error: 'Esa reserva no está anulada.' };

  const choque = await prisma.asistente.findFirst({
    where: {
      asistenteEventoId: asistente.asistenteEventoId,
      asistenteCorreo: asistente.asistenteCorreo,
      asistenteEstado: { not: 'anulado' },
      isDeleted: false,
    },
  });

  if (choque) {
    return {
      error: `${asistente.asistenteCorreo} ya volvió a reservar. No se puede revivir la anterior.`,
    };
  }

  await prisma.asistente.update({
    where: { asistenteId },
    data: { asistenteEstado: 'pendiente', modifiedBy: usuario.usuarioId },
  });

  revalidatePath('/admin/asistentes');
  revalidatePath('/admin');

  return { ok: `Reserva de ${asistente.asistenteNombre} reactivada.` };
}
