/**
 * La ubicacion del recinto es secreta hasta que alguien tiene su entrada.
 *
 * El sitio publico muestra la ciudad y nada mas; la direccion exacta vive en
 * `evento_direccion` y solo la leen las vistas que ya exigieron una entrada
 * valida. Este modulo existe para que armar el enlace del mapa sea una sola
 * decision y no se repita —mal— en cada pantalla.
 */

type Entrada = {
  mapaUrl: string | null;
  direccion: string | null;
  venue?: string | null;
  ciudad: string;
};

/** Lo que se muestra en el sitio publico en lugar del lugar real. */
export const UBICACION_SECRETA = 'Ubicación secreta';

/**
 * Enlace a Google Maps.
 *
 * Si el organizador pego un enlace propio (un pin exacto, que siempre es mejor
 * que una busqueda por texto) se respeta ese. Si no, se arma uno con la
 * direccion: vale mas un mapa aproximado que ningun mapa.
 *
 * Devuelve null si no hay con que armarlo, y tambien si el enlace guardado no
 * es http(s): ese campo lo escribe una persona y termina en un href.
 */
export function enlaceDeMapa({ mapaUrl, direccion, venue, ciudad }: Entrada): string | null {
  if (mapaUrl && /^https?:\/\//i.test(mapaUrl.trim())) {
    return mapaUrl.trim();
  }

  if (!direccion) return null;

  const consulta = [venue, direccion, ciudad, 'Chile'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}
