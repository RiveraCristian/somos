import { intentoDeCobroMp, sincronizarIntentoMp } from '@/lib/cobro-mercadopago';
import { obtenerPagoMp, validarFirmaWebhookMp } from '@/lib/mercadopago';
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
 * La notificacion no trae el estado del pago: solo el id del recurso. Hay que
 * ir a preguntarlo, y eso es bueno — el estado lo dicta la API, no un cuerpo
 * que podria venir manipulado. La firma solo prueba que el aviso viene de
 * Mercado Pago; lo que se hace con el lo decide `sincronizarIntentoMp`.
 *
 * Respuestas: 2xx cuando no hay nada que reintentar (procesado, duplicado, no
 * es nuestro), 401 con firma mala, y 500 cuando fallo algo de nuestro lado y
 * conviene que Mercado Pago lo reintente.
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

  const tipo = notificacion.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic') ?? '';
  // La firma se calcula sobre el `data.id` de la query: ese es el que manda.
  const idRecurso = String(
    url.searchParams.get('data.id') ?? notificacion.data?.id ?? url.searchParams.get('id') ?? '',
  );

  if (!idRecurso) {
    return new Response('Notificacion sin id de recurso', { status: 400 });
  }

  const valida = validarFirmaWebhookMp({
    idRecurso,
    cabeceraFirma: peticion.headers.get('x-signature'),
    cabeceraRequestId: peticion.headers.get('x-request-id'),
  });

  if (!valida) {
    console.warn('[webhook mercadopago] firma invalida para el recurso', idRecurso);
    return new Response('Firma invalida', { status: 401 });
  }

  // Solo interesan los pagos. Si en el panel se marcan otros eventos (por
  // ejemplo ordenes), se acusan recibo y se ignoran.
  if (tipo !== 'payment') {
    return Response.json({ recibido: true, ignorado: true, tipo });
  }

  // Cada notificacion trae su propio id: un cobro aprobado y despues devuelto
  // son dos avisos distintos del mismo recurso, y los dos hay que procesarlos.
  const idNotificacion =
    notificacion.id ?? peticion.headers.get('x-request-id') ?? `${idRecurso}:${notificacion.action ?? tipo}`;
  const llaveEvento = `mercadopago:${idNotificacion}`.slice(0, 160);

  try {
    await prisma.webhook.create({
      data: {
        webhookProveedor: 'mercadopago',
        webhookEventoId: llaveEvento,
        webhookTipo: (notificacion.action ?? tipo).slice(0, 80),
        webhookPayload: cuerpoCrudo ? JSON.parse(cuerpoCrudo) : { query: url.search },
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code !== 'P2002') throw e;

    // Ya llego antes. Si se proceso, listo. Si fallo, este es el reintento que
    // Mercado Pago manda justamente para eso, y hay que procesarlo: devolver
    // "duplicado" aca dejaria el cobro colgado para siempre.
    const previo = await prisma.webhook.findUnique({ where: { webhookEventoId: llaveEvento } });
    if (previo?.webhookProcesado) {
      return Response.json({ recibido: true, duplicado: true });
    }
  }

  async function cerrar(procesado: boolean, error?: string) {
    await prisma.webhook.update({
      where: { webhookEventoId: llaveEvento },
      data: { webhookProcesado: procesado, webhookError: error?.slice(0, 500) ?? null },
    });
  }

  try {
    const cobro = await obtenerPagoMp(idRecurso);

    if (!cobro) {
      // Mercado Pago no lo conoce con nuestras credenciales: no es nuestro.
      await cerrar(true, `Mercado Pago no conoce el pago ${idRecurso}`);
      return Response.json({ recibido: true, sinPago: true });
    }

    const intento = await intentoDeCobroMp(cobro);

    if (!intento) {
      // Puede ser un cobro de otra integracion o una prueba desde el panel.
      await cerrar(true, `Sin intento asociado (referencia ${cobro.external_reference ?? 'vacia'})`);
      return Response.json({ recibido: true, sinPago: true });
    }

    const resultado = await sincronizarIntentoMp(intento.pagoId, cobro);
    await cerrar(true, resultado.estado === 'confirmado' ? undefined : `Estado ${resultado.estado}`);

    return Response.json({ recibido: true, resultado: resultado.estado });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Error desconocido';
    await cerrar(false, mensaje);
    console.error('[webhook mercadopago] fallo procesando', idRecurso, mensaje);
    // 500 para que Mercado Pago lo reintente.
    return new Response('Error procesando la notificacion', { status: 500 });
  }
}
