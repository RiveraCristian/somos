import { cache } from 'react';

import { prisma } from './prisma';

/**
 * Evento vigente con todo lo que necesita el sitio publico.
 * Se prefiere el publicado; si no hay ninguno, se toma el borrador mas reciente
 * para que el sitio no quede en blanco mientras se arma el evento.
 */
export const obtenerEventoPublico = cache(async () => {
  const evento = await prisma.evento.findFirst({
    where: { isDeleted: false, eventoEstado: { in: ['publicado', 'borrador'] } },
    orderBy: [{ eventoEstado: 'asc' }, { createdAt: 'desc' }],
    include: {
      tiposEntrada: {
        where: { tipoEntradaActivo: true },
        orderBy: { tipoEntradaOrden: 'asc' },
      },
      artistas: {
        where: { artistaActivo: true },
        orderBy: { artistaOrden: 'asc' },
      },
      preguntas: {
        where: { preguntaActiva: true },
        orderBy: { preguntaOrden: 'asc' },
      },
    },
  });

  return evento;
});

/** Evento administrable (el mismo, pero sin filtrar tipos inactivos). */
export const obtenerEventoAdmin = cache(async () => {
  return prisma.evento.findFirst({
    where: { isDeleted: false },
    orderBy: { createdAt: 'desc' },
    include: {
      tiposEntrada: { orderBy: { tipoEntradaOrden: 'asc' } },
      artistas: { orderBy: { artistaOrden: 'asc' } },
      preguntas: { orderBy: { preguntaOrden: 'asc' } },
    },
  });
});

export type ResumenVentas = {
  recaudado: number;
  pagados: number;
  pagosPendientes: number;
  reservas: number;
  entradasEmitidas: number;
  entradasQuemadas: number;
};

/** Cifras de venta y de control de acceso. */
export async function resumenVentas(eventoId: number): Promise<ResumenVentas> {
  const [recaudado, pagados, pagosPendientes, reservas, entradasEmitidas, entradasQuemadas] =
    await Promise.all([
      prisma.pago.aggregate({
        _sum: { pagoMonto: true },
        where: {
          isDeleted: false,
          pagoEstado: 'confirmado',
          asistente: { asistenteEventoId: eventoId, isDeleted: false },
        },
      }),
      prisma.asistente.count({
        where: { asistenteEventoId: eventoId, isDeleted: false, asistenteMontoPagado: { gt: 0 } },
      }),
      prisma.pago.count({
        where: {
          isDeleted: false,
          pagoEstado: 'pendiente',
          asistente: { asistenteEventoId: eventoId, isDeleted: false },
        },
      }),
      prisma.asistente.count({
        where: { asistenteEventoId: eventoId, isDeleted: false, asistenteEstado: { not: 'anulado' } },
      }),
      prisma.entrada.count({
        where: { isDeleted: false, asistente: { asistenteEventoId: eventoId } },
      }),
      prisma.entrada.count({
        where: { isDeleted: false, entradaEstado: 'quemada', asistente: { asistenteEventoId: eventoId } },
      }),
    ]);

  return {
    recaudado: recaudado._sum.pagoMonto ?? 0,
    pagados,
    pagosPendientes,
    reservas,
    entradasEmitidas,
    entradasQuemadas,
  };
}

/** Cuantos cupos quedan por tipo de entrada. */
export async function cuposPorTipo(eventoId: number) {
  const agrupado = await prisma.asistente.groupBy({
    by: ['asistenteTipoEntradaId'],
    where: { asistenteEventoId: eventoId, isDeleted: false, asistenteEstado: { not: 'anulado' } },
    _count: { _all: true },
  });

  return new Map(agrupado.map((fila) => [fila.asistenteTipoEntradaId, fila._count._all]));
}

/** Pagina privada del comprador: /mi-entrada/<token> */
export async function obtenerAsistentePorToken(token: string) {
  if (!token || token.length > 64) return null;

  return prisma.asistente.findFirst({
    where: { asistenteToken: token, isDeleted: false },
    include: {
      evento: true,
      tipoEntrada: true,
      entrada: true,
      pagos: {
        where: { isDeleted: false },
        orderBy: { pagoFechaDeclarado: 'desc' },
      },
    },
  });
}

/** Pagina publica de la entrada: /entrada/<token> */
export async function obtenerEntradaPorToken(token: string) {
  if (!token || token.length > 64) return null;

  return prisma.entrada.findFirst({
    where: { entradaToken: token, isDeleted: false },
    include: {
      tipoEntrada: true,
      asistente: { include: { evento: true } },
    },
  });
}
