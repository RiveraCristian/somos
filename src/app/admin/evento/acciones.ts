'use server';

import { revalidatePath } from 'next/cache';

import { requerirUsuario } from '@/lib/auth';
import { COLORES_TIPO, ROLES_ADMIN, type ColorTipo } from '@/lib/constantes';
import { desdeFechaLocal } from '@/lib/fechas';
import { aSlug } from '@/lib/formato';
import { prisma } from '@/lib/prisma';
import { esquemaEvento, primerError } from '@/lib/validaciones';

export type EstadoEdicion = { error?: string; ok?: string };

function refrescar() {
  revalidatePath('/admin/evento');
  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath('/comprar');
}

const texto = (formulario: FormData, campo: string) =>
  String(formulario.get(campo) ?? '').trim();

// ---------------------------------------------------------------------------
// Evento
// ---------------------------------------------------------------------------
export async function guardarEvento(
  _previo: EstadoEdicion,
  formulario: FormData,
): Promise<EstadoEdicion> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/evento');
  const eventoId = Number(formulario.get('eventoId'));

  const analisis = esquemaEvento.safeParse({
    nombre: formulario.get('nombre'),
    lema: formulario.get('lema'),
    descripcion: formulario.get('descripcion'),
    fechaInicio: formulario.get('fechaInicio'),
    venue: formulario.get('venue'),
    direccion: formulario.get('direccion'),
    ciudad: formulario.get('ciudad'),
    region: formulario.get('region'),
    mapaUrl: formulario.get('mapaUrl'),
    capacidad: formulario.get('capacidad') || 0,
    estado: formulario.get('estado'),
    instagram: formulario.get('instagram'),
    tenpoNombre: formulario.get('tenpoNombre'),
    tenpoRut: formulario.get('tenpoRut'),
    tenpoCorreo: formulario.get('tenpoCorreo'),
    tenpoBanco: formulario.get('tenpoBanco'),
    tenpoTipoCuenta: formulario.get('tenpoTipoCuenta'),
    tenpoCuenta: formulario.get('tenpoCuenta'),
    tenpoQrUrl: formulario.get('tenpoQrUrl'),
  });

  if (!analisis.success) {
    return { error: primerError(analisis.error) };
  }

  const d = analisis.data;

  try {
    await prisma.evento.update({
      where: { eventoId },
      data: {
        eventoNombre: d.nombre,
        eventoLema: d.lema || null,
        eventoDescripcion: d.descripcion || null,
        eventoFechaInicio: desdeFechaLocal(d.fechaInicio),
        eventoVenue: d.venue || null,
        eventoDireccion: d.direccion || null,
        eventoCiudad: d.ciudad,
        eventoRegion: d.region || null,
        eventoMapaUrl: d.mapaUrl || null,
        eventoCapacidad: d.capacidad || null,
        eventoEstado: d.estado,
        eventoInstagram: d.instagram ? d.instagram.replace(/^@/, '') : null,
        eventoTenpoNombre: d.tenpoNombre || null,
        eventoTenpoRut: d.tenpoRut || null,
        eventoTenpoCorreo: d.tenpoCorreo || null,
        eventoTenpoBanco: d.tenpoBanco || null,
        eventoTenpoTipoCuenta: d.tenpoTipoCuenta || null,
        eventoTenpoCuenta: d.tenpoCuenta || null,
        eventoTenpoQrUrl: d.tenpoQrUrl || null,
        modifiedBy: usuario.usuarioId,
      },
    });
  } catch (e) {
    // El indice parcial deja publicado un solo evento a la vez.
    if ((e as { code?: string }).code === 'P2002') {
      return { error: 'Ya hay otro evento publicado. Ciérralo antes de publicar este.' };
    }
    throw e;
  }

  refrescar();
  return { ok: 'Evento actualizado.' };
}

// ---------------------------------------------------------------------------
// Tipos de entrada
// ---------------------------------------------------------------------------
export async function guardarTipoEntrada(formulario: FormData): Promise<void> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/evento');

  const tipoId = Number(formulario.get('tipoEntradaId')) || null;
  const eventoId = Number(formulario.get('eventoId'));
  const nombre = texto(formulario, 'nombre').slice(0, 80);

  if (!nombre || !eventoId) return;

  const colorPedido = texto(formulario, 'color') as ColorTipo;
  const color = COLORES_TIPO.includes(colorPedido) ? colorPedido : 'cyan';

  const cupoTexto = texto(formulario, 'cupo');

  const datos = {
    tipoEntradaNombre: nombre,
    tipoEntradaDescripcion: texto(formulario, 'descripcion').slice(0, 300) || null,
    tipoEntradaPrecio: Math.max(0, Number(formulario.get('precio')) || 0),
    tipoEntradaCupo: cupoTexto ? Math.max(1, Number(cupoTexto)) : null,
    tipoEntradaOrden: Number(formulario.get('orden')) || 0,
    tipoEntradaColor: color,
    tipoEntradaActivo: formulario.get('activo') === 'on',
  };

  if (tipoId) {
    await prisma.tipoEntrada.update({
      where: { tipoEntradaId: tipoId },
      data: { ...datos, modifiedBy: usuario.usuarioId },
    });
  } else {
    await prisma.tipoEntrada.create({
      data: {
        ...datos,
        tipoEntradaEventoId: eventoId,
        tipoEntradaSlug: aSlug(nombre) || `tipo-${Date.now()}`,
        createdBy: usuario.usuarioId,
      },
    });
  }

  refrescar();
}

/**
 * Los tipos de entrada no se borran: se desactivan.
 * Hay asistentes y entradas emitidas que los referencian y ese historial no se
 * puede romper.
 */
export async function desactivarTipoEntrada(formulario: FormData): Promise<void> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/evento');
  const tipoId = Number(formulario.get('tipoEntradaId'));
  if (!tipoId) return;

  await prisma.tipoEntrada.update({
    where: { tipoEntradaId: tipoId },
    data: { tipoEntradaActivo: false, modifiedBy: usuario.usuarioId },
  });

  refrescar();
}

// ---------------------------------------------------------------------------
// Line-up
// ---------------------------------------------------------------------------
export async function guardarArtista(formulario: FormData): Promise<void> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/evento');

  const artistaId = Number(formulario.get('artistaId')) || null;
  const eventoId = Number(formulario.get('eventoId'));
  const nombre = texto(formulario, 'nombre').slice(0, 120);

  if (!nombre || !eventoId) return;

  const datos = {
    artistaNombre: nombre,
    artistaGenero: texto(formulario, 'genero').slice(0, 80) || null,
    artistaDescripcion: texto(formulario, 'descripcion').slice(0, 400) || null,
    artistaHoraInicio: desdeFechaLocal(texto(formulario, 'horaInicio')),
    artistaInstagram: texto(formulario, 'instagram').replace(/^@/, '').slice(0, 120) || null,
    artistaOrden: Number(formulario.get('orden')) || 0,
    artistaDestacado: formulario.get('destacado') === 'on',
    artistaActivo: true,
  };

  if (artistaId) {
    await prisma.artista.update({
      where: { artistaId },
      data: { ...datos, modifiedBy: usuario.usuarioId },
    });
  } else {
    await prisma.artista.create({
      data: { ...datos, artistaEventoId: eventoId, createdBy: usuario.usuarioId },
    });
  }

  refrescar();
}

export async function ocultarArtista(formulario: FormData): Promise<void> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/evento');
  const artistaId = Number(formulario.get('artistaId'));
  if (!artistaId) return;

  await prisma.artista.update({
    where: { artistaId },
    data: { artistaActivo: false, modifiedBy: usuario.usuarioId },
  });

  refrescar();
}

// ---------------------------------------------------------------------------
// Preguntas frecuentes
// ---------------------------------------------------------------------------
export async function guardarPregunta(formulario: FormData): Promise<void> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/evento');

  const preguntaId = Number(formulario.get('preguntaId')) || null;
  const eventoId = Number(formulario.get('eventoId'));
  const pregunta = texto(formulario, 'pregunta').slice(0, 300);
  const respuesta = texto(formulario, 'respuesta');

  if (!pregunta || !respuesta || !eventoId) return;

  const datos = {
    preguntaTexto: pregunta,
    preguntaRespuesta: respuesta,
    preguntaOrden: Number(formulario.get('orden')) || 0,
    preguntaActiva: true,
  };

  if (preguntaId) {
    await prisma.preguntaFrecuente.update({
      where: { preguntaId },
      data: { ...datos, modifiedBy: usuario.usuarioId },
    });
  } else {
    await prisma.preguntaFrecuente.create({
      data: { ...datos, preguntaEventoId: eventoId, createdBy: usuario.usuarioId },
    });
  }

  refrescar();
}

export async function ocultarPregunta(formulario: FormData): Promise<void> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/evento');
  const preguntaId = Number(formulario.get('preguntaId'));
  if (!preguntaId) return;

  await prisma.preguntaFrecuente.update({
    where: { preguntaId },
    data: { preguntaActiva: false, modifiedBy: usuario.usuarioId },
  });

  refrescar();
}
