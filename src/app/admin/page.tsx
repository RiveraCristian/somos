import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CircleDollarSign,
  Clock3,
  Flame,
  QrCode,
  TicketCheck,
  Users,
} from 'lucide-react';

import { EncabezadoPagina } from '@/components/admin/EncabezadoPagina';
import { TarjetaCifra } from '@/components/admin/TarjetaCifra';
import { obtenerEventoAdmin, resumenVentas } from '@/lib/datos';
import { fechaLarga, hace, numero, pesos } from '@/lib/formato';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Resumen' };

export default async function PaginaResumen() {
  const evento = await obtenerEventoAdmin();

  if (!evento) {
    return (
      <>
        <EncabezadoPagina titulo="Resumen" />
        <div className="tarjeta p-8 text-center">
          <p className="titulo-display text-xl">Todavía no hay evento</p>
          <p className="mt-3 text-dim">
            Corre <code className="dato text-cyan">npm run db:seed</code> para crear el evento
            inicial.
          </p>
        </div>
      </>
    );
  }

  const [ventas, ultimosPendientes, ultimasCompras, porTipo] = await Promise.all([
    resumenVentas(evento.eventoId),
    prisma.pago.findMany({
      where: { isDeleted: false, pagoEstado: 'pendiente' },
      include: { asistente: true },
      orderBy: { pagoFechaDeclarado: 'desc' },
      take: 5,
    }),
    prisma.asistente.findMany({
      where: { asistenteEventoId: evento.eventoId, isDeleted: false },
      include: { tipoEntrada: true },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.asistente.groupBy({
      by: ['asistenteTipoEntradaId'],
      where: {
        asistenteEventoId: evento.eventoId,
        isDeleted: false,
        asistenteEstado: { not: 'anulado' },
      },
      _count: { _all: true },
      _sum: { asistenteMontoPagado: true },
    }),
  ]);

  // Se suma lo efectivamente pagado, no precio x reservas: si no, el total por
  // tipo no cuadraria con la cifra de recaudacion de arriba.
  const porTipoMapa = new Map(
    porTipo.map((f) => [
      f.asistenteTipoEntradaId,
      { reservas: f._count._all, pagado: f._sum.asistenteMontoPagado ?? 0 },
    ]),
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Resumen"
        subtitulo={`${evento.eventoNombre} · ${fechaLarga(evento.eventoFechaInicio) ?? 'fecha por confirmar'}`}
      >
        <Link href="/admin/pagos" className="btn btn-primario btn-sm">
          Revisar pagos
          {ventas.pagosPendientes > 0 && (
            <span className="dato rounded-full bg-void/25 px-1.5 py-0.5 text-[0.7rem]">
              {ventas.pagosPendientes}
            </span>
          )}
        </Link>
      </EncabezadoPagina>

      {/* ------------------------------------------------------------ Cifras */}
      <section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaCifra
          etiqueta="Recaudado"
          valor={pesos(ventas.recaudado)}
          detalle={`${numero(ventas.pagados)} entradas pagadas`}
          icono={CircleDollarSign}
          acento="cyan"
        />
        <TarjetaCifra
          etiqueta="Por revisar"
          valor={numero(ventas.pagosPendientes)}
          detalle="pagos esperando confirmación"
          icono={Clock3}
          acento={ventas.pagosPendientes > 0 ? 'alerta' : 'neutral'}
        />
        <TarjetaCifra
          etiqueta="Reservas"
          valor={numero(ventas.reservas)}
          detalle={`${numero(ventas.reservas - ventas.pagados)} sin pagar todavía`}
          icono={Users}
          acento="violeta"
        />
        <TarjetaCifra
          etiqueta="Entradas emitidas"
          valor={numero(ventas.entradasEmitidas)}
          detalle={`${numero(ventas.entradasQuemadas)} quemadas en puerta`}
          icono={TicketCheck}
          acento="magenta"
        />
      </section>

      {/* -------------------------------------------------- Venta por tipo */}
      <section className="tarjeta mt-4 p-6 sm:p-7">
        <h2 className="font-semibold">Venta por tipo de entrada</h2>
        <p className="mt-1 mb-5 text-xs text-dim">
          Entradas reservadas sobre el cupo, y lo efectivamente pagado de cada una.
        </p>

        <div className="flex flex-col gap-5">
          {evento.tiposEntrada
            .filter((t) => t.tipoEntradaActivo)
            .map((tipo) => {
              const fila = porTipoMapa.get(tipo.tipoEntradaId);
              const reservas = fila?.reservas ?? 0;
              const cupo = tipo.tipoEntradaCupo;
              const porcentaje = cupo ? Math.min(100, Math.round((reservas / cupo) * 100)) : 0;

              return (
                <div key={tipo.tipoEntradaId}>
                  <div className="mb-2 flex items-end justify-between gap-4 text-sm">
                    <span className="font-medium">{tipo.tipoEntradaNombre}</span>
                    <span className="dato text-dim">
                      {cupo ? (
                        <>
                          <b className="text-ink">{numero(reservas)}</b> / {numero(cupo)}
                        </>
                      ) : (
                        <>
                          <b className="text-ink">{numero(reservas)}</b> vendidas
                        </>
                      )}
                      <span className="ml-3 text-ok">{pesos(fila?.pagado ?? 0)}</span>
                    </span>
                  </div>

                  {cupo ? (
                    <div className="barra-progreso !h-2">
                      <span style={{ width: `${Math.max(porcentaje, 2)}%` }} />
                    </div>
                  ) : null}
                </div>
              );
            })}
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* ------------------------------------------------ Pagos pendientes */}
        <section className="tarjeta overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-line bg-[rgba(255,197,61,0.05)] px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(255,197,61,0.3)] bg-[rgba(255,197,61,0.08)] text-alerta">
                <Flame size={17} />
              </span>
              <div>
                <h2 className="font-semibold">Esperando revisión</h2>
                <p className="text-xs text-dim">Comprobantes que hay que mirar</p>
              </div>
            </div>
            <span className="dato text-2xl font-semibold">{ventas.pagosPendientes}</span>
          </header>

          {ultimosPendientes.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-dim">Todo revisado. Nada pendiente.</p>
          ) : (
            <>
              <ul className="divide-y divide-[var(--color-line)]">
                {ultimosPendientes.map((pago) => (
                  <li key={pago.pagoId} className="flex items-center gap-4 px-6 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {pago.asistente.asistenteNombre}
                      </p>
                      <p className="dato text-xs text-faint">{hace(pago.pagoFechaDeclarado)}</p>
                    </div>
                    <span className="dato font-semibold">{pesos(pago.pagoMonto)}</span>
                  </li>
                ))}
              </ul>

              <div className="border-t border-line px-6 py-3.5">
                <Link
                  href="/admin/pagos"
                  className="inline-flex items-center gap-2 text-sm text-cyan underline-offset-4 hover:underline"
                >
                  Revisar todos
                  <ArrowRight size={15} />
                </Link>
              </div>
            </>
          )}
        </section>

        {/* ------------------------------------------------ Últimas compras */}
        <section className="tarjeta overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-line bg-[rgba(123,92,255,0.05)] px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(123,92,255,0.3)] bg-[rgba(123,92,255,0.1)] text-violeta">
                <QrCode size={17} />
              </span>
              <div>
                <h2 className="font-semibold">Últimas compras</h2>
                <p className="text-xs text-dim">Lo más reciente</p>
              </div>
            </div>
            <span className="dato text-2xl font-semibold">{ventas.reservas}</span>
          </header>

          {ultimasCompras.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-dim">Todavía no vende nadie.</p>
          ) : (
            <>
              <ul className="divide-y divide-[var(--color-line)]">
                {ultimasCompras.map((asistente) => (
                  <li key={asistente.asistenteId} className="flex items-center gap-4 px-6 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{asistente.asistenteNombre}</p>
                      <p className="dato truncate text-xs text-faint">
                        {asistente.tipoEntrada.tipoEntradaNombre} · {hace(asistente.createdAt)}
                      </p>
                    </div>
                    {asistente.asistenteMontoPagado > 0 ? (
                      <span className="dato text-sm font-semibold text-ok">
                        {pesos(asistente.asistenteMontoPagado)}
                      </span>
                    ) : (
                      <span className="insignia insignia-neutral">Sin pagar</span>
                    )}
                  </li>
                ))}
              </ul>

              <div className="border-t border-line px-6 py-3.5">
                <Link
                  href="/admin/asistentes"
                  className="inline-flex items-center gap-2 text-sm text-cyan underline-offset-4 hover:underline"
                >
                  Ver todos
                  <ArrowRight size={15} />
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
