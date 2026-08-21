import type { Metadata } from 'next';
import { Inbox, Lock, TrendingUp } from 'lucide-react';

import { EncabezadoPagina } from '@/components/admin/EncabezadoPagina';
import { obtenerEventoAdmin } from '@/lib/datos';
import { etapaVigente, listarEtapas } from '@/lib/etapas';
import { hace, numero, pesos } from '@/lib/formato';
import { prisma } from '@/lib/prisma';
import { formatearTelefono } from '@/lib/telefono';

import { AccionesInvitado, CargaMasiva } from './Formularios';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Lista de invitados' };

export default async function PaginaInvitados() {
  const evento = await obtenerEventoAdmin();

  if (!evento) {
    return (
      <>
        <EncabezadoPagina titulo="Lista de invitados" />
        <p className="text-dim">Primero crea el evento.</p>
      </>
    );
  }

  const [invitados, etapas, etapa] = await Promise.all([
    prisma.invitado.findMany({
      where: { invitadoEventoId: evento.eventoId, isDeleted: false },
      orderBy: [{ invitadoActivo: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    }),
    listarEtapas(evento.eventoId),
    etapaVigente(evento.eventoId, evento.eventoFechaInicio),
  ]);

  // Cuantas entradas lleva cada numero, en una sola consulta.
  const usoPorNumero = await prisma.asistente.groupBy({
    by: ['asistenteTelefono'],
    where: {
      asistenteEventoId: evento.eventoId,
      isDeleted: false,
      asistenteEstado: { not: 'anulado' },
      asistenteTelefono: { not: null },
    },
    _count: { _all: true },
  });

  const usadas = new Map(
    usoPorNumero.map((fila) => [fila.asistenteTelefono ?? '', fila._count._all]),
  );

  const activos = invitados.filter((i) => i.invitadoActivo).length;
  const cupoTotal = invitados
    .filter((i) => i.invitadoActivo)
    .reduce((suma, i) => suma + i.invitadoCupo, 0);

  return (
    <>
      <EncabezadoPagina
        titulo="Lista de invitados"
        subtitulo={`${numero(activos)} números activos · hasta ${numero(cupoTotal)} entradas posibles`}
      />

      {/* ------------------------------------------------------- Etapas */}
      <div className="mb-7 rounded-[12px] border border-line bg-white/[0.02] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <TrendingUp size={17} className="text-cyan" />
          <p className="text-sm font-medium">Precio por etapa</p>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2.5">
          {etapas.map((e) => {
            const vigente = etapa?.etapaId === e.etapaId;
            return (
              <li
                key={e.etapaId}
                className={`dato rounded-full border px-4 py-1.5 text-xs ${
                  vigente
                    ? 'border-[rgba(0,240,255,0.5)] bg-[rgba(0,240,255,0.08)] text-cyan'
                    : 'border-line text-dim'
                }`}
              >
                {e.nombre} · {pesos(e.precio)}
                {e.cupo !== null && <span className="ml-1.5 text-faint">({e.cupo} cupos)</span>}
                {vigente && <span className="ml-2 uppercase">vigente</span>}
              </li>
            );
          })}
        </ul>
        {etapa && (
          <p className="mt-3 text-xs text-faint">
            {numero(etapa.vendidas)} entradas tomadas
            {etapa.restantes !== null && ` · quedan ${numero(etapa.restantes)} a este precio`}
          </p>
        )}
      </div>

      {/* ------------------------------------------------------- Carga */}
      <section className="tarjeta mb-9 p-6 sm:p-7">
        <div className="mb-5 flex items-start gap-2.5">
          <Lock size={17} className="mt-0.5 shrink-0 text-violeta" />
          <div>
            <h2 className="font-medium">Agregar invitados</h2>
            <p className="mt-1 text-sm text-dim">
              Solo estos números pueden comprar. El teléfono es la credencial: quien no
              esté acá no pasa del formulario.
            </p>
          </div>
        </div>

        <CargaMasiva eventoId={evento.eventoId} />
      </section>

      {/* ------------------------------------------------------- Lista */}
      {invitados.length === 0 ? (
        <div className="tarjeta flex flex-col items-center gap-3 px-8 py-16 text-center">
          <Inbox size={28} className="text-faint" />
          <p className="titulo-display text-xl">La lista está vacía</p>
          <p className="max-w-xs text-sm text-dim">
            Mientras no haya números cargados, nadie puede comprar.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {invitados.map((i) => {
            const uso = usadas.get(i.invitadoTelefono) ?? 0;
            const lleno = uso >= i.invitadoCupo;

            return (
              <li
                key={i.invitadoId}
                className={`tarjeta flex flex-wrap items-center gap-4 px-5 py-4 ${
                  i.invitadoActivo ? '' : 'opacity-50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="dato font-medium">{formatearTelefono(i.invitadoTelefono)}</p>
                  <p className="mt-0.5 truncate text-sm text-dim">
                    {i.invitadoNombre ?? <span className="text-faint">Sin nombre</span>}
                    <span className="text-faint"> · agregado {hace(i.createdAt)}</span>
                  </p>
                </div>

                {!i.invitadoActivo && <span className="insignia insignia-neutral">Desactivado</span>}

                <span
                  className={`insignia ${
                    lleno ? 'insignia-error' : uso > 0 ? 'insignia-cyan' : 'insignia-neutral'
                  }`}
                >
                  {uso} / {i.invitadoCupo}
                </span>

                <AccionesInvitado invitadoId={i.invitadoId} activo={i.invitadoActivo} />
              </li>
            );
          })}
        </ul>
      )}

      {invitados.length >= 500 && (
        <p className="mt-5 text-center text-sm text-faint">
          Se muestran los primeros 500 de la lista.
        </p>
      )}
    </>
  );
}
