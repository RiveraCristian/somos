import { USUARIO_SISTEMA_ID } from '@/lib/constantes';
import { confirmarPagoYEmitir } from '@/lib/emision';
import { obtenerEstadoFlow, pagoFlowFallido, pagoFlowPagado } from '@/lib/flow';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Confirmacion de pago de Flow.
 *
 * Flow hace POST (form-urlencoded) de un unico campo `token`. No viene firmado:
 * cualquiera que conozca esta URL puede llamarla con cualquier token. Por eso
 * aca NO se le cree nada al que llama — el token solo sirve para ir a
 * preguntarle a Flow, con nuestra apiKey y nuestra firma, que paso de verdad.
 *
 * Dicho de otra forma: esto no es una notificacion que se procesa, es un aviso
 * de "anda a mirar". Un atacante que invente tokens no logra mas que hacernos
 * consultar a Flow y recibir un "no existe".
 */
export async function POST(peticion: Request) {
  let token = '';

  try {
    const formulario = await peticion.formData();
    token = String(formulario.get('token') ?? '');
  } catch {
    // Flow manda form-urlencoded, pero si algun dia cambia a JSON esto evita
    // que el webhook se caiga entero.
    try {
      const json = (await peticion.clone().json()) as { token?: string };
      token = String(json.token ?? '');
    } catch {
      /* se queda vacio y se rechaza abajo */
    }
  }

  if (!token) {
    return new Response('Falta el token', { status: 400 });
  }

  // El pago tiene que existir de nuestro lado: la orden la creamos nosotros y
  // guardamos el token al crearla. Un token que no reconocemos no se procesa.
  const pago = await prisma.pago.findFirst({
    where: { pagoExternoSesion: token, pagoProveedor: 'flow', isDeleted: false },
  });

  if (!pago) {
    // 200 a proposito: si devolvieramos error, Flow reintentaria para siempre
    // un token que nunca vamos a reconocer.
    return Response.json({ recibido: true, desconocido: true });
  }

  const estado = await obtenerEstadoFlow(token);

  if (!estado) {
    // Acá sí conviene el error: Flow reintenta y puede que a la segunda
    // responda. Es la diferencia entre "no te conozco" y "no pude preguntar".
    return new Response('No se pudo consultar el estado en Flow', { status: 503 });
  }

  // El monto lo fijamos nosotros al crear la orden, pero se vuelve a comparar:
  // es barato y cierra la puerta a emitir una entrada por un pago menor.
  if (pagoFlowPagado(estado) && estado.amount < pago.pagoMonto) {
    await prisma.pago.update({
      where: { pagoId: pago.pagoId },
      data: {
        pagoEstado: 'rechazado',
        pagoMotivoRechazo: `Flow confirmo $${estado.amount} y la entrada vale $${pago.pagoMonto}.`,
        pagoFechaRevisado: new Date(),
        modifiedBy: USUARIO_SISTEMA_ID,
      },
    });
    return Response.json({ recibido: true, montoDistinto: true });
  }

  // Deduplicado por token + estado: Flow puede avisar varias veces del mismo
  // pago, pero un cambio de estado posterior si tiene que procesarse.
  const llaveEvento = `flow:${token}:${estado.status}`;

  try {
    await prisma.webhook.create({
      data: {
        webhookProveedor: 'flow',
        webhookEventoId: llaveEvento,
        webhookTipo: `payment.status.${estado.status}`,
        webhookPayload: estado as unknown as object,
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') {
      return Response.json({ recibido: true, repetido: true });
    }
    throw e;
  }

  if (pagoFlowPagado(estado)) {
    await prisma.pago.update({
      where: { pagoId: pago.pagoId },
      data: {
        pagoExternoPago: String(estado.flowOrder),
        // El medio real (webpay, servipag, etc.) solo se sabe despues de pagar.
        pagoMensaje: estado.paymentData?.media ?? null,
      },
    });

    await confirmarPagoYEmitir(pago.pagoId, USUARIO_SISTEMA_ID);
    return Response.json({ recibido: true, pagado: true });
  }

  if (pagoFlowFallido(estado)) {
    await prisma.pago.update({
      where: { pagoId: pago.pagoId },
      data: {
        pagoEstado: 'rechazado',
        pagoMotivoRechazo:
          estado.status === 4 ? 'El pago se anuló en Flow.' : 'Flow rechazó el pago.',
        pagoFechaRevisado: new Date(),
        modifiedBy: USUARIO_SISTEMA_ID,
      },
    });
    return Response.json({ recibido: true, fallido: true });
  }

  // Sigue pendiente (status 1): no se toca nada y se espera el proximo aviso.
  return Response.json({ recibido: true, pendiente: true });
}
