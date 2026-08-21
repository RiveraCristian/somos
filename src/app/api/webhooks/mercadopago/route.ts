import { USUARIO_SISTEMA_ID } from '@/lib/constantes';
import { confirmarPagoYEmitir } from '@/lib/emision';
import {
  obtenerPagoMercadoPago,
  pagoAprobado,
  pagoFallido,
  validarFirmaWebhookMp,
} from '@/lib/mercadopago';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type NotificacionMp = {
  id?: number | string;
  type?: string;
  action?: string;
  data?: { id?: string | number };
};

/**
 * Webhook de Mercado Pago.
 *
 * A diferencia de Fintoc, la notificacion no trae el estado del pago: solo el id
 * del recurso. Hay que ir a preguntarlo, y eso es bueno — el estado lo dicta la
 * API, no un cuerpo que podria venir manipulado.
 */
export async function POST(peticion: Request) {
  const url = new URL(peticion.url);
  const cuerpoCrudo = await peticion.text();

  let notificacion: NotificacionMp = {};
  try {
    notificacion = cuerpoCrudo ? (JSON.parse(cuerpoCrudo) as NotificacionMp) : {};
  } catch {
    // Mercado Pago tambien notifica con todo en la query; no es un error.
  }

  const tipo = notificacion.type ?? url.searchParams.get('type') ?? '';
  const idRecurso = String(notificacion.data?.id ?? url.searchParams.get('data.id') ?? '');

  if (!idRecurso) {
    return new Response('Notificacion sin id de recurso', { status: 400 });
  }

  // La firma se calcula sobre el id del recurso, no sobre el cuerpo.
  const valida = validarFirmaWebhookMp({
    idRecurso,
    cabeceraFirma: peticion.headers.get('x-signature'),
    cabeceraRequestId: peticion.headers.get('x-request-id'),
  });

  if (!valida) {
    return new Response('Firma invalida', { status: 401 });
  }

  // Solo interesan los pagos.
  if (tipo !== 'payment') {
    return Response.json({ recibido: true, ignorado: true, tipo });
  }

  // Mercado Pago manda varias notificaciones por el mismo pago (created,
  // updated). Se deduplica por recurso + accion, no solo por recurso: una
  // aprobacion posterior a la creacion si tiene que procesarse.
  const llaveEvento = `mercadopago:${idRecurso}:${notificacion.action ?? tipo}`;

  try {
    await prisma.webhook.create({
      data: {
        webhookProveedor: 'mercadopago',
        webhookEventoId: llaveEvento,
        webhookTipo: notificacion.action ?? tipo,
        webhookPayload: cuerpoCrudo ? JSON.parse(cuerpoCrudo) : { query: url.search },
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') {
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

  const pago = await prisma.pago.findFirst({
    where: { isDeleted: false, pagoProveedor: 'mercadopago', pagoExternoPago: idRecurso },
    include: { asistente: { select: { asistenteToken: true } } },
  });

  if (!pago) {
    // Puede ser un cobro de otra integracion o una prueba desde el panel.
    await cerrar(true, `Sin pago asociado (recurso ${idRecurso})`);
    return Response.json({ recibido: true, sinPago: true });
  }

  try {
    const cobro = await obtenerPagoMercadoPago(idRecurso);

    if (!cobro) {
      await cerrar(false, 'Mercado Pago no devolvio el pago');
      return new Response('No se pudo consultar el pago', { status: 500 });
    }

    if (pagoAprobado(cobro)) {
      const resultado = await confirmarPagoYEmitir(pago.pagoId, USUARIO_SISTEMA_ID);
      await cerrar(true);
      return Response.json({ recibido: true, resultado: 'confirmado', entrada: resultado.codigo });
    }

    if (pagoFallido(cobro) && pago.pagoEstado === 'pendiente') {
      await prisma.pago.update({
        where: { pagoId: pago.pagoId },
        data: {
          pagoEstado: 'rechazado',
          pagoMotivoRechazo: cobro.status_detail ?? 'El pago fue rechazado.',
          pagoFechaRevisado: new Date(),
          modifiedBy: USUARIO_SISTEMA_ID,
        },
      });
      await cerrar(true);
      return Response.json({ recibido: true, resultado: 'rechazado' });
    }

    await cerrar(true, `Estado ${cobro.status}, todavia sin resolver`);
    return Response.json({ recibido: true, resultado: 'en_curso', estado: cobro.status });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Error desconocido';
    await cerrar(false, mensaje);
    console.error('[webhook mercadopago] fallo procesando', idRecurso, mensaje);
    // 500 para que Mercado Pago lo reintente.
    return new Response('Error procesando la notificacion', { status: 500 });
  }
}
