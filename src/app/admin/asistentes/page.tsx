import type { Metadata } from 'next';
import Link from 'next/link';
import { Download, ExternalLink, Search, UserX } from 'lucide-react';

import { EncabezadoPagina } from '@/components/admin/EncabezadoPagina';
import { fechaHora, numero, pesos } from '@/lib/formato';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Asistentes' };

export default async function PaginaAsistentes({
  searchParams,
}: {
  searchParams: Promise<{ buscar?: string }>;
}) {
  const parametros = await searchParams;
  const buscar = (parametros.buscar ?? '').trim();

  const asistentes = await prisma.asistente.findMany({
    where: {
      isDeleted: false,
      ...(buscar
        ? {
            OR: [
              { asistenteNombre: { contains: buscar, mode: 'insensitive' } },
              { asistenteCorreo: { contains: buscar, mode: 'insensitive' } },
              { asistenteInstagram: { contains: buscar, mode: 'insensitive' } },
              { entrada: { entradaCodigo: { contains: buscar, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: { tipoEntrada: true, entrada: true },
    orderBy: { createdAt: 'desc' },
    take: 400,
  });

  const recaudado = asistentes.reduce((suma, a) => suma + a.asistenteMontoPagado, 0);

  return (
    <>
      <EncabezadoPagina
        titulo="Compradores"
        subtitulo={`${numero(asistentes.length)} entradas vendidas · ${pesos(recaudado)} recaudados`}
      >
        <a href="/api/exportar/asistentes" className="btn btn-borde btn-sm" download>
          <Download size={16} />
          Exportar CSV
        </a>
      </EncabezadoPagina>

      {/* ------------------------------------------------------------ Buscar */}
      <form method="get" className="mb-6 flex gap-2.5">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint"
          />
          <input
            type="search"
            name="buscar"
            defaultValue={buscar}
            placeholder="Buscar por nombre, correo, Instagram o código de entrada…"
            className="campo-input !pl-11"
          />
        </div>
        <button type="submit" className="btn btn-borde btn-sm">
          Buscar
        </button>
        {buscar && (
          <Link href="/admin/asistentes" className="btn btn-fantasma btn-sm">
            Limpiar
          </Link>
        )}
      </form>

      {/* ------------------------------------------------------------- Tabla */}
      {asistentes.length === 0 ? (
        <div className="tarjeta flex flex-col items-center gap-3 px-8 py-16 text-center">
          <UserX size={28} className="text-faint" />
          <p className="titulo-display text-xl">Sin resultados</p>
          <p className="max-w-xs text-sm text-dim">
            {buscar ? `Nadie coincide con "${buscar}".` : 'Todavía no compra nadie.'}
          </p>
        </div>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                {['Persona', 'Entrada', 'Pagado', 'Estado', 'QR', 'Compra'].map((h) => (
                  <th
                    key={h}
                    className="dato px-5 py-3.5 text-[0.65rem] font-medium tracking-[0.16em] text-faint uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--color-line)]">
              {asistentes.map((a) => (
                <tr key={a.asistenteId} className="transition-colors hover:bg-white/[0.025]">
                  <td className="px-5 py-3.5">
                    <div className="font-medium">{a.asistenteNombre}</div>
                    <div className="dato text-xs text-dim">{a.asistenteCorreo}</div>
                    {a.asistenteInstagram && (
                      <div className="dato text-xs text-faint">@{a.asistenteInstagram}</div>
                    )}
                  </td>

                  <td className="px-5 py-3.5">
                    <div>{a.tipoEntrada.tipoEntradaNombre}</div>
                    <div className="dato text-xs text-faint">
                      {pesos(a.tipoEntrada.tipoEntradaPrecio)}
                    </div>
                  </td>

                  <td className="dato px-5 py-3.5 font-semibold">
                    {a.asistenteMontoPagado > 0 ? (
                      <span className="text-ok">{pesos(a.asistenteMontoPagado)}</span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>

                  <td className="px-5 py-3.5">
                    {a.asistenteEstado === 'confirmado' ? (
                      <span className="insignia insignia-ok">Confirmado</span>
                    ) : a.asistenteEstado === 'anulado' ? (
                      <span className="insignia insignia-error">Anulado</span>
                    ) : (
                      <span className="insignia insignia-pendiente">Pendiente</span>
                    )}
                  </td>

                  <td className="px-5 py-3.5">
                    {a.entrada ? (
                      <Link
                        href={`/entrada/${a.entrada.entradaToken}`}
                        target="_blank"
                        className="dato inline-flex items-center gap-1.5 text-xs text-cyan underline-offset-4 hover:underline"
                      >
                        {a.entrada.entradaCodigo}
                        <ExternalLink size={12} />
                        {a.entrada.entradaEstado === 'quemada' && (
                          <span className="text-magenta">· usada</span>
                        )}
                      </Link>
                    ) : (
                      <span className="text-xs text-faint">sin emitir</span>
                    )}
                  </td>

                  <td className="dato px-5 py-3.5 text-xs text-dim">{fechaHora(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
