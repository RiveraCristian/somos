import type { Prisma } from '@prisma/client';

import { generarCodigoEntrada, generarToken } from './codigos';
import { enviarCorreo, plantillaEntrada } from './correo';
import { fechaLarga, hora } from './formato';
import { prisma } from './prisma';
import { qrComoPng, urlDeEntrada } from './qr';
import { enlaceDeMapa } from './ubicacion';

export type ResultadoConfirmacion = {
  entradaId: number;
  codigo: string;
  token: string;
  /** true si esta confirmacion fue la que emitio la entrada. */
  reciencreada: boolean;
  totalPagado: number;
  correoEnviado: boolean;
  /**
   * true si la entrada ya estaba cubierta antes de este pago: la plata entro
   * dos veces y hay que devolver una. Quien llama decide como registrarlo.
   */
  excedente: boolean;
};

/**
 * Toma la fila del asistente hasta que termine la transaccion.
 *
 * Todo lo que cambia la plata de una persona —confirmar, revertir— pasa por
 * aca primero. Serializa por asistente, no globalmente: dos personas distintas
 * pagando a la vez no se esperan entre si.
 */
async function bloquearAsistente(tx: Prisma.TransactionClient, asistenteId: number) {
  await tx.$queryRaw`SELECT 1 FROM "asistentes" WHERE "asistente_id" = ${asistenteId} FOR UPDATE`;
}

/**
 * Confirma un pago y, si corresponde, emite la entrada y la manda por correo.
 *
 * Vive acá y no en un Server Action porque hay dos caminos que llegan a lo
 * mismo: el panel (alguien revisa un comprobante a mano) y el webhook de Fintoc
 * (el cobro se confirmo solo). Si la logica estuviera duplicada, tarde o
 * temprano una de las dos se quedaria atras.
 *
 * Es idempotente: confirmar dos veces el mismo pago no emite dos entradas ni
 * manda el correo de nuevo.
 */
export async function confirmarPagoYEmitir(
  pagoId: number,
  usuarioId: number,
): Promise<ResultadoConfirmacion> {
  const pago = await prisma.pago.findFirst({
    where: { pagoId, isDeleted: false },
    include: {
      asistente: { include: { evento: true, tipoEntrada: true, entrada: true } },
    },
  });

  if (!pago) {
    throw new Error(`No existe el pago ${pagoId}.`);
  }

  const asistente = pago.asistente;

  const resultado = await prisma.$transaction(async (tx) => {
    // El webhook y la conciliacion pueden llegar a la vez por el mismo cobro, o
    // por dos cobros de la misma persona. Se toma la fila del asistente y todo
    // lo demas se relee bajo ese candado: el segundo en llegar ve lo que dejo
    // el primero, en vez de emitir otra entrada o sumar dos veces.
    await bloquearAsistente(tx, asistente.asistenteId);

    const actual = await tx.pago.findUniqueOrThrow({
      where: { pagoId },
      select: { pagoEstado: true },
    });
    const entradaActual = await tx.entrada.findUnique({
      where: { entradaAsistenteId: asistente.asistenteId },
    });

    let excedente = false;

    // Solo se marca si seguia pendiente: si otro camino ya lo confirmo, esto no
    // vuelve a tocarlo ni pisa quien lo reviso.
    if (actual.pagoEstado !== 'confirmado') {
      // ¿Ya estaba cubierta la entrada antes de este pago? Entonces este cobro
      // sobra: la plata entro, pero hay que devolverla.
      const previo = await tx.pago.aggregate({
        _sum: { pagoMonto: true },
        where: {
          pagoAsistenteId: asistente.asistenteId,
          pagoEstado: 'confirmado',
          pagoId: { not: pagoId },
          isDeleted: false,
        },
      });
      excedente = (previo._sum.pagoMonto ?? 0) >= asistente.asistentePrecio;

      await tx.pago.update({
        where: { pagoId },
        data: {
          pagoEstado: 'confirmado',
          pagoFechaRevisado: new Date(),
          pagoRevisadoPor: usuarioId,
          pagoMotivoRechazo: null,
          modifiedBy: usuarioId,
        },
      });
    }

    // El total se recalcula desde los pagos, nunca se suma a mano: asi un
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
        modifiedBy: usuarioId,
      },
    });

    if (entradaActual) {
      // Una entrada anulada por un reembolso vuelve a valer si la persona
      // paga de nuevo. Es la misma entrada y el mismo QR: sigue siendo suya.
      if (entradaActual.entradaEstado === 'anulada' && total >= asistente.asistentePrecio) {
        const revivida = await tx.entrada.update({
          where: { entradaId: entradaActual.entradaId },
          data: { entradaEstado: 'valida', modifiedBy: usuarioId },
        });
        return { total, entrada: revivida, reciencreada: false, excedente };
      }
      return { total, entrada: entradaActual, reciencreada: false, excedente };
    }

    // Emision de la entrada. El codigo legible puede chocar: se reintenta.
    for (let intento = 0; intento < 6; intento += 1) {
      try {
        const entrada = await tx.entrada.create({
          data: {
            entradaAsistenteId: asistente.asistenteId,
            entradaTipoEntradaId: asistente.asistenteTipoEntradaId,
            entradaCodigo: generarCodigoEntrada(),
            entradaToken: generarToken(24),
            createdBy: usuarioId,
          },
        });
        return { total, entrada, reciencreada: true, excedente };
      } catch (e) {
        if ((e as { code?: string }).code !== 'P2002') throw e;
      }
    }

    throw new Error('No se pudo generar un codigo de entrada unico.');
  });

  // --- Correo, fuera de la transaccion --------------------------------------
  let correoEnviado = resultado.entrada.entradaCorreoEnviado;

  if (resultado.reciencreada || !correoEnviado) {
    const evento = asistente.evento;
    const url = urlDeEntrada(resultado.entrada.entradaToken);
    const png = await qrComoPng(url);

    correoEnviado = await enviarCorreo({
      para: asistente.asistenteCorreo,
      asunto: `Tu entrada para ${evento.eventoNombre}`,
      html: plantillaEntrada({
        nombre: asistente.asistenteNombre,
        evento: evento.eventoNombre,
        tipoEntrada: asistente.tipoEntrada.tipoEntradaNombre,
        codigo: resultado.entrada.entradaCodigo,
        url,
        montoPagado: resultado.total,
        fechaTexto: evento.eventoFechaInicio
          ? `${fechaLarga(evento.eventoFechaInicio)} · ${hora(evento.eventoFechaInicio)} hrs`
          : null,
        // El correo es el otro canal donde la direccion es legitima: solo lo
        // recibe quien ya tiene su entrada emitida.
        lugarTexto: [evento.eventoVenue, evento.eventoDireccion, evento.eventoCiudad]
          .filter(Boolean)
          .join(', '),
        mapaUrl: enlaceDeMapa({
          mapaUrl: evento.eventoMapaUrl,
          direccion: evento.eventoDireccion,
          latitud: evento.eventoLatitud,
          longitud: evento.eventoLongitud,
          venue: evento.eventoVenue,
          ciudad: evento.eventoCiudad,
        }),
      }),
      adjuntos: [{ filename: `entrada-${resultado.entrada.entradaCodigo}.png`, content: png }],
    });

    if (correoEnviado) {
      await prisma.entrada.update({
        where: { entradaId: resultado.entrada.entradaId },
        data: { entradaCorreoEnviado: true, entradaCorreoFecha: new Date() },
      });
    }
  }

  return {
    entradaId: resultado.entrada.entradaId,
    codigo: resultado.entrada.entradaCodigo,
    token: resultado.entrada.entradaToken,
    reciencreada: resultado.reciencreada,
    totalPagado: resultado.total,
    correoEnviado,
    excedente: resultado.excedente,
  };
}

export type ResultadoReversion = {
  /** false si el pago ya estaba en ese estado: no se hizo nada. */
  cambio: boolean;
  totalPagado: number;
  /** La entrada quedo sin pago que la respalde y se anulo. */
  entradaAnulada: boolean;
  /** La entrada quedo sin pago, pero ya se uso en la puerta: no hay que anular. */
  entradaUsada: boolean;
};

/**
 * Saca un pago confirmado del total: lo devolvieron o hubo contracargo.
 *
 * Si con eso la entrada queda sin pagar, se anula: un QR sin plata detras no
 * deberia abrir la puerta. Si el reembolso era de un cobro que sobraba (el
 * caso del pago doble), los otros pagos siguen cubriendo y la entrada no se
 * toca.
 */
export async function revertirPago(
  pagoId: number,
  estado: 'reembolsado',
  motivo: string,
  usuarioId: number,
): Promise<ResultadoReversion> {
  const pago = await prisma.pago.findFirst({
    where: { pagoId, isDeleted: false },
    select: { pagoAsistenteId: true },
  });

  if (!pago) throw new Error(`No existe el pago ${pagoId}.`);

  return prisma.$transaction(async (tx) => {
    await bloquearAsistente(tx, pago.pagoAsistenteId);

    const actual = await tx.pago.findUniqueOrThrow({
      where: { pagoId },
      select: { pagoEstado: true },
    });

    if (actual.pagoEstado === estado) {
      const asistente = await tx.asistente.findUniqueOrThrow({
        where: { asistenteId: pago.pagoAsistenteId },
        select: { asistenteMontoPagado: true },
      });
      return {
        cambio: false,
        totalPagado: asistente.asistenteMontoPagado,
        entradaAnulada: false,
        entradaUsada: false,
      };
    }

    await tx.pago.update({
      where: { pagoId },
      data: {
        pagoEstado: estado,
        pagoMotivoRechazo: motivo.slice(0, 300),
        pagoFechaRevisado: new Date(),
        modifiedBy: usuarioId,
      },
    });

    const suma = await tx.pago.aggregate({
      _sum: { pagoMonto: true },
      where: { pagoAsistenteId: pago.pagoAsistenteId, pagoEstado: 'confirmado', isDeleted: false },
    });
    const total = suma._sum.pagoMonto ?? 0;

    const asistente = await tx.asistente.findUniqueOrThrow({
      where: { asistenteId: pago.pagoAsistenteId },
      include: { entrada: true },
    });

    const cubierta = total >= asistente.asistentePrecio;

    await tx.asistente.update({
      where: { asistenteId: asistente.asistenteId },
      data: {
        asistenteMontoPagado: total,
        // Una reserva anulada sigue anulada; las demas vuelven a "falta pagar".
        ...(!cubierta && asistente.asistenteEstado === 'confirmado'
          ? { asistenteEstado: 'pendiente' }
          : {}),
        modifiedBy: usuarioId,
      },
    });

    let entradaAnulada = false;
    let entradaUsada = false;

    if (!cubierta && asistente.entrada) {
      if (asistente.entrada.entradaEstado === 'valida') {
        await tx.entrada.update({
          where: { entradaId: asistente.entrada.entradaId },
          data: { entradaEstado: 'anulada', modifiedBy: usuarioId },
        });
        entradaAnulada = true;
      } else if (asistente.entrada.entradaEstado === 'quemada') {
        entradaUsada = true;
      }
    }

    return { cambio: true, totalPagado: total, entradaAnulada, entradaUsada };
  });
}
