import { generarCodigoEntrada, generarToken } from './codigos';
import { enviarCorreo, plantillaEntrada } from './correo';
import { fechaLarga, hora } from './formato';
import { prisma } from './prisma';
import { qrComoPng, urlDeEntrada } from './qr';

export type ResultadoConfirmacion = {
  entradaId: number;
  codigo: string;
  token: string;
  /** true si esta confirmacion fue la que emitio la entrada. */
  reciencreada: boolean;
  totalPagado: number;
  correoEnviado: boolean;
};

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
    // Solo se marca si seguia pendiente: si otro camino ya lo confirmo, esto no
    // vuelve a tocarlo ni pisa quien lo reviso.
    if (pago.pagoEstado !== 'confirmado') {
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

    if (asistente.entrada) {
      return { total, entrada: asistente.entrada, reciencreada: false };
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
        return { total, entrada, reciencreada: true };
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
        lugarTexto: evento.eventoVenue
          ? `${evento.eventoVenue}, ${evento.eventoCiudad}`
          : evento.eventoCiudad,
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
  };
}
