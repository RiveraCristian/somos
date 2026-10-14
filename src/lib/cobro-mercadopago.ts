import { USUARIO_SISTEMA_ID } from './constantes';
import { confirmarPagoYEmitir, revertirPago } from './emision';
import { registrarIncidencia } from './incidencias';
import {
  VIGENCIA_PREFERENCIA_MS,
  asistenteDeReferencia,
  buscarPagosMp,
  evaluarIntento,
  mensajeDeRechazoMp,
  obtenerPagoMp,
  type EstadoIntento,
  type PagoMp,
} from './mercadopago';
import { prisma } from './prisma';

export type ResultadoSincronizacion = {
  estado: 'pendiente' | 'confirmado' | 'rechazado' | 'cancelado' | 'reembolsado' | 'retenido';
  /** Codigo de la entrada, si al terminar la persona la tiene emitida. */
  codigo?: string;
  /** true si esta pasada fue la que confirmo el cobro. */
  reciencerrado: boolean;
};

/**
 * Pone un intento de cobro de Mercado Pago al dia con lo que dice la API.
 *
 * Es el UNICO lugar donde un cobro de Mercado Pago cambia de estado. Lo llaman
 * el webhook, el regreso del comprador al sitio y el boton de reconciliar del
 * panel; los tres solo avisan "anda a mirar", ninguno decide nada.
 *
 * `pista` es el cobro que trajo el webhook. Se suma a la busqueda porque el
 * indice de busqueda de Mercado Pago tarda unos segundos en ver un cobro
 * recien hecho, y no tiene sentido esperar a que lo vea si ya lo tenemos.
 *
 * Es idempotente: correrlo dos veces seguidas no cambia nada la segunda vez.
 */
export async function sincronizarIntentoMp(
  pagoId: number,
  pista?: PagoMp,
): Promise<ResultadoSincronizacion> {
  const pago = await prisma.pago.findFirst({
    where: { pagoId, pagoProveedor: 'mercadopago', isDeleted: false },
    include: { asistente: { include: { entrada: true } } },
  });

  if (!pago) throw new Error(`No existe el intento de Mercado Pago ${pagoId}.`);

  const { asistente } = pago;

  // Los cobros del intento. Los de Checkout Pro tienen referencia propia y se
  // buscan por ella; los que dejo la integracion anterior (Bricks) solo
  // conocen el id del cobro.
  let referencia = pago.pagoReferencia;
  let cobros: PagoMp[];

  if (referencia) {
    cobros = await buscarPagosMp(referencia);
  } else if (pago.pagoExternoPago) {
    const unico = await obtenerPagoMp(pago.pagoExternoPago);
    cobros = unico ? [unico] : [];
    referencia = unico?.external_reference ?? `asistente-${asistente.asistenteId}`;
  } else {
    return { estado: 'pendiente', reciencerrado: false };
  }

  if (pista && pista.external_reference === referencia && !cobros.some((c) => c.id === pista.id)) {
    cobros.push(pista);
  }

  // La referencia dice de quien es el cobro. Si no calza con el dueño del
  // intento, algo esta muy mal y no se toca nada.
  const duenoReferencia = asistenteDeReferencia(referencia);
  if (pago.pagoReferencia && duenoReferencia !== asistente.asistenteId) {
    throw new Error(
      `La referencia ${referencia} no es del asistente ${asistente.asistenteId} (pago ${pagoId}).`,
    );
  }

  const vencido = Date.now() - pago.pagoFechaDeclarado.getTime() > VIGENCIA_PREFERENCIA_MS;
  const evaluacion = evaluarIntento(cobros, { referencia, monto: pago.pagoMonto, vencido });
  const { principal } = evaluacion;

  // Primero se anota que dice Mercado Pago, pase lo que pase despues: es el
  // hilo para seguirle la pista a la plata (reembolsos, disputas).
  if (principal) {
    await prisma.pago.update({
      where: { pagoId },
      data: {
        pagoExternoPago: principal.id,
        pagoExternoEstado: principal.status.slice(0, 40),
        pagoExternoDetalle: principal.status_detail?.slice(0, 80) ?? null,
        modifiedBy: USUARIO_SISTEMA_ID,
      },
    });
  }

  for (const anomalia of evaluacion.anomalias) {
    await registrarIncidencia({
      tipo: anomalia.tipo,
      asistenteId: asistente.asistenteId,
      pagoId,
      externoPago: anomalia.pago.id,
      monto: anomalia.pago.transaction_amount ?? null,
      detalle: anomalia.detalle,
    });
  }

  // ------------------------------------------------------------- Aprobado
  if (evaluacion.estado === 'confirmado' && principal) {
    // La reserva se anulo mientras la persona pagaba. Emitirle la entrada
    // ahora la reviviria por la espalda del panel; la plata se devuelve o se
    // reactiva la reserva a mano.
    if (asistente.asistenteEstado === 'anulado') {
      await registrarIncidencia({
        tipo: 'pago_en_reserva_anulada',
        asistenteId: asistente.asistenteId,
        pagoId,
        externoPago: principal.id,
        monto: principal.transaction_amount ?? null,
        detalle: `Cobro ${principal.id} aprobado para una reserva anulada. No se emitió entrada.`,
      });
      return { estado: 'retenido', reciencerrado: false };
    }

    const yaConfirmado = pago.pagoEstado === 'confirmado';
    const resultado = await confirmarPagoYEmitir(pagoId, USUARIO_SISTEMA_ID);

    if (resultado.excedente) {
      await registrarIncidencia({
        tipo: 'pago_duplicado',
        asistenteId: asistente.asistenteId,
        pagoId,
        externoPago: principal.id,
        monto: pago.pagoMonto,
        detalle:
          `Cobro ${principal.id} aprobado cuando la entrada ya estaba pagada. ` +
          'Hay que devolverlo desde Mercado Pago.',
      });
    }

    return { estado: 'confirmado', codigo: resultado.codigo, reciencerrado: !yaConfirmado };
  }

  // ----------------------------------------------------------- Reembolsado
  if (evaluacion.estado === 'reembolsado') {
    const reversion = await revertirPago(
      pagoId,
      'reembolsado',
      principal?.status === 'charged_back'
        ? 'Contracargo: el titular desconoció el cobro.'
        : 'El pago fue devuelto en Mercado Pago.',
      USUARIO_SISTEMA_ID,
    );

    if (reversion.cambio && (reversion.entradaAnulada || reversion.entradaUsada)) {
      await registrarIncidencia({
        tipo: reversion.entradaUsada ? 'reembolso_entrada_usada' : 'reembolso',
        asistenteId: asistente.asistenteId,
        pagoId,
        externoPago: principal?.id ?? null,
        monto: pago.pagoMonto,
        detalle: reversion.entradaUsada
          ? `Se devolvió el cobro ${principal?.id}, pero la entrada ya se usó en la puerta.`
          : `Se devolvió el cobro ${principal?.id}. La entrada quedó anulada.`,
      });
    }

    return { estado: 'reembolsado', reciencerrado: false };
  }

  // ------------------------------------------- Pendiente, rechazado, cancelado
  // Un confirmado nunca baja por aca: solo un reembolso lo saca, y eso es el
  // caso de arriba. Si la busqueda de Mercado Pago todavia no ve el cobro
  // aprobado, no hay que deshacer lo que ya se confirmo.
  if (pago.pagoEstado === 'confirmado' || pago.pagoEstado === 'reembolsado') {
    return {
      estado: pago.pagoEstado,
      codigo: asistente.entrada?.entradaCodigo,
      reciencerrado: false,
    };
  }

  // Anular la reserva ya cerro sus intentos. Un rechazo que llegue despues no
  // tiene por que reabrirlos.
  if (asistente.asistenteEstado === 'anulado') {
    return { estado: pago.pagoEstado as EstadoIntento, reciencerrado: false };
  }

  if (evaluacion.estado !== pago.pagoEstado) {
    const cerrado = evaluacion.estado === 'rechazado' || evaluacion.estado === 'cancelado';

    await prisma.pago.update({
      where: { pagoId },
      data: {
        pagoEstado: evaluacion.estado,
        pagoMotivoRechazo:
          evaluacion.estado === 'rechazado'
            ? mensajeDeRechazoMp(principal?.status_detail)
            : evaluacion.estado === 'cancelado'
              ? 'El pago no se completó a tiempo.'
              : null,
        pagoFechaRevisado: cerrado ? new Date() : null,
        modifiedBy: USUARIO_SISTEMA_ID,
      },
    });
  }

  return { estado: evaluacion.estado, reciencerrado: false };
}

/**
 * Busca el intento al que pertenece un cobro que llego por webhook.
 *
 * Primero por la referencia externa (Checkout Pro); si no aparece, por el id
 * del cobro (los que quedaron de la integracion con Bricks).
 */
export async function intentoDeCobroMp(cobro: PagoMp) {
  if (cobro.external_reference) {
    const porReferencia = await prisma.pago.findFirst({
      where: {
        isDeleted: false,
        pagoProveedor: 'mercadopago',
        pagoReferencia: cobro.external_reference,
      },
    });
    if (porReferencia) return porReferencia;
  }

  return prisma.pago.findFirst({
    where: { isDeleted: false, pagoProveedor: 'mercadopago', pagoExternoPago: cobro.id },
  });
}
