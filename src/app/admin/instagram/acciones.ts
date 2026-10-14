'use server';

import { revalidatePath } from 'next/cache';

import { requerirUsuario } from '@/lib/auth';
import { ROLES_ADMIN } from '@/lib/constantes';
import { leerPublicacion } from '@/lib/instagram';
import { prisma } from '@/lib/prisma';

export type EstadoPublicacion = { error?: string; ok?: string };

function refrescar() {
  revalidatePath('/admin/instagram');
  revalidatePath('/');
}

/**
 * Agrega posts de Instagram, pegados en bloque.
 *
 * Se acepta un link por linea. Da lo mismo si viene con el `?igsh=` que agrega
 * la app al compartir, sin protocolo, o directamente el shortcode: de todo eso
 * se saca el codigo. Pedir un formato exacto seria pedir que el organizador
 * limpie a mano lo que ya sabemos limpiar.
 */
export async function agregarPublicaciones(
  _previo: EstadoPublicacion,
  formulario: FormData,
): Promise<EstadoPublicacion> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/instagram');

  const eventoId = Number(formulario.get('eventoId'));
  const crudo = String(formulario.get('links') ?? '');

  if (!eventoId) return { error: 'No hay evento al cual agregar publicaciones.' };
  if (!crudo.trim()) return { error: 'Pega al menos un link.' };

  const lineas = crudo
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lineas.length > 30) {
    return { error: 'Son demasiados de una vez. Pégalos en tandas de hasta 30.' };
  }

  const validos = new Map<string, string>();
  const rechazados: string[] = [];

  for (const linea of lineas) {
    const pub = leerPublicacion(linea);
    if (!pub) {
      rechazados.push(linea.slice(0, 40));
      continue;
    }
    validos.set(pub.codigo, pub.tipo);
  }

  if (validos.size === 0) {
    return {
      error:
        'Ningún link se pudo leer. Tienen que ser de instagram.com/p/… o /reel/…  ' +
        `Por ejemplo esto no sirve: ${rechazados[0] ?? ''}`,
    };
  }

  const ultima = await prisma.publicacionIg.findFirst({
    where: { publicacionEventoId: eventoId },
    orderBy: { publicacionOrden: 'desc' },
  });
  let orden = (ultima?.publicacionOrden ?? 0) + 1;

  // skipDuplicates: un post que ya estaba se deja como esta, no se reordena ni
  // se reactiva por haberlo pegado de nuevo.
  const resultado = await prisma.publicacionIg.createMany({
    data: [...validos].map(([codigo, tipo]) => ({
      publicacionEventoId: eventoId,
      publicacionCodigo: codigo,
      publicacionTipo: tipo,
      publicacionOrden: orden++,
      createdBy: usuario.usuarioId,
    })),
    skipDuplicates: true,
  });

  refrescar();

  const partes = [`${resultado.count} ${resultado.count === 1 ? 'post agregado' : 'posts agregados'}`];
  const repetidos = validos.size - resultado.count;
  if (repetidos > 0) partes.push(`${repetidos} ya estaban`);
  if (rechazados.length > 0) partes.push(`${rechazados.length} no se pudieron leer`);

  return { ok: partes.join(' · ') };
}

/** Lo saca de la portada sin perder el registro. */
export async function alternarPublicacion(
  _previo: EstadoPublicacion,
  formulario: FormData,
): Promise<EstadoPublicacion> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/instagram');
  const publicacionId = Number(formulario.get('publicacionId'));

  const pub = await prisma.publicacionIg.findUnique({ where: { publicacionId } });
  if (!pub) return { error: 'Ese post ya no está.' };

  await prisma.publicacionIg.update({
    where: { publicacionId },
    data: { publicacionActiva: !pub.publicacionActiva, modifiedBy: usuario.usuarioId },
  });

  refrescar();
  return { ok: pub.publicacionActiva ? 'Post oculto.' : 'Post visible de nuevo.' };
}

/** Lo saca de la lista. El post en Instagram no se toca, claro. */
export async function quitarPublicacion(
  _previo: EstadoPublicacion,
  formulario: FormData,
): Promise<EstadoPublicacion> {
  await requerirUsuario(ROLES_ADMIN, '/admin/instagram');
  const publicacionId = Number(formulario.get('publicacionId'));

  const pub = await prisma.publicacionIg.findUnique({ where: { publicacionId } });
  if (!pub) return { error: 'Ese post ya no está.' };

  await prisma.publicacionIg.delete({ where: { publicacionId } });

  refrescar();
  return { ok: 'Post quitado de la portada.' };
}

/** Cambia el orden en que aparecen. */
export async function moverPublicacion(
  _previo: EstadoPublicacion,
  formulario: FormData,
): Promise<EstadoPublicacion> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/instagram');
  const publicacionId = Number(formulario.get('publicacionId'));
  const direccion = String(formulario.get('direccion') ?? '');

  const pub = await prisma.publicacionIg.findUnique({ where: { publicacionId } });
  if (!pub) return { error: 'Ese post ya no está.' };

  const vecina = await prisma.publicacionIg.findFirst({
    where: {
      publicacionEventoId: pub.publicacionEventoId,
      publicacionOrden:
        direccion === 'subir' ? { lt: pub.publicacionOrden } : { gt: pub.publicacionOrden },
    },
    orderBy: { publicacionOrden: direccion === 'subir' ? 'desc' : 'asc' },
  });

  if (!vecina) return {};

  await prisma.$transaction([
    prisma.publicacionIg.update({
      where: { publicacionId: pub.publicacionId },
      data: { publicacionOrden: vecina.publicacionOrden, modifiedBy: usuario.usuarioId },
    }),
    prisma.publicacionIg.update({
      where: { publicacionId: vecina.publicacionId },
      data: { publicacionOrden: pub.publicacionOrden, modifiedBy: usuario.usuarioId },
    }),
  ]);

  refrescar();
  return {};
}
