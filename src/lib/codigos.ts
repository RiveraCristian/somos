import { createHash, randomBytes, randomInt } from 'node:crypto';

/**
 * Alfabeto sin caracteres ambiguos: no lleva 0/O ni 1/I/L.
 * Los codigos se tipean a mano en la puerta cuando la camara falla.
 */
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Token secreto para URLs privadas (link de seguimiento, payload del QR). */
export function generarToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Codigo legible de entrada: "SOMOS-7K4M2P" */
export function generarCodigoEntrada(prefijo = 'SOMOS'): string {
  let cuerpo = '';
  for (let i = 0; i < 6; i += 1) {
    cuerpo += ALFABETO[randomInt(ALFABETO.length)];
  }
  return `${prefijo}-${cuerpo}`;
}

/** Hash de un solo sentido para guardar tokens de sesion en la base. */
export function hashearToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Normaliza lo que llega del escaner o del input de puerta.
 * Acepta el codigo pelado ("somos-7k4m2p"), la URL completa de la entrada
 * ("https://.../entrada/<token>") o el token suelto.
 */
export function normalizarLectura(valor: string): string {
  const limpio = valor.trim();

  // Si viene una URL, se queda con el ultimo segmento.
  if (/^https?:\/\//i.test(limpio)) {
    try {
      const url = new URL(limpio);
      const segmentos = url.pathname.split('/').filter(Boolean);
      return segmentos[segmentos.length - 1] ?? limpio;
    } catch {
      return limpio;
    }
  }

  return limpio;
}

/** Los codigos legibles se guardan y comparan siempre en mayusculas. */
export function esCodigoLegible(valor: string): boolean {
  return /^[A-Z]+-[0-9A-Z]{6}$/.test(valor.toUpperCase());
}
