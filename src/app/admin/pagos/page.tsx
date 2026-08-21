import type { Metadata } from 'next';
import Link from 'next/link';
import { FileWarning, Inbox, Info, Paperclip, Zap } from 'lucide-react';

import { EncabezadoPagina } from '@/components/admin/EncabezadoPagina';
import { ETIQUETAS_METODO, type MetodoPago } from '@/lib/constantes';
import { ETIQUETAS_PASARELA, diagnosticoPasarela } from '@/lib/pasarela';
import { fechaHora, hace, pesos, tamanoArchivo } from '@/lib/formato';
import { prisma } from '@/lib/prisma';

import { AccionesPago } from './AccionesPago';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Pagos' };

const FILTROS = [
  { valor: 'pendiente', texto: 'Por revisar' },
  { valor: 'confirmado', texto: 'Confirmados' },
  { valor: 'rechazado', texto: 'Rechazados' },
  { valor: 'todos', texto: 'Todos' },
] as const;

export default async function PaginaPagos({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const parametros = await searchParams;
  const filtro = FILTROS.find((f) => f.valor === parametros.estado)?.valor ?? 'pendiente';

  const [pagos, conteos] = await Promise.all([
    prisma.pago.findMany({
      where: {
        isDeleted: false,
        ...(filtro !== 'todos' ? { pagoEstado: filtro } : {}),
      },
      include: { asistente: { include: { tipoEntrada: true } }, revisor: true },
      orderBy: { pagoFechaDeclarado: 'desc' },
      take: 200,
    }),
    prisma.pago.groupBy({
      by: ['pagoEstado'],
      where: { isDeleted: false },
      _count: { _all: true },
    }),
  ]);

  const conteoPorEstado = new Map(conteos.map((c) => [c.pagoEstado, c._count._all]));
  const total = conteos.reduce((suma, c) => suma + c._count._all, 0);
  const pasarela = await diagnosticoPasarela();

  return (
    <>
      <EncabezadoPagina
        titulo="Pagos"
        subtitulo={`${conteoPorEstado.get('pendiente') ?? 0} esperando revisión de ${total} en total`}
      />

      {/* Diagnóstico: por qué el cobro en línea aparece o no en el sitio. */}
      <div
        className={`mb-7 flex items-start gap-3 rounded-[12px] border px-5 py-4 ${
          pasarela.activa
            ? 'border-[rgba(53,240,160,0.3)] bg-[rgba(53,240,160,0.06)]'
            : 'border-line bg-white/[0.02]'
        }`}
      >
        {pasarela.activa ? (
          <Zap size={18} className="mt-0.5 shrink-0 text-ok" />
        ) : (
          <Info size={18} className="mt-0.5 shrink-0 text-dim" />
        )}
        <div className="text-sm">
          {pasarela.activa ? (
            <>
              <p className="font-medium">
                Cobro en línea activo con {ETIQUETAS_PASARELA[pasarela.activa]}
              </p>
              <p className="mt-1 text-dim">
                {pasarela.detalle ??
                  'Los compradores pagan sin salir del sitio y su entrada se emite sola.'}
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Cobro en línea apagado</p>
              <p className="mt-1 text-dim">
                {pasarela.problema} Mientras tanto, todo pasa por transferencia manual y
                confirmación acá.
              </p>
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ Filtros */}
      <nav className="mb-7 flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const activo = f.valor === filtro;
          const cantidad = f.valor === 'todos' ? total : (conteoPorEstado.get(f.valor) ?? 0);

          return (
            <Link
              key={f.valor}
              href={`/admin/pagos?estado=${f.valor}`}
              className={`dato rounded-full border px-4 py-2 text-xs tracking-[0.1em] uppercase transition-colors ${
                activo
                  ? 'border-[rgba(0,240,255,0.5)] bg-[rgba(0,240,255,0.08)] text-cyan'
                  : 'border-line text-dim hover:border-line-fuerte hover:text-ink'
              }`}
            >
              {f.texto}
              <span className="ml-2 text-faint">{cantidad}</span>
            </Link>
          );
        })}
      </nav>

      {/* ------------------------------------------------------------- Lista */}
      {pagos.length === 0 ? (
        <div className="tarjeta flex flex-col items-center gap-3 px-8 py-16 text-center">
          <Inbox size={28} className="text-faint" />
          <p className="titulo-display text-xl">Nada por acá</p>
          <p className="max-w-xs text-sm text-dim">
            {filtro === 'pendiente'
              ? 'No hay pagos esperando revisión. Todo al día.'
              : 'No hay pagos con ese estado.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {pagos.map((pago) => (
            <li key={pago.pagoId} className="tarjeta p-5 sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                {/* Datos del pago */}
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="dato text-2xl font-semibold">{pesos(pago.pagoMonto)}</span>

                    {pago.pagoEstado === 'confirmado' ? (
                      <span className="insignia insignia-ok">Confirmado</span>
                    ) : pago.pagoEstado === 'rechazado' ? (
                      <span className="insignia insignia-error">Rechazado</span>
                    ) : (
                      <span className="insignia insignia-pendiente">Por revisar</span>
                    )}

                    <span className="insignia insignia-neutral">
                      {ETIQUETAS_METODO[pago.pagoMetodo as MetodoPago] ?? pago.pagoMetodo}
                    </span>

                    {pago.pagoProveedor !== 'manual' && (
                      <span className="insignia insignia-cyan">
                        <Zap size={11} /> Automático
                      </span>
                    )}

                    {pago.pagoMonto !== pago.asistente.asistentePrecio && (
                      <span className="insignia insignia-pendiente">
                        No calza con {pesos(pago.asistente.asistentePrecio)}
                      </span>
                    )}
                  </div>

                  <div>
                    <Link
                      href={`/admin/asistentes?buscar=${encodeURIComponent(pago.asistente.asistenteCorreo)}`}
                      className="font-medium underline-offset-4 hover:text-cyan hover:underline"
                    >
                      {pago.asistente.asistenteNombre}
                    </Link>
                    <p className="dato mt-0.5 text-sm text-dim">
                      {pago.asistente.asistenteCorreo} ·{' '}
                      {pago.asistente.tipoEntrada.tipoEntradaNombre}
                    </p>
                  </div>

                  <div className="dato flex flex-wrap gap-x-5 gap-y-1 text-xs text-faint">
                    <span title={fechaHora(pago.pagoFechaDeclarado) ?? ''}>
                      Declarado {hace(pago.pagoFechaDeclarado)}
                    </span>
                    {pago.pagoReferencia && <span>Op. {pago.pagoReferencia}</span>}
                    {pago.pagoExternoSesion && <span>Sesión {pago.pagoExternoSesion}</span>}
                    {pago.pagoExternoPago && <span>Cobro {pago.pagoExternoPago}</span>}
                    {pago.pagoFechaRevisado && pago.revisor && (
                      <span>
                        Revisado por {pago.revisor.usuarioNombre} ·{' '}
                        {fechaHora(pago.pagoFechaRevisado)}
                      </span>
                    )}
                  </div>

                  {pago.pagoMensaje && (
                    <p className="rounded-[10px] border border-line bg-white/[0.02] px-3.5 py-2.5 text-sm leading-relaxed text-dim">
                      {pago.pagoMensaje}
                    </p>
                  )}

                  {pago.pagoMotivoRechazo && (
                    <p className="rounded-[10px] border border-[rgba(255,77,109,0.25)] bg-[rgba(255,77,109,0.06)] px-3.5 py-2.5 text-sm text-error">
                      {pago.pagoMotivoRechazo}
                    </p>
                  )}
                </div>

                {/* Comprobante */}
                <div className="lg:w-44">
                  {pago.pagoProveedor !== 'manual' ? (
                    <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-[12px] border border-[rgba(0,240,255,0.25)] bg-[rgba(0,240,255,0.05)] px-3 text-center text-cyan">
                      <Zap size={20} />
                      <span className="text-xs leading-relaxed">
                        Cobro en línea
                        <br />
                        <span className="text-faint">sin comprobante que revisar</span>
                      </span>
                    </div>
                  ) : pago.pagoComprobanteArchivo ? (
                    <a
                      href={`/api/comprobante/${pago.pagoComprobanteArchivo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="group block overflow-hidden rounded-[12px] border border-line transition-colors hover:border-[rgba(0,240,255,0.5)]"
                    >
                      {pago.pagoComprobanteMime?.startsWith('image/') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/comprobante/${pago.pagoComprobanteArchivo}`}
                          alt="Comprobante de transferencia"
                          className="h-32 w-full bg-white/[0.02] object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-32 flex-col items-center justify-center gap-2 bg-white/[0.02] text-dim">
                          <Paperclip size={20} />
                          <span className="text-xs">PDF</span>
                        </div>
                      )}
                      <p className="dato truncate border-t border-line px-2.5 py-1.5 text-[0.65rem] text-faint">
                        {tamanoArchivo(pago.pagoComprobanteTamano)} · ver
                      </p>
                    </a>
                  ) : (
                    <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-line text-faint">
                      <FileWarning size={20} />
                      <span className="text-xs">Sin comprobante</span>
                    </div>
                  )}
                </div>

                {/* Acciones */}
                {pago.pagoEstado === 'pendiente' && (
                  <AccionesPago pagoId={pago.pagoId} proveedor={pago.pagoProveedor} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
