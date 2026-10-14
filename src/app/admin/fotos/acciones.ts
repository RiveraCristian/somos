'use server';

import { revalidatePath } from 'next/cache';

import { borrarFoto, guardarFoto } from '@/lib/archivos';
import { requerirUsuario } from '@/lib/auth';
import { ROLES_ADMIN } from '@/lib/constantes';
import { prisma } from '@/lib/prisma';

export type EstadoFoto = { error?: string; ok?: string };

function refrescar() {
  revalidatePath('/admin/fotos');
  revalidatePath('/');
}

/**
 * Sube fotos a la galeria.
 *
 * Acepta varias de una vez: nadie carga las fotos de una fiesta de a una, y
 * obligar a repetir el formulario diez veces es la forma mas segura de que la
 * galeria se quede en tres.
 */
export async function subirFotos(
  _previo: EstadoFoto,
  formulario: FormData,
): Promise<EstadoFoto> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/fotos');

  const eventoId = Number(formulario.get('eventoId'));
  if (!eventoId) return { error: 'No hay evento al cual agregar fotos.' };

  const archivos = formulario
    .getAll('fotos')
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (archivos.length === 0) return { error: 'Elige al menos una foto.' };
  if (archivos.length > 20) {
    return { error: 'Son demasiadas de una vez. Súbelas en tandas de hasta 20.' };
  }

  const ultima = await prisma.foto.findFirst({
    where: { fotoEventoId: eventoId },
    orderBy: { fotoOrden: 'desc' },
  });
  let orden = (ultima?.fotoOrden ?? 0) + 1;

  const guardadas: string[] = [];
  const fallidas: string[] = [];

  for (const archivo of archivos) {
    let nombre: string;
    try {
      nombre = await guardarFoto(archivo);
    } catch (e) {
      // Una foto pesada no puede tumbar la tanda entera: se anota y sigue.
      fallidas.push(`${archivo.name}: ${e instanceof Error ? e.message : 'no se pudo guardar'}`);
      continue;
    }

    try {
      await prisma.foto.create({
        data: {
          fotoEventoId: eventoId,
          fotoArchivo: nombre,
          fotoOrden: orden,
          createdBy: usuario.usuarioId,
        },
      });
      guardadas.push(nombre);
      orden += 1;
    } catch (e) {
      // El archivo ya esta en disco: si la fila no entra hay que sacarlo, o
      // queda ocupando espacio sin que nada lo referencie.
      await borrarFoto(nombre);
      fallidas.push(`${archivo.name}: ${(e as { code?: string }).code ?? 'no se pudo registrar'}`);
    }
  }

  refrescar();

  if (guardadas.length === 0) {
    return { error: `No se subió ninguna. ${fallidas.slice(0, 2).join(' · ')}` };
  }

  const partes = [`${guardadas.length} ${guardadas.length === 1 ? 'foto subida' : 'fotos subidas'}`];
  if (fallidas.length > 0) partes.push(`${fallidas.length} falló: ${fallidas[0]}`);

  return { ok: partes.join(' · ') };
}

/** La saca de la portada sin borrar el archivo. */
export async function alternarFoto(
  _previo: EstadoFoto,
  formulario: FormData,
): Promise<EstadoFoto> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/fotos');
  const fotoId = Number(formulario.get('fotoId'));

  const foto = await prisma.foto.findUnique({ where: { fotoId } });
  if (!foto) return { error: 'Esa foto ya no existe.' };

  await prisma.foto.update({
    where: { fotoId },
    data: { fotoActiva: !foto.fotoActiva, modifiedBy: usuario.usuarioId },
  });

  refrescar();
  return { ok: foto.fotoActiva ? 'Foto oculta.' : 'Foto visible de nuevo.' };
}

/** Borra la foto y su archivo. */
export async function quitarFoto(
  _previo: EstadoFoto,
  formulario: FormData,
): Promise<EstadoFoto> {
  await requerirUsuario(ROLES_ADMIN, '/admin/fotos');
  const fotoId = Number(formulario.get('fotoId'));

  const foto = await prisma.foto.findUnique({ where: { fotoId } });
  if (!foto) return { error: 'Esa foto ya no existe.' };

  await prisma.foto.delete({ where: { fotoId } });
  await borrarFoto(foto.fotoArchivo);

  refrescar();
  return { ok: 'Foto eliminada.' };
}

/** Cambia el orden en que aparecen. */
export async function moverFoto(
  _previo: EstadoFoto,
  formulario: FormData,
): Promise<EstadoFoto> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/fotos');
  const fotoId = Number(formulario.get('fotoId'));
  const direccion = String(formulario.get('direccion') ?? '');

  const foto = await prisma.foto.findUnique({ where: { fotoId } });
  if (!foto) return { error: 'Esa foto ya no existe.' };

  // La vecina en la direccion pedida. Si no hay, la foto ya esta en la punta.
  const vecina = await prisma.foto.findFirst({
    where: {
      fotoEventoId: foto.fotoEventoId,
      fotoOrden: direccion === 'subir' ? { lt: foto.fotoOrden } : { gt: foto.fotoOrden },
    },
    orderBy: { fotoOrden: direccion === 'subir' ? 'desc' : 'asc' },
  });

  if (!vecina) return {};

  // Se intercambian los ordenes. No hay unique sobre el orden, asi que no hace
  // falta el paso intermedio que normalmente pide un swap.
  await prisma.$transaction([
    prisma.foto.update({
      where: { fotoId: foto.fotoId },
      data: { fotoOrden: vecina.fotoOrden, modifiedBy: usuario.usuarioId },
    }),
    prisma.foto.update({
      where: { fotoId: vecina.fotoId },
      data: { fotoOrden: foto.fotoOrden, modifiedBy: usuario.usuarioId },
    }),
  ]);

  refrescar();
  return {};
}
