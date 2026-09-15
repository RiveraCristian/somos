import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

import { LOGO_MAX_MB, MIMES_COMPROBANTE, MIMES_LOGO } from './constantes';

export type ComprobanteGuardado = {
  archivo: string;
  nombreOriginal: string;
  mime: string;
  tamano: number;
};

/** Carpeta absoluta donde viven los comprobantes subidos. */
export function directorioComprobantes(): string {
  return resolve(process.cwd(), process.env.UPLOADS_DIR ?? './data/comprobantes');
}

function limiteBytes(): number {
  const mb = Number(process.env.UPLOAD_MAX_MB ?? 8);
  return (Number.isFinite(mb) && mb > 0 ? mb : 8) * 1024 * 1024;
}

const EXTENSION_POR_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

/**
 * Guarda el comprobante con un nombre aleatorio.
 * Nunca se reutiliza el nombre que trae el archivo del usuario: ese solo se
 * conserva como metadato para mostrarlo en el panel.
 */
export async function guardarComprobante(archivo: File): Promise<ComprobanteGuardado> {
  if (!MIMES_COMPROBANTE.includes(archivo.type as (typeof MIMES_COMPROBANTE)[number])) {
    throw new Error('El comprobante debe ser una imagen (PNG, JPG o WEBP) o un PDF.');
  }

  if (archivo.size <= 0) {
    throw new Error('El archivo llego vacio. Intenta subirlo de nuevo.');
  }

  if (archivo.size > limiteBytes()) {
    const mb = Math.round(limiteBytes() / (1024 * 1024));
    throw new Error(`El comprobante supera el maximo de ${mb} MB.`);
  }

  const carpeta = directorioComprobantes();
  await mkdir(carpeta, { recursive: true });

  const extension = EXTENSION_POR_MIME[archivo.type] ?? extname(archivo.name) ?? '.bin';
  const nombre = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}${extension}`;

  const contenido = Buffer.from(await archivo.arrayBuffer());
  await writeFile(join(carpeta, nombre), contenido);

  return {
    archivo: nombre,
    nombreOriginal: archivo.name.slice(0, 300),
    mime: archivo.type,
    tamano: archivo.size,
  };
}

/** Solo nombres generados por `guardarComprobante`: corta cualquier `../`. */
function nombreSeguro(nombre: string): boolean {
  return /^[a-z0-9]+-[a-f0-9]{16}\.(png|jpg|webp|pdf|bin)$/i.test(nombre);
}

export async function leerComprobante(
  nombre: string,
): Promise<{ contenido: Buffer; mime: string } | null> {
  if (!nombreSeguro(nombre)) return null;

  try {
    const contenido = await readFile(join(directorioComprobantes(), nombre));
    const extension = extname(nombre).toLowerCase();
    const mime =
      Object.entries(EXTENSION_POR_MIME).find(([, ext]) => ext === extension)?.[0] ??
      'application/octet-stream';
    return { contenido, mime };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Logos de auspiciadores
//
// Van en el mismo volumen que los comprobantes pero en su propia carpeta: los
// comprobantes son datos privados de terceros y solo los ve el panel, mientras
// que un logo es publico por definicion. Mezclarlos obligaria a decidir caso a
// caso quien puede ver que, y esa es justo la decision que se equivoca.
// ---------------------------------------------------------------------------

/** Carpeta absoluta donde viven los logos subidos. */
export function directorioLogos(): string {
  return resolve(process.cwd(), process.env.LOGOS_DIR ?? './data/logos');
}

const EXTENSION_LOGO: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

/** Guarda el logo con un nombre aleatorio y devuelve ese nombre. */
export async function guardarLogo(archivo: File): Promise<string> {
  if (!MIMES_LOGO.includes(archivo.type as (typeof MIMES_LOGO)[number])) {
    throw new Error('El logo debe ser PNG, JPG o WEBP.');
  }

  if (archivo.size <= 0) {
    throw new Error('El archivo llego vacio. Intenta subirlo de nuevo.');
  }

  if (archivo.size > LOGO_MAX_MB * 1024 * 1024) {
    throw new Error(`El logo supera el maximo de ${LOGO_MAX_MB} MB.`);
  }

  const carpeta = directorioLogos();
  await mkdir(carpeta, { recursive: true });

  const nombre = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}${EXTENSION_LOGO[archivo.type]}`;
  await writeFile(join(carpeta, nombre), Buffer.from(await archivo.arrayBuffer()));

  return nombre;
}

/** Mismo criterio que arriba: solo nombres que genero `guardarLogo`. */
function nombreLogoSeguro(nombre: string): boolean {
  return /^[a-z0-9]+-[a-f0-9]{16}\.(png|jpg|webp)$/i.test(nombre);
}

export async function leerLogo(
  nombre: string,
): Promise<{ contenido: Buffer; mime: string } | null> {
  if (!nombreLogoSeguro(nombre)) return null;

  try {
    const contenido = await readFile(join(directorioLogos(), nombre));
    const extension = extname(nombre).toLowerCase();
    const mime =
      Object.entries(EXTENSION_LOGO).find(([, ext]) => ext === extension)?.[0] ?? 'image/png';
    return { contenido, mime };
  } catch {
    return null;
  }
}

/**
 * Borra el archivo de un logo.
 *
 * No falla si el archivo ya no esta: se llama al quitar un auspiciador y lo que
 * importa es que la fila desaparezca. Un archivo huerfano en el disco es un
 * problema menor que una accion que revienta a mitad de camino.
 */
export async function borrarLogo(nombre: string): Promise<void> {
  if (!nombreLogoSeguro(nombre)) return;
  try {
    await unlink(join(directorioLogos(), nombre));
  } catch {
    /* ya no estaba */
  }
}

/** Ruta publica desde la que el navegador pide un logo. */
export function urlDeLogo(nombre: string): string {
  return `/api/logo/${nombre}`;
}
