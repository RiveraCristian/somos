'use server';

import { revalidatePath } from 'next/cache';

import { borrarLogo, guardarLogo } from '@/lib/archivos';
import { requerirUsuario } from '@/lib/auth';
import { ROLES_ADMIN } from '@/lib/constantes';
import { prisma } from '@/lib/prisma';

export type EstadoAuspiciador = { error?: string; ok?: string };

function refrescar() {
  revalidatePath('/admin/auspiciadores');
  revalidatePath('/');
}

/**
 * Normaliza el sitio del auspiciador.
 *
 * Este valor termina en un `href` de la portada: si se acepta texto libre, un
 * `javascript:` queda a un descuido de distancia. Se exige http(s) y, si viene
 * sin esquema, se asume https en vez de rechazarlo — escribir "somos.cl" es lo
 * natural y no deberia costar un error.
 */
function normalizarSitio(crudo: string): string | null | undefined {
  const texto = crudo.trim();
  if (!texto) return null;

  const conEsquema = /^https?:\/\//i.test(texto) ? texto : `https://${texto}`;

  try {
    const url = new URL(conEsquema);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.toString().slice(0, 300);
  } catch {
    return undefined;
  }
}

/** Agrega un auspiciador con su logo. */
export async function agregarAuspiciador(
  _previo: EstadoAuspiciador,
  formulario: FormData,
): Promise<EstadoAuspiciador> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/auspiciadores');

  const eventoId = Number(formulario.get('eventoId'));
  const nombre = String(formulario.get('nombre') ?? '').trim();
  const sitio = normalizarSitio(String(formulario.get('sitio') ?? ''));
  const orden = Math.max(0, Number(formulario.get('orden')) || 0);
  const logo = formulario.get('logo');

  if (!eventoId) return { error: 'No hay evento al cual agregar el auspiciador.' };
  if (!nombre) return { error: 'Ponle un nombre al auspiciador.' };
  if (nombre.length > 120) return { error: 'El nombre es demasiado largo.' };
  if (sitio === undefined) return { error: 'El sitio web no es una dirección válida.' };
  if (!(logo instanceof File) || logo.size === 0) return { error: 'Falta el logo.' };

  let archivo: string;
  try {
    archivo = await guardarLogo(logo);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo guardar el logo.' };
  }

  try {
    await prisma.auspiciador.create({
      data: {
        auspiciadorEventoId: eventoId,
        auspiciadorNombre: nombre,
        auspiciadorLogo: archivo,
        auspiciadorSitio: sitio,
        auspiciadorOrden: orden,
        createdBy: usuario.usuarioId,
      },
    });
  } catch (e) {
    // El archivo ya esta en disco: si la fila no entra, hay que sacarlo o
    // queda ocupando espacio sin que nada lo referencie.
    await borrarLogo(archivo);
    if ((e as { code?: string }).code === 'P2002') {
      return { error: `Ya hay un auspiciador que se llama "${nombre}".` };
    }
    throw e;
  }

  refrescar();
  return { ok: `${nombre} quedó en la portada.` };
}

/** Lo saca de la portada sin perder el registro. */
export async function alternarAuspiciador(
  _previo: EstadoAuspiciador,
  formulario: FormData,
): Promise<EstadoAuspiciador> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/auspiciadores');
  const auspiciadorId = Number(formulario.get('auspiciadorId'));

  const auspiciador = await prisma.auspiciador.findUnique({ where: { auspiciadorId } });
  if (!auspiciador) return { error: 'Ese auspiciador ya no existe.' };

  await prisma.auspiciador.update({
    where: { auspiciadorId },
    data: {
      auspiciadorActivo: !auspiciador.auspiciadorActivo,
      modifiedBy: usuario.usuarioId,
    },
  });

  refrescar();
  return {
    ok: auspiciador.auspiciadorActivo
      ? `${auspiciador.auspiciadorNombre} ya no se muestra.`
      : `${auspiciador.auspiciadorNombre} vuelve a la portada.`,
  };
}

/**
 * Borra el auspiciador y su logo.
 *
 * Aca si es borrado fisico: un auspicio no es una entidad critica y no hay nada
 * que auditar despues. Lo que si importa es no dejar el archivo en el disco,
 * que en este servidor va justo de espacio.
 */
export async function quitarAuspiciador(
  _previo: EstadoAuspiciador,
  formulario: FormData,
): Promise<EstadoAuspiciador> {
  await requerirUsuario(ROLES_ADMIN, '/admin/auspiciadores');
  const auspiciadorId = Number(formulario.get('auspiciadorId'));

  const auspiciador = await prisma.auspiciador.findUnique({ where: { auspiciadorId } });
  if (!auspiciador) return { error: 'Ese auspiciador ya no existe.' };

  await prisma.auspiciador.delete({ where: { auspiciadorId } });
  await borrarLogo(auspiciador.auspiciadorLogo);

  refrescar();
  return { ok: `Se quitó ${auspiciador.auspiciadorNombre}.` };
}
