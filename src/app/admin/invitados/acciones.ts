'use server';

import { revalidatePath } from 'next/cache';

import { requerirUsuario } from '@/lib/auth';
import { ROLES_ADMIN } from '@/lib/constantes';
import { prisma } from '@/lib/prisma';
import { normalizarTelefono } from '@/lib/telefono';

export type EstadoInvitados = { error?: string; ok?: string };

function refrescar() {
  revalidatePath('/admin/invitados');
  revalidatePath('/admin');
}

/**
 * Carga numeros a la lista, pegados en bloque.
 *
 * Se acepta un numero por linea, opcionalmente seguido de coma y el nombre:
 *
 *     +56 9 1234 5678, Javiera
 *     991234567
 *
 * Se trabaja en bloque a proposito: la lista llega por WhatsApp o por planilla,
 * y cargarla de a uno seria una invitacion a equivocarse. Los numeros que ya
 * estaban no se duplican ni se pisan.
 */
export async function cargarInvitados(
  _previo: EstadoInvitados,
  formulario: FormData,
): Promise<EstadoInvitados> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/invitados');

  const eventoId = Number(formulario.get('eventoId'));
  const cupo = Math.min(10, Math.max(1, Number(formulario.get('cupo')) || 2));
  const crudo = String(formulario.get('numeros') ?? '');

  if (!eventoId) return { error: 'No hay evento al cual cargar la lista.' };
  if (!crudo.trim()) return { error: 'Pega al menos un número.' };

  const lineas = crudo
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lineas.length > 2000) {
    return { error: 'Son demasiadas líneas de una vez. Divídelas en tandas más chicas.' };
  }

  const validos = new Map<string, string | null>();
  const rechazados: string[] = [];

  for (const linea of lineas) {
    const [parteNumero, ...resto] = linea.split(',');
    const telefono = normalizarTelefono(parteNumero);

    if (!telefono) {
      rechazados.push(linea.slice(0, 30));
      continue;
    }

    const nombre = resto.join(',').trim();
    // Si el mismo numero viene dos veces en el pegado, gana el que traiga nombre.
    if (!validos.has(telefono) || nombre) {
      validos.set(telefono, nombre || null);
    }
  }

  if (validos.size === 0) {
    return { error: `Ningún número se pudo leer. Revisa el formato: ${rechazados.slice(0, 3).join(' · ')}` };
  }

  // createMany con skipDuplicates: los que ya estaban se dejan como estan, no se
  // les pisa el cupo ni el nombre que alguien pudo haber ajustado a mano.
  const resultado = await prisma.invitado.createMany({
    data: [...validos].map(([telefono, nombre]) => ({
      invitadoEventoId: eventoId,
      invitadoTelefono: telefono,
      invitadoNombre: nombre,
      invitadoCupo: cupo,
      createdBy: usuario.usuarioId,
    })),
    skipDuplicates: true,
  });

  refrescar();

  const partes = [`${resultado.count} ${resultado.count === 1 ? 'número nuevo' : 'números nuevos'}`];
  const repetidos = validos.size - resultado.count;
  if (repetidos > 0) partes.push(`${repetidos} ya estaban`);
  if (rechazados.length > 0) partes.push(`${rechazados.length} no se pudieron leer`);

  return { ok: partes.join(' · ') };
}

/** Activa o desactiva un invitado sin borrarlo, para no perder el historial. */
export async function alternarInvitado(
  _previo: EstadoInvitados,
  formulario: FormData,
): Promise<EstadoInvitados> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/invitados');
  const invitadoId = Number(formulario.get('invitadoId'));

  const invitado = await prisma.invitado.findFirst({
    where: { invitadoId, isDeleted: false },
  });

  if (!invitado) return { error: 'Ese invitado ya no existe.' };

  await prisma.invitado.update({
    where: { invitadoId },
    data: {
      invitadoActivo: !invitado.invitadoActivo,
      modifiedBy: usuario.usuarioId,
    },
  });

  refrescar();
  return { ok: invitado.invitadoActivo ? 'Invitado desactivado.' : 'Invitado activado.' };
}

/**
 * Saca a alguien de la lista.
 *
 * Eliminacion logica: la lista de quien fue invitado y despues sacado es
 * justamente el tipo de dato que uno lamenta haber borrado de verdad.
 */
export async function quitarInvitado(
  _previo: EstadoInvitados,
  formulario: FormData,
): Promise<EstadoInvitados> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/invitados');
  const invitadoId = Number(formulario.get('invitadoId'));

  await prisma.invitado.updateMany({
    where: { invitadoId, isDeleted: false },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: usuario.usuarioId,
      modifiedBy: usuario.usuarioId,
    },
  });

  refrescar();
  return { ok: 'Se quitó de la lista.' };
}
