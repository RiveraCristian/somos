import { Resend } from 'resend';

import { pesos } from './formato';

type Adjunto = { filename: string; content: Buffer };

type Envio = {
  para: string;
  asunto: string;
  html: string;
  adjuntos?: Adjunto[];
};

function habilitado(): boolean {
  return process.env.EMAIL_ENABLED === 'true' && Boolean(process.env.RESEND_API_KEY);
}

/**
 * Envia el correo por Resend.
 * Con EMAIL_ENABLED distinto de "true" no manda nada: deja el mensaje en la
 * consola del servidor. Sirve para desarrollar sin gastar envios ni configurar
 * un dominio.
 *
 * Nunca lanza: que falle un correo no puede tumbar una confirmacion de pago.
 */
export async function enviarCorreo({ para, asunto, html, adjuntos }: Envio): Promise<boolean> {
  if (!habilitado()) {
    console.info(
      `\n[correo simulado] para: ${para}\n[correo simulado] asunto: ${asunto}\n` +
        `[correo simulado] adjuntos: ${adjuntos?.map((a) => a.filename).join(', ') || 'ninguno'}\n` +
        '[correo simulado] Activa EMAIL_ENABLED="true" y RESEND_API_KEY para enviar de verdad.\n',
    );
    return false;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? 'SOMOS <onboarding@resend.dev>',
      to: [para],
      subject: asunto,
      html,
      attachments: adjuntos?.map((a) => ({
        filename: a.filename,
        content: a.content.toString('base64'),
      })),
    });

    if (error) {
      console.error('[correo] Resend devolvio un error:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[correo] No se pudo enviar:', e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------

const ESTILO_BASE = `
  margin:0;padding:32px 16px;background:#05060A;
  font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#EAF0FF;
`;

const ESTILO_TARJETA = `
  max-width:520px;margin:0 auto;background:#0E111B;border:1px solid rgba(234,240,255,0.10);
  border-radius:16px;overflow:hidden;
`;

function envoltorio(contenido: string): string {
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${ESTILO_BASE}">
  <div style="${ESTILO_TARJETA}">
    <div style="height:4px;background:linear-gradient(90deg,#00F0FF,#7B5CFF 52%,#FF2E9A);"></div>
    <div style="padding:28px 28px 0;text-align:center;">
      <img src="${base}/logo.png" alt="SOMOS" width="132" height="93"
           style="display:inline-block;width:132px;height:auto;border:0;">
    </div>
    <div style="padding:24px 28px 32px;">
      ${contenido}
    </div>
  </div>
  <p style="max-width:520px;margin:20px auto 0;text-align:center;font-size:11px;color:#4C5670;letter-spacing:1px;">
    SOMOS · este correo se envio automaticamente, no lo respondas.
  </p>
</body></html>`;
}

/** Correo con la entrada emitida. El QR va adjunto como PNG. */
export function plantillaEntrada(datos: {
  nombre: string;
  evento: string;
  tipoEntrada: string;
  codigo: string;
  url: string;
  montoPagado: number;
  fechaTexto: string | null;
  lugarTexto: string | null;
}): string {
  const filaFecha = datos.fechaTexto
    ? `<tr><td style="padding:6px 0;color:#808DA8;font-size:13px;">Cuando</td>
         <td style="padding:6px 0;text-align:right;font-size:13px;">${datos.fechaTexto}</td></tr>`
    : '';
  const filaLugar = datos.lugarTexto
    ? `<tr><td style="padding:6px 0;color:#808DA8;font-size:13px;">Donde</td>
         <td style="padding:6px 0;text-align:right;font-size:13px;">${datos.lugarTexto}</td></tr>`
    : '';

  return envoltorio(`
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;color:#00F0FF;text-transform:uppercase;">
      Pago confirmado
    </p>
    <h1 style="margin:0 0 14px;font-size:30px;line-height:1.1;letter-spacing:-0.5px;">
      Nos vemos en ${datos.evento}
    </h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#B7C0D6;">
      ${datos.nombre}, recibimos tu pago de <strong style="color:#EAF0FF;">${pesos(datos.montoPagado)}</strong>.
      Tu entrada ya esta emitida.
    </p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:6px 0;color:#808DA8;font-size:13px;">Tipo</td>
          <td style="padding:6px 0;text-align:right;font-size:13px;">${datos.tipoEntrada}</td></tr>
      <tr><td style="padding:6px 0;color:#808DA8;font-size:13px;">Codigo</td>
          <td style="padding:6px 0;text-align:right;font-family:monospace;font-size:14px;letter-spacing:2px;color:#00F0FF;">${datos.codigo}</td></tr>
      ${filaFecha}
      ${filaLugar}
    </table>

    <a href="${datos.url}"
       style="display:block;text-align:center;text-decoration:none;padding:16px;border-radius:999px;
              background:linear-gradient(100deg,#00F0FF,#7B5CFF 52%,#FF2E9A);color:#05060A;
              font-weight:bold;font-size:15px;">
      Ver mi entrada con QR
    </a>

    <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#808DA8;">
      El QR tambien va adjunto a este correo. Es de un solo uso: se quema al escanearlo
      en la puerta, asi que no se lo pases a nadie.
    </p>
  `);
}

/** Aviso de que el comprobante no cuadro. */
export function plantillaPagoRechazado(datos: {
  nombre: string;
  evento: string;
  monto: number;
  motivo: string;
  url: string;
}): string {
  return envoltorio(`
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;color:#FFC53D;text-transform:uppercase;">
      Pago no confirmado
    </p>
    <h1 style="margin:0 0 14px;font-size:26px;line-height:1.2;">Necesitamos revisar tu pago</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#B7C0D6;">
      ${datos.nombre}, no pudimos confirmar tu pago de
      <strong style="color:#EAF0FF;">${pesos(datos.monto)}</strong> para ${datos.evento}.
    </p>
    <p style="margin:0 0 24px;padding:14px 16px;border-radius:10px;background:rgba(255,197,61,0.08);
              border:1px solid rgba(255,197,61,0.28);font-size:14px;line-height:1.6;color:#FFC53D;">
      ${datos.motivo}
    </p>
    <a href="${datos.url}"
       style="display:block;text-align:center;text-decoration:none;padding:15px;border-radius:999px;
              border:1px solid rgba(234,240,255,0.2);color:#EAF0FF;font-weight:bold;font-size:15px;">
      Subir otro comprobante
    </a>
  `);
}

/** Confirmacion de que la entrada quedo reservada y falta pagarla. */
export function plantillaRegistro(datos: {
  nombre: string;
  evento: string;
  tipoEntrada: string;
  precio: number;
  url: string;
}): string {
  return envoltorio(`
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;color:#7B5CFF;text-transform:uppercase;">
      Entrada reservada
    </p>
    <h1 style="margin:0 0 14px;font-size:28px;line-height:1.15;">Falta un paso para ${datos.evento}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#B7C0D6;">
      ${datos.nombre}, te reservamos una entrada <strong style="color:#EAF0FF;">${datos.tipoEntrada}</strong>
      de <strong style="color:#EAF0FF;">${pesos(datos.precio)}</strong>. Entra a tu página y págala con tu banco, o transfiere y sube el
      comprobante para que emitamos tu QR.
    </p>
    <a href="${datos.url}"
       style="display:block;text-align:center;text-decoration:none;padding:16px;border-radius:999px;
              background:linear-gradient(100deg,#00F0FF,#7B5CFF 52%,#FF2E9A);color:#05060A;
              font-weight:bold;font-size:15px;">
      Pagar mi entrada
    </a>
    <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#808DA8;">
      Guarda este link: es tu pagina privada para pagar y ver tu entrada.
    </p>
  `);
}
