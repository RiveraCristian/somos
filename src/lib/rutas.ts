/**
 * Prefijo de las rutas del sitio.
 *
 * En el sitio real es vacio: todo cuelga de la raiz del dominio. En la vitrina
 * estatica de GitHub Pages, en cambio, el sitio vive en /somos, y los archivos
 * de `public/` hay que pedirlos con ese prefijo.
 *
 * Next agrega el basePath solo a lo suyo (los chunks de `_next`, el favicon del
 * app router). Un `src="/logo.png"` escrito a mano no lo lleva — y con
 * `images.unoptimized` tampoco se lo pone `next/image`. De ahi este helper.
 *
 * Va con NEXT_PUBLIC_ a proposito: es una constante de compilacion que tiene
 * que quedar igual en el servidor y en el navegador, y no es un secreto.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Ruta a un archivo de `public/`, con el prefijo que corresponda. */
export function recurso(ruta: string): string {
  return `${BASE_PATH}${ruta}`;
}
