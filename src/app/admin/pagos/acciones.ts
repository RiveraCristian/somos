'use server';

import { revalidatePath } from 'next/cache';

import { requerirUsuario } from '@/lib/auth';
import { ROLES_ADMIN } from '@/lib/constantes';
import { enviarCorreo, plantillaPagoRechazado } from '@/lib/correo';
import { confirmarPagoYEmitir } from '@/lib/emision';
import { conciliarPagosPasarela } from '@/lib/conciliacion';
import { pasarelaActiva } from '@/lib/pasarela';
import { prisma } from '@/lib/prisma';

export type EstadoRevision = { error?: string; ok?: string };

function urlPrivada(token: string): string {
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/mi-entrada/${token}`;
}

function refrescar(tokenAsistente: string) {
  revalidatePath('/admin/pagos');
  revalidatePath('/admin');
  revalidatePath(`/mi-entrada/${tokenAsistente}`);
}

/** Confirma un pago revisado a mano y emite la entrada. */
export async function confirmarPago(
  _previo: EstadoRevision,
  formulario: FormData,
): Promise<EstadoRevision> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/pagos');
  const pagoId = Number(formulario.get('pagoId'));

  if (!Number.isInteger(pagoId) || pagoId <= 0) {
    return { error: 'Pago inválido.' };
  }

  const pago = await prisma.pago.findFirst({
    where: { pagoId, isDeleted: false },
    include: { asistente: { select: { asistenteToken: true } } },
  });

  if (!pago) return { error: 'No encontramos ese pago.' };
  if (pago.pagoEstado === 'confirmado') return { error: 'Ese pago ya estaba confirmado.' };

  const resultado = await confirmarPagoYEmitir(pagoId, usuario.usuarioId);
  refrescar(pago.asistente.asistenteToken);

  if (!resultado.reciencreada) {
    return { ok: 'Pago confirmado y sumado a su total.' };
  }

  return {
    ok: resultado.correoEnviado
      ? `Entrada ${resultado.codigo} emitida y enviada por correo.`
      : `Entrada ${resultado.codigo} emitida. El correo no salió — revisa la configuración de Resend.`,
  };
}

/** Rechaza un pago indicando por qué. */
export async function rechazarPago(
  _previo: EstadoRevision,
  formulario: FormData,
): Promise<EstadoRevision> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/pagos');
  const pagoId = Number(formulario.get('pagoId'));
  const motivo = String(formulario.get('motivo') ?? '').trim();

  if (!Number.isInteger(pagoId) || pagoId <= 0) {
    return { error: 'Pago inválido.' };
  }

  if (motivo.length < 5) {
    return { error: 'Escribe el motivo del rechazo (mínimo 5 caracteres).' };
  }

  const pago = await prisma.pago.findFirst({
    where: { pagoId, isDeleted: false },
    include: { asistente: { include: { evento: true } } },
  });

  if (!pago) return { error: 'No encontramos ese pago.' };

  const asistente = pago.asistente;

  await prisma.$transaction(async (tx) => {
    await tx.pago.update({
      where: { pagoId },
      data: {
        pagoEstado: 'rechazado',
        pagoMotivoRechazo: motivo.slice(0, 300),
        pagoFechaRevisado: new Date(),
        pagoRevisadoPor: usuario.usuarioId,
        modifiedBy: usuario.usuarioId,
      },
    });

    const suma = await tx.pago.aggregate({
      _sum: { pagoMonto: true },
      where: {
        pagoAsistenteId: asistente.asistenteId,
        pagoEstado: 'confirmado',
        isDeleted: false,
      },
    });

    await tx.asistente.update({
      where: { asistenteId: asistente.asistenteId },
      data: {
        asistenteMontoPagado: suma._sum.pagoMonto ?? 0,
        modifiedBy: usuario.usuarioId,
      },
    });
  });

  refrescar(asistente.asistenteToken);

  await enviarCorreo({
    para: asistente.asistenteCorreo,
    asunto: `Revisemos tu pago para ${asistente.evento.eventoNombre}`,
    html: plantillaPagoRechazado({
      nombre: asistente.asistenteNombre,
      evento: asistente.evento.eventoNombre,
      monto: pago.pagoMonto,
      motivo: motivo.slice(0, 300),
      url: urlPrivada(asistente.asistenteToken),
    }),
  });

  return { ok: 'Pago rechazado y avisado por correo.' };
}

/**
 * Vuelve a preguntarle a la pasarela por el estado de un cobro.
 * Sirve cuando el webhook no llego (se cayo el sitio, url mal configurada) y el
 * pago quedo colgado en pendiente aunque la plata si haya entrado.
 */
export async function reconciliarConPasarela(
  _previo: EstadoRevision,
  formulario: FormData,
): Promise<EstadoRevision> {
  await requerirUsuario(ROLES_ADMIN, '/admin/pagos');
  const pagoId = Number(formulario.get('pagoId'));

  const pasarela = pasarelaActiva();
  if (!pasarela) {
    return { error: 'No hay ninguna pasarela configurada.' };
  }

  const pago = await prisma.pago.findFirst({
    where: { pagoId, isDeleted: false },
    include: { asistente: { select: { asistenteId: true, asistenteToken: true } } },
  });

  if (!pago || pago.pagoProveedor === 'manual') {
    return { error: 'Ese pago no vino de una pasarela.' };
  }

  if (pago.pagoProveedor !== pasarela) {
    return {
      error: `Ese cobro es de ${pago.pagoProveedor} y la pasarela activa es ${pasarela}. Cambia PASARELA para revisarlo.`,
    };
  }

  const resultado = await conciliarPagosPasarela(pago.asistente.asistenteId);
  refrescar(pago.asistente.asistenteToken);

  if (!resultado.pagado) {
    return { error: 'La pasarela dice que el cobro todavía no se completó.' };
  }

  return {
    ok: resultado.reciencerrado
      ? `Cobro confirmado. Entrada ${resultado.codigo} emitida.`
      : 'El cobro ya estaba confirmado.',
  };
}
