'use server';

import { revalidatePath } from 'next/cache';

import { requerirUsuario } from '@/lib/auth';
import { generarCodigoEntrada, generarToken } from '@/lib/codigos';
import { ROLES_ADMIN } from '@/lib/constantes';
import { enviarCorreo, plantillaEntrada, plantillaPagoRechazado } from '@/lib/correo';
import { fechaLarga, hora } from '@/lib/formato';
import { prisma } from '@/lib/prisma';
import { qrComoPng, urlDeEntrada } from '@/lib/qr';

export type EstadoRevision = { error?: string; ok?: string };

function urlPrivada(token: string): string {
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/mi-entrada/${token}`;
}

/**
 * Confirma un pago: lo marca como recibido, actualiza el total del comprador y,
 * si es su primer pago confirmado, le emite la entrada con QR.
 */
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
    include: {
      asistente: { include: { evento: true, tipoEntrada: true, entrada: true } },
    },
  });

  if (!pago) return { error: 'No encontramos ese pago.' };
  if (pago.pagoEstado === 'confirmado') return { error: 'Ese pago ya estaba confirmado.' };

  const asistente = pago.asistente;

  // --- Transacción: pago → total del comprador → entrada -------------------
  const resultado = await prisma.$transaction(async (tx) => {
    await tx.pago.update({
      where: { pagoId },
      data: {
        pagoEstado: 'confirmado',
        pagoFechaRevisado: new Date(),
        pagoRevisadoPor: usuario.usuarioId,
        pagoMotivoRechazo: null,
        modifiedBy: usuario.usuarioId,
      },
    });

    // El total se recalcula desde los pagos, nunca se suma a mano: así un
    // rechazo posterior siempre deja la cifra correcta.
    const suma = await tx.pago.aggregate({
      _sum: { pagoMonto: true },
      where: {
        pagoAsistenteId: asistente.asistenteId,
        pagoEstado: 'confirmado',
        isDeleted: false,
      },
    });

    const total = suma._sum.pagoMonto ?? 0;

    await tx.asistente.update({
      where: { asistenteId: asistente.asistenteId },
      data: {
        asistenteMontoPagado: total,
        asistenteEstado: 'confirmado',
        modifiedBy: usuario.usuarioId,
      },
    });

    if (asistente.entrada) {
      return { total, entrada: asistente.entrada, reciencreada: false };
    }

    // Emisión de la entrada. El código legible puede chocar: se reintenta.
    for (let intento = 0; intento < 6; intento += 1) {
      try {
        const entrada = await tx.entrada.create({
          data: {
            entradaAsistenteId: asistente.asistenteId,
            entradaTipoEntradaId: asistente.asistenteTipoEntradaId,
            entradaCodigo: generarCodigoEntrada(),
            entradaToken: generarToken(24),
            createdBy: usuario.usuarioId,
          },
        });
        return { total, entrada, reciencreada: true };
      } catch (e) {
        const codigo = (e as { code?: string }).code;
        if (codigo !== 'P2002') throw e;
      }
    }

    throw new Error('No se pudo generar un código de entrada único.');
  });

  revalidatePath('/admin/pagos');
  revalidatePath('/admin');
  revalidatePath(`/mi-entrada/${asistente.asistenteToken}`);

  // --- Correo, fuera de la transacción -------------------------------------
  if (resultado.reciencreada) {
    const evento = asistente.evento;
    const fechaTexto = evento.eventoFechaInicio
      ? `${fechaLarga(evento.eventoFechaInicio)} · ${hora(evento.eventoFechaInicio)} hrs`
      : null;

    const url = urlDeEntrada(resultado.entrada.entradaToken);
    const png = await qrComoPng(url);

    const enviado = await enviarCorreo({
      para: asistente.asistenteCorreo,
      asunto: `Tu entrada para ${evento.eventoNombre}`,
      html: plantillaEntrada({
        nombre: asistente.asistenteNombre,
        evento: evento.eventoNombre,
        tipoEntrada: asistente.tipoEntrada.tipoEntradaNombre,
        codigo: resultado.entrada.entradaCodigo,
        url,
        montoPagado: resultado.total,
        fechaTexto,
        lugarTexto: evento.eventoVenue
          ? `${evento.eventoVenue}, ${evento.eventoCiudad}`
          : evento.eventoCiudad,
      }),
      adjuntos: [{ filename: `entrada-${resultado.entrada.entradaCodigo}.png`, content: png }],
    });

    if (enviado) {
      await prisma.entrada.update({
        where: { entradaId: resultado.entrada.entradaId },
        data: { entradaCorreoEnviado: true, entradaCorreoFecha: new Date() },
      });
    }

    return {
      ok: enviado
        ? `Entrada ${resultado.entrada.entradaCodigo} emitida y enviada por correo.`
        : `Entrada ${resultado.entrada.entradaCodigo} emitida. El correo no salió — revisa la configuración de Resend.`,
    };
  }

  return { ok: 'Pago confirmado y sumado a su total.' };
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

  revalidatePath('/admin/pagos');
  revalidatePath('/admin');
  revalidatePath(`/mi-entrada/${asistente.asistenteToken}`);

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
