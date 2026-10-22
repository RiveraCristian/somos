#!/usr/bin/env node
/**
 * Saca números de teléfono chilenos de un pegote cualquiera y los deja listos
 * para la carga masiva de /admin/invitados.
 *
 *   node scripts/extraer-numeros.mjs exportacion.txt
 *   node scripts/extraer-numeros.mjs exportacion.txt > numeros.txt
 *
 * Sirve para la exportación de un chat de WhatsApp, para una lista pegada de
 * la pantalla de miembros del grupo, para una planilla copiada, o para lo que
 * sea: solo busca algo con forma de celular chileno y descarta el resto.
 *
 * Lo que NO hace, y conviene saberlo antes de confiar en el resultado: una
 * exportación de chat solo contiene a quien escribió alguna vez, y muestra el
 * nombre en vez del número cuando la persona está en tus contactos. O sea, de
 * un grupo de 200 van a salir bastantes menos. El contraste contra el total
 * del grupo hay que hacerlo a ojo; por eso el resumen va a stderr, para poder
 * mirarlo aunque se esté redirigiendo la salida a un archivo.
 */
import { readFileSync } from 'node:fs';

/**
 * Celular chileno: 9 dígitos que empiezan en 9, con o sin +56 delante, y con
 * cualquier basura de separación en medio (espacios, guiones, puntos).
 *
 * Se exige que alrededor no haya más dígitos para no morder un pedazo de algo
 * más largo: un RUT, un monto o un identificador no son teléfonos.
 */
const CHILENO = /(?<![\d+])(?:[+]?56[\s.\-]*)?(9(?:[\s.\-]*\d){8})(?![\d])/g;

/**
 * Número de otro país: tiene que venir con "+" y su código. Sin el "+" no hay
 * forma de distinguirlo de un monto o de un identificador cualquiera, así que
 * se buscan solo los explícitos. Entre 8 y 15 dígitos, que es lo que permite
 * E.164.
 */
const INTERNACIONAL = /(?<![\d+])[+]([1-9](?:[\s.\-]*\d){7,14})(?![\d])/g;

/** Lleva cualquier variante a E.164. Null si no cuadra. */
function normalizar(crudo) {
  const digitos = crudo.replace(/\D/g, '');

  // Chilenos: siempre 9 dígitos que parten en 9.
  if (digitos.length === 9 && digitos.startsWith('9')) return `+56${digitos}`;
  if (digitos.length === 11 && digitos.startsWith('569')) return `+${digitos}`;

  // Cualquier otro país. Se excluye el 56 a propósito: un "+56" que no haya
  // pasado por las dos reglas de arriba es un chileno mal escrito, no un
  // número de otro lado, y guardarlo dejaría a esa persona fuera sin aviso.
  if (
    crudo.trim().startsWith('+') &&
    !digitos.startsWith('56') &&
    digitos.length >= 8 &&
    digitos.length <= 15
  ) {
    return `+${digitos}`;
  }

  return null;
}

const archivo = process.argv[2];
if (!archivo) {
  console.error('Uso: node scripts/extraer-numeros.mjs <archivo.txt>');
  process.exit(1);
}

let texto;
try {
  texto = readFileSync(archivo, 'utf8');
} catch {
  console.error(`No se pudo leer "${archivo}".`);
  process.exit(1);
}

// Set y no array: un grupo de WhatsApp repite al mismo remitente en cada
// mensaje suyo, así que sin esto saldrían cientos de líneas iguales.
const numeros = new Set();
let encontrados = 0;

for (const patron of [CHILENO, INTERNACIONAL]) {
  for (const coincidencia of texto.matchAll(patron)) {
    encontrados += 1;
    const normalizado = normalizar(coincidencia[0]);
    if (normalizado) numeros.add(normalizado);
  }
}

for (const numero of numeros) console.log(numero);

console.error(
  `\n${numeros.size} números únicos (de ${encontrados} apariciones).\n` +
    'Pégalos en /admin/invitados. El cupo por número es 1: una entrada por persona.',
);
