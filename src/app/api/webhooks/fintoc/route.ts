import { USUARIO_SISTEMA_ID } from '@/lib/constantes';
import { confirmarPagoYEmitir } from '@/lib/emision';
import { validarFirmaWebhook } from '@/lib/fintoc';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Eventos que significan "la plata entro". */
const EVENTOS_PAGADO = new Set(['checkout_session.finished', 'payment_intent.succeeded']);

/** Eventos que significan "esto no va a llegar nunca". */
const EVENTOS_FALLIDOS = new Set([
  'checkout_session.expired',
  'payment_intent.expired',
  'payment_intent.failed',
  'payment_intent.rejected',
]);

type EventoFintoc = {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> } | Record<string, unknown>;
};

/** Saca el objeto del evento, tolerando que venga en `data.object` o en `data`. */
function objetoDelEvento(evento: EventoFintoc): Record<string, unknown> {
  const datos = evento.data as { object?: Record<string, unknown> } | undefined;
  if (datos && typeof datos === 'object' && 'object' in datos && datos.object) {
    return datos.object;
  }
  return (evento.data as Record<string, unknown>) ?? {};
}

/**
 * Webhook de Fintoc.
 *
 * Esta es la unica fuente de verdad de un cobro en linea: el retorno del
 * comprador al sitio es solo cosmetico y no se le cree.
 */
export async function POST(peticion: Request) {
  // El cuerpo se lee como texto crudo a proposito: la firma se calcula sobre
  // los bytes exactos que llegaron, y volver a serializar el JSON la rompe.
  const cuerpoCrudo = await peticion.text();
  const firma = peticion.headers.get('fintoc-signature');

  if (!validarFirmaWebhook(cuerpoCrudo, firma)) {
    return new Response('Firma invalida', { status: 401 });
  }

  let evento: EventoFintoc;
  try {
    evento = JSON.parse(cuerpoCrudo) as EventoFintoc;
  } catch {
    return new Response('Cuerpo no es JSON', { status: 400 });
  }

  const eventoId = evento.id;
  const tipo = evento.type ?? 'desconocido';

  if (!eventoId) {
    return new Response('Evento sin id', { status: 400 });
  }

  // El id se guarda prefijado para que dos pasarelas no puedan chocar entre si.
  const llaveEvento = `fintoc:${eventoId}`;

  // Deduplicacion: Fintoc reenvia eventos. El UNIQUE de la tabla es la barrera.
  try {
    await prisma.webhook.create({
      data: {
        webhookProveedor: 'fintoc',
        webhookEventoId: llaveEvento,
        webhookTipo: tipo,
        webhookPayload: JSON.parse(cuerpoCrudo),
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') {
      // Ya lo procesamos antes. Se responde 200 para que deje de reintentar.
      return Response.json({ recibido: true, duplicado: true });
    }
    throw e;
  }

  async function cerrar(procesado: boolean, error?: string) {
    await prisma.webhook.update({
      where: { webhookEventoId: llaveEvento },
      data: { webhookProcesado: procesado, webhookError: error?.slice(0, 500) ?? null },
    });
  }

  if (!EVENTOS_PAGADO.has(tipo) && !EVENTOS_FALLIDOS.has(tipo)) {
    await cerrar(true, `Evento ignorado: ${tipo}`);
    return Response.json({ recibido: true, ignorado: true });
  }

  const objeto = objetoDelEvento(evento);

  // Segun el evento, el objeto es la checkout session o el payment intent. El
  // pago se guardo con el id de la sesion, asi que se busca por cualquiera de
  // los dos caminos.
  const idObjeto = typeof objeto.id === 'string' ? objeto.id : null;
  const idSesion =
    typeof objeto.checkout_session === 'string'
      ? objeto.checkout_session
      : idObjeto?.startsWith('cs_')
        ? idObjeto
        : null;

  const pago = await prisma.pago.findFirst({
    where: {
      isDeleted: false,
      pagoProveedor: 'fintoc',
      OR: [
        ...(idSesion ? [{ pagoExternoSesion: idSesion }] : []),
        ...(idObjeto ? [{ pagoExternoPago: idObjeto }] : []),
      ],
    },
    include: { asistente: { select: { asistenteToken: true } } },
  });

  if (!pago) {
    // Puede ser un cobro de otro sistema o una prueba desde el panel de Fintoc.
    await cerrar(true, `Sin pago asociado (sesion ${idSesion ?? '—'})`);
    return Response.json({ recibido: true, sinPago: true });
  }

  try {
    if (EVENTOS_FALLIDOS.has(tipo)) {
      if (pago.pagoEstado === 'pendiente') {
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
      await cerrar(true);
      return Response.json({ recibido: true, resultado: 'no_completado' });
    }

    // Guarda el payment intent si viene, para poder rastrear el cobro despues.
    const intent = (objeto.payment_resource as { payment_intent?: { id?: string } } | undefined)
      ?.payment_intent?.id;

    if (intent && !pago.pagoExternoPago) {
      await prisma.pago.update({
        where: { pagoId: pago.pagoId },
        data: { pagoExternoPago: intent, modifiedBy: USUARIO_SISTEMA_ID },
      });
    }

    const resultado = await confirmarPagoYEmitir(pago.pagoId, USUARIO_SISTEMA_ID);
    await cerrar(true);

    return Response.json({
      recibido: true,
      resultado: 'confirmado',
      entrada: resultado.codigo,
    });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Error desconocido';
    await cerrar(false, mensaje);
    console.error('[webhook fintoc] fallo procesando', eventoId, mensaje);
    // 500 para que Fintoc lo reintente: el evento quedo guardado y marcado.
    return new Response('Error procesando el evento', { status: 500 });
  }
}
