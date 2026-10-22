/**
 * Normalizacion de telefonos.
 *
 * El telefono dejo de ser un dato de contacto y paso a ser la credencial de
 * invitacion: es lo que decide si alguien puede comprar. Por eso tiene que
 * guardarse siempre igual — si la misma persona entra una vez como
 * "9 6733 1258" y otra como "+56967331258", su cupo se puede saltar sin querer.
 *
 * Formato canonico: E.164. Un "+" y de 8 a 15 digitos, sin espacios. La
 * mayoria son chilenos (+56 y nueve digitos), pero la lista de invitados tiene
 * gente fuera de Chile y un formato solo-chileno los dejaba afuera.
 */

/** Lo que acepta la restriccion chk_invitado_telefono_formato en la base. */
export const FORMATO_TELEFONO = /^\+[1-9][0-9]{7,14}$/;

/**
 * Los chilenos tienen tratamiento propio: son la enorme mayoria y su regla es
 * mas estricta que E.164. Todo celular chileno es un 9 seguido de ocho
 * digitos; la lista de invitados sale de un grupo de WhatsApp, asi que todos
 * lo son.
 *
 * Revisarlo importa porque si no, un numero chileno mal escrito —"+56 9 6733
 * 125", con un digito de menos— cumple igual la regla internacional y se
 * guarda como si fuera de otro pais. La persona nunca calza con su invitacion
 * y nadie entiende por que.
 */
const FORMATO_CHILENO = /^\+569[0-9]{8}$/;

/**
 * Lleva lo que sea que haya escrito la persona al formato canonico.
 *
 * La regla que decide todo: si el numero NO trae codigo de pais explicito
 * —ni "+" ni "00"— se asume chileno. Adivinar el pais de una ristra de
 * digitos sueltos es imposible sin equivocarse: "912345678" son nueve digitos
 * validos en Chile y tambien el comienzo de un numero de otro lado.
 *
 * Devuelve null si no se puede interpretar con confianza. No se adivina: un
 * numero mal deducido deja a alguien fuera de la lista sin explicacion.
 */
export function normalizarTelefono(entrada: string | null | undefined): string | null {
  if (!entrada) return null;

  const texto = String(entrada).trim();
  let candidato: string;

  // --- Con codigo de pais explicito ---------------------------------------
  // "+44 7737 540326" o "0044 7737 540326". El 00 es el prefijo internacional
  // que se marca desde un fijo y que mucha gente escribe por costumbre.
  const internacional = /^(?:\+|00)(.+)$/.exec(texto);
  if (internacional) {
    candidato = `+${internacional[1].replace(/\D/g, '')}`;
  } else {
    // --- Sin codigo de pais: se asume Chile -------------------------------
    const digitos = texto.replace(/\D/g, '');

    if (digitos.length === 11 && digitos.startsWith('56')) {
      // 56 9 6733 1258 — trae el codigo pero sin el "+".
      candidato = `+${digitos}`;
    } else if (digitos.length === 10 && digitos.startsWith('0')) {
      // 0 9 6733 1258 — el cero de larga distancia que todavia se escribe.
      candidato = `+56${digitos.slice(1)}`;
    } else if (digitos.length === 9) {
      // 9 6733 1258 — lo mas comun.
      candidato = `+56${digitos}`;
    } else {
      return null;
    }
  }

  if (!FORMATO_TELEFONO.test(candidato)) return null;

  // Si quedo como chileno, se le exige la regla chilena y no solo la
  // internacional. Sin esto, un RUT pegado en el campo ("12.345.678-9") sale
  // convertido en "+56123456789", que parece un telefono y no lo es.
  if (candidato.startsWith('+56') && !FORMATO_CHILENO.test(candidato)) return null;

  return candidato;
}

/** ¿Es chileno? Define si se muestra con el formato bonito de siempre. */
export function esChileno(telefono: string | null | undefined): boolean {
  return Boolean(telefono && FORMATO_CHILENO.test(telefono));
}

/**
 * "+56967331258" → "+56 9 6733 1258"
 *
 * Los de otros paises se muestran tal cual se guardaron. Agruparles los
 * digitos exigiria saber cuantos ocupa su codigo de pais —entre uno y tres— y
 * separarlo mal se ve peor que no separarlo.
 */
export function formatearTelefono(telefono: string | null | undefined): string {
  if (!telefono) return '';
  if (!esChileno(telefono)) return telefono;

  const n = telefono.slice(3);
  return `+56 ${n.slice(0, 1)} ${n.slice(1, 5)} ${n.slice(5)}`;
}

/** Oculta el medio del numero: "+56 9 •••• 1258". Para pantallas compartidas. */
export function telefonoParcial(telefono: string | null | undefined): string {
  if (!telefono || !FORMATO_TELEFONO.test(telefono)) return '';

  if (esChileno(telefono)) {
    const n = telefono.slice(3);
    return `+56 ${n.slice(0, 1)} •••• ${n.slice(5)}`;
  }

  // Para el resto: se dejan a la vista los ultimos cuatro, que es lo que sirve
  // para reconocer el propio numero, y se tapa todo lo demas.
  return `${telefono.slice(0, 3)}•••••${telefono.slice(-4)}`;
}
