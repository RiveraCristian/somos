/**
 * Normalizacion de telefonos chilenos.
 *
 * El telefono dejo de ser un dato de contacto y paso a ser la credencial de
 * invitacion: es lo que decide si alguien puede comprar y cuantas entradas
 * lleva. Por eso tiene que guardarse siempre igual — si la misma persona entra
 * una vez como "9 6733 1258" y otra como "+56967331258", el tope de dos
 * entradas por numero se puede saltar sin querer.
 *
 * Formato canonico: +56 seguido de nueve digitos, sin espacios.
 */

/** Lo que acepta la restriccion chk_invitado_telefono_formato en la base. */
export const FORMATO_TELEFONO = /^\+56[0-9]{9}$/;

/**
 * Lleva lo que sea que haya escrito la persona al formato canonico.
 *
 * Devuelve null si no se puede interpretar con confianza. No se adivina: un
 * numero mal deducido deja a alguien fuera de la lista sin explicacion.
 */
export function normalizarTelefono(entrada: string | null | undefined): string | null {
  if (!entrada) return null;

  const digitos = String(entrada).replace(/\D/g, '');

  // 56 9 6733 1258 — ya trae el codigo de pais.
  if (digitos.length === 11 && digitos.startsWith('56')) {
    return `+${digitos}`;
  }

  // 0 9 6733 1258 — el cero de larga distancia que todavia se escribe.
  if (digitos.length === 10 && digitos.startsWith('0')) {
    return `+56${digitos.slice(1)}`;
  }

  // 9 6733 1258 — lo mas comun: sin codigo de pais.
  if (digitos.length === 9) {
    return `+56${digitos}`;
  }

  return null;
}

/** "+56967331258" → "+56 9 6733 1258" */
export function formatearTelefono(telefono: string | null | undefined): string {
  if (!telefono) return '';
  if (!FORMATO_TELEFONO.test(telefono)) return telefono;

  const n = telefono.slice(3);
  return `+56 ${n.slice(0, 1)} ${n.slice(1, 5)} ${n.slice(5)}`;
}

/** Oculta el medio del numero: "+56 9 •••• 1258". Para pantallas compartidas. */
export function telefonoParcial(telefono: string | null | undefined): string {
  if (!telefono || !FORMATO_TELEFONO.test(telefono)) return '';
  const n = telefono.slice(3);
  return `+56 ${n.slice(0, 1)} •••• ${n.slice(5)}`;
}
