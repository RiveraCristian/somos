/**
 * La ubicacion del recinto es secreta hasta que alguien tiene su entrada.
 *
 * El sitio publico muestra la ciudad y nada mas; las coordenadas, la direccion
 * y el nombre del recinto viven en la tabla `eventos` y solo los leen las
 * vistas que ya exigieron una entrada valida. Este modulo existe para que
 * armar los enlaces del mapa sea una sola decision y no se repita —mal— en
 * cada pantalla.
 */

export type Ubicacion = {
  mapaUrl: string | null;
  direccion: string | null;
  latitud?: number | null;
  longitud?: number | null;
  venue?: string | null;
  ciudad: string;
};

/** Lo que se muestra en el sitio publico en lugar del lugar real. */
export const UBICACION_SECRETA = 'Ubicación secreta';

/** Coordenadas utiles, o null. Descarta el (0,0) que deja un campo a medio llenar. */
export function coordenadas(u: Ubicacion): { lat: number; lon: number } | null {
  const lat = u.latitud;
  const lon = u.longitud;

  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat === 0 && lon === 0) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  return { lat, lon };
}

/** "-35.438877, -71.602657" — para copiar y pegar en cualquier navegador. */
export function coordenadasTexto(u: Ubicacion): string | null {
  const c = coordenadas(u);
  return c ? `${c.lat.toFixed(6)}, ${c.lon.toFixed(6)}` : null;
}

/** true si hay con que decirle a alguien donde es. */
export function hayUbicacion(u: Ubicacion): boolean {
  return Boolean(u.direccion) || coordenadas(u) !== null;
}

/**
 * Enlace a Google Maps.
 *
 * Orden de preferencia:
 *   1. El enlace que pego el organizador, si lo hay.
 *   2. Las coordenadas: llevan al punto exacto.
 *   3. La direccion como busqueda de texto, que es lo menos confiable —el
 *      recinto es rural y una busqueda puede caer a kilometros.
 *
 * Devuelve null si no hay con que armarlo, y tambien si el enlace guardado no
 * es http(s): ese campo lo escribe una persona y termina en un href.
 */
export function enlaceDeMapa(u: Ubicacion): string | null {
  if (u.mapaUrl && /^https?:\/\//i.test(u.mapaUrl.trim())) {
    return u.mapaUrl.trim();
  }

  const c = coordenadas(u);
  if (c) {
    return `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lon}`;
  }

  if (!u.direccion) return null;

  const consulta = [u.venue, u.direccion, u.ciudad, 'Chile'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}

/**
 * Enlace de navegacion en Waze.
 *
 * Solo con coordenadas: Waze buscando por texto en un camino rural es
 * justamente donde falla. Va al lado de Google Maps porque en Chile mucha
 * gente navega con Waze y de noche, en el campo, no es un detalle menor.
 */
export function enlaceDeWaze(u: Ubicacion): string | null {
  const c = coordenadas(u);
  return c ? `https://waze.com/ul?ll=${c.lat},${c.lon}&navigate=yes` : null;
}

/**
 * Lee un par de coordenadas escrito a mano.
 *
 * Acepta lo que uno copia de Google Maps: "-35.438877, -71.602657", con o sin
 * espacio, con coma o con espacio de separador. Un solo campo y no dos, porque
 * las coordenadas se copian de a pares y separarlas invita a pegar una en la
 * casilla de la otra.
 *
 * Devuelve null si el texto esta vacio, y `false` si trae algo que no se
 * entiende: al guardar hay que distinguir "no puso nada" de "puso cualquier
 * cosa", porque lo segundo manda a la gente a otro continente.
 */
export function parsearCoordenadas(
  texto: string | null | undefined,
): { lat: number; lon: number } | null | false {
  const limpio = (texto ?? '').trim();
  if (!limpio) return null;

  const m = /^(-?\d{1,3}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/.exec(limpio);
  if (!m) return false;

  // Se acepta la coma decimal, pero solo cuando no es la que separa el par.
  const lat = Number(m[1].replace(',', '.'));
  const lon = Number(m[2].replace(',', '.'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  // (0,0) es el Golfo de Guinea: siempre es un campo a medio llenar, nunca un
  // recinto. Se rechaza aca para que el panel lo diga, en vez de guardarlo y
  // que la entrada muestre "ubicacion por definir" sin explicar por que.
  if (lat === 0 && lon === 0) return false;

  return { lat, lon };
}
