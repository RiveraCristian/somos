import QRCode from 'qrcode';

/**
 * El QR nunca lleva el codigo legible: lleva la URL de la entrada, que
 * termina en el token secreto. Asi un codigo visto de reojo en el ticket
 * de otra persona no sirve para nada.
 */
export function urlDeEntrada(token: string): string {
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/entrada/${token}`;
}

const OPCIONES_BASE = {
  errorCorrectionLevel: 'M' as const,
  margin: 1,
  color: {
    dark: '#05060A',
    light: '#FFFFFF',
  },
};

/** QR listo para incrustar en un <img src="..."> del navegador. */
export async function qrComoDataUrl(texto: string, ancho = 440): Promise<string> {
  return QRCode.toDataURL(texto, { ...OPCIONES_BASE, width: ancho });
}

/** QR como PNG, para adjuntarlo al correo. */
export async function qrComoPng(texto: string, ancho = 720): Promise<Buffer> {
  return QRCode.toBuffer(texto, { ...OPCIONES_BASE, width: ancho, type: 'png' });
}
