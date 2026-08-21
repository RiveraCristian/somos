import { USUARIO_SISTEMA_ID } from './constantes';
import { confirmarPagoYEmitir } from './emision';
import { obtenerSesionCheckout, sesionPagada } from './fintoc';
import { obtenerPagoMercadoPago, pagoAprobado, pagoFallido } from './mercadopago';
import { pasarelaActiva } from './pasarela';
import { prisma } from './prisma';

export type ResultadoConciliacion = {
  /** true si al terminar el asistente tiene su entrada emitida. */
  pagado: boolean;
  codigo?: string;
  /** true si esta pasada fue la que cerro el cobro. */
  reciencerrado: boolean;
};

type PagoPendiente = {
  pagoId: number;
  pagoProveedor: string;
  pagoExternoSesion: string | null;
  pagoExternoPago: string | null;
};

/** Estado de un cobro segun la pasarela: cobrado, muerto, o todavia en curso. */
type Veredicto = 'cobrado' | 'fallido' | 'en_curso';

/**
 * Lo que sabe la pasarela de un cobro.
 *
 * `idExterno` es el identificador del cobro alla afuera. Viene aparte del
 * veredicto porque al crear la sesion todavia no existe: recien aparece cuando
 * el banco procesa el pago. Es el unico hilo para seguir un cobro hasta la
 * pasarela (reembolsos, disputas), asi que hay que guardarlo apenas asoma.
 */
type Consulta = { veredicto: Veredicto; idExterno?: string };

async function consultarFintoc(pago: PagoPendiente): Promise<Consulta> {
  if (!pago.pagoExternoSesion) return { veredicto: 'en_curso' };

  const sesion = await obtenerSesionCheckout(pago.pagoExternoSesion);
  if (!sesion) return { veredicto: 'en_curso' };

  const idExterno = sesion.payment_resource?.payment_intent?.id ?? undefined;

  if (sesionPagada(sesion)) return { veredicto: 'cobrado', idExterno };
  if (sesion.status === 'expired') return { veredicto: 'fallido', idExterno };
  return { veredicto: 'en_curso', idExterno };
}

async function consultarMercadoPago(pago: PagoPendiente): Promise<Consulta> {
  if (!pago.pagoExternoPago) return { veredicto: 'en_curso' };

  const cobro = await obtenerPagoMercadoPago(pago.pagoExternoPago);
  if (!cobro) return { veredicto: 'en_curso' };
  if (pagoAprobado(cobro)) return { veredicto: 'cobrado' };
  if (pagoFallido(cobro)) return { veredicto: 'fallido' };
  return { veredicto: 'en_curso' };
}

/**
 * Le pregunta a la pasarela por los cobros pendientes de un asistente y cierra
 * los que ya se resolvieron.
 *
 * El webhook sigue siendo la via principal, pero no se puede depender solo de
 * el: en desarrollo local la pasarela no tiene una URL publica a la que pegarle,
 * y en produccion un webhook puede perderse. Preguntando directamente, la
 * entrada se emite igual.
 *
 * No llama a revalidatePath a proposito: asi sirve tanto desde un Server Action
 * como durante el render de un Server Component, donde revalidar esta prohibido.
 */
export async function conciliarPagosPasarela(
  asistenteId: number,
  /** Ignora los intentos mas nuevos que esto, para no consultar de mas. */
  antiguedadMinimaMs = 0,
): Promise<ResultadoConciliacion> {
  const pasarela = pasarelaActiva();
  if (!pasarela) return { pagado: false, reciencerrado: false };

  const asistente = await prisma.asistente.findFirst({
    where: { asistenteId, isDeleted: false },
    include: { entrada: true },
  });

  if (!asistente) return { pagado: false, reciencerrado: false };

  if (asistente.entrada) {
    return { pagado: true, codigo: asistente.entrada.entradaCodigo, reciencerrado: false };
  }

  const pendientes = await prisma.pago.findMany({
    where: {
      pagoAsistenteId: asistenteId,
      pagoProveedor: pasarela,
      pagoEstado: 'pendiente',
      isDeleted: false,
      ...(antiguedadMinimaMs > 0
        ? { pagoFechaDeclarado: { lte: new Date(Date.now() - antiguedadMinimaMs) } }
        : {}),
    },
    select: {
      pagoId: true,
      pagoProveedor: true,
      pagoExternoSesion: true,
      pagoExternoPago: true,
    },
    orderBy: { pagoFechaDeclarado: 'desc' },
    take: 3,
  });

  for (const pago of pendientes) {
    const { veredicto, idExterno } =
      pasarela === 'fintoc' ? await consultarFintoc(pago) : await consultarMercadoPago(pago);

    // Se guarda antes de cerrar el cobro: si algo falla mas abajo, al menos
    // queda por donde seguirle la pista al dinero.
    if (idExterno && idExterno !== pago.pagoExternoPago) {
      await prisma.pago.update({
        where: { pagoId: pago.pagoId },
        data: { pagoExternoPago: idExterno, modifiedBy: USUARIO_SISTEMA_ID },
      });
    }

    if (veredicto === 'cobrado') {
      const resultado = await confirmarPagoYEmitir(pago.pagoId, USUARIO_SISTEMA_ID);
      return { pagado: true, codigo: resultado.codigo, reciencerrado: true };
    }

    if (veredicto === 'fallido') {
      await prisma.pago.update({
        where: { pagoId: pago.pagoId },
        data: {
          pagoEstado: 'rechazado',
          pagoMotivoRechazo: 'El pago en línea no se completó.',
          pagoFechaRevisado: new Date(),
          modifiedBy: USUARIO_SISTEMA_ID,
        },
      });
    }
  }

  return { pagado: false, reciencerrado: false };
}
