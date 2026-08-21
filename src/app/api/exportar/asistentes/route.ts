import { obtenerUsuarioActual } from '@/lib/auth';
import { ROLES_ADMIN } from '@/lib/constantes';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Escapa un valor para CSV con separador `;`. */
function celda(valor: unknown): string {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

/**
 * Exporta la lista completa de compradores.
 * Se usa `;` como separador y se antepone el BOM porque es lo que Excel en
 * español espera para abrir el archivo con los acentos correctos.
 */
export async function GET() {
  const usuario = await obtenerUsuarioActual();

  if (!usuario || !ROLES_ADMIN.includes(usuario.usuarioRol)) {
    return new Response('No autorizado', { status: 401 });
  }

  const asistentes = await prisma.asistente.findMany({
    where: { isDeleted: false },
    include: { tipoEntrada: true, entrada: true, evento: true },
    orderBy: { createdAt: 'asc' },
  });

  const encabezados = [
    'nombre',
    'correo',
    'telefono',
    'instagram',
    'tipo_entrada',
    'precio',
    'monto_pagado',
    'estado',
    'codigo_entrada',
    'estado_entrada',
    'fecha_compra',
    'evento',
  ];

  const filas = asistentes.map((a) =>
    [
      a.asistenteNombre,
      a.asistenteCorreo,
      a.asistenteTelefono,
      a.asistenteInstagram,
      a.tipoEntrada.tipoEntradaNombre,
      a.asistentePrecio,
      a.asistenteMontoPagado,
      a.asistenteEstado,
      a.entrada?.entradaCodigo ?? '',
      a.entrada?.entradaEstado ?? '',
      a.createdAt.toISOString(),
      a.evento.eventoNombre,
    ]
      .map(celda)
      .join(';'),
  );

  const csv = `﻿${encabezados.join(';')}\n${filas.join('\n')}`;
  const fecha = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="somos-asistentes-${fecha}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
