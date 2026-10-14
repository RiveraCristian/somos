/**
 * Publicaciones de Instagram que se muestran en la portada.
 *
 * No se lee el feed de la cuenta: Meta apago la Instagram Basic Display API en
 * diciembre de 2024, y su reemplazo exige cuenta Profesional, una app propia y
 * un token que caduca cada 60 dias. Para un sitio que corre una noche, eso es
 * una pieza que se rompe sola justo cuando nadie la esta mirando.
 *
 * Los embeds oficiales no piden nada de eso y funcionan con cualquier post
 * publico, que es el caso. A cambio, los posts se eligen a mano.
 */

export const TIPOS_PUBLICACION = ['p', 'reel', 'tv'] as const;
export type TipoPublicacion = (typeof TIPOS_PUBLICACION)[number];

export type Publicacion = { codigo: string; tipo: string };

/**
 * Saca el shortcode y el tipo de lo que sea que pegue el organizador.
 *
 * Acepta la URL completa con o sin parametros (los links copiados desde la app
 * traen un `?igsh=` que no sirve para nada), la URL sin protocolo, y tambien el
 * shortcode suelto. Devuelve null si no se reconoce.
 *
 * Se guarda el codigo y no la URL a proposito: el permalink lo arma el
 * servidor. Guardar lo que venga dejaria que la portada embeba cualquier cosa.
 */
export function leerPublicacion(entrada: string | null | undefined): Publicacion | null {
  const texto = (entrada ?? '').trim();
  if (!texto) return null;

  // URL de Instagram, en cualquiera de sus formas.
  const deUrl = /(?:instagram\.com)\/(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,30})/i.exec(texto);
  if (deUrl) {
    // "reels" (plural) aparece en algunos links compartidos; el permalink que
    // acepta el embed es el singular.
    const tipo = deUrl[1].toLowerCase() === 'reels' ? 'reel' : deUrl[1].toLowerCase();
    return { codigo: deUrl[2], tipo };
  }

  // Shortcode suelto. Se asume post: es lo que se pega el 99% de las veces, y
  // si fuera un reel el permalink de /p/ igual resuelve.
  if (/^[A-Za-z0-9_-]{5,30}$/.test(texto)) {
    return { codigo: texto, tipo: 'p' };
  }

  return null;
}

/** El permalink canonico, que es lo que lee el script de embeds de Instagram. */
export function permalinkDe({ codigo, tipo }: Publicacion): string {
  const seguro = TIPOS_PUBLICACION.includes(tipo as TipoPublicacion) ? tipo : 'p';
  return `https://www.instagram.com/${seguro}/${codigo}/`;
}
