import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

import { MIMES_COMPROBANTE } from './constantes';

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
