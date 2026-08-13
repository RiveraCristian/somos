import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, MapPin, ShieldCheck } from 'lucide-react';

import { BotonImprimir } from '@/components/publico/BotonImprimir';
import { Logo } from '@/components/marca/Logo';
import { paletaDeTipo } from '@/lib/constantes';
import { obtenerEntradaPorToken } from '@/lib/datos';
import { fechaHora, fechaLarga, hora } from '@/lib/formato';
import { qrComoDataUrl, urlDeEntrada } from '@/lib/qr';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mi entrada',
  robots: { index: false, follow: false },
};

export default async function PaginaEntrada({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const entrada = await obtenerEntradaPorToken(token);

  if (!entrada) notFound();

  const { asistente, tipoEntrada } = entrada;
  const evento = asistente.evento;
  const paleta = paletaDeTipo(tipoEntrada.tipoEntradaColor);

  const quemada = entrada.entradaEstado === 'quemada';
  const anulada = entrada.entradaEstado === 'anulada';

  const qr = await qrComoDataUrl(urlDeEntrada(entrada.entradaToken), 520);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="no-imprimir mb-7 flex items-center justify-between">
          <Link href="/" aria-label="SOMOS — inicio">
            <Logo alto={22} />
          </Link>
          <BotonImprimir />
        </div>

        {/* ------------------------------------------------------- El ticket */}
        <article className="tarjeta-solida relative overflow-hidden">
          {/* Franja de marca */}
          <div className="h-1 bg-[linear-gradient(90deg,#00F0FF,#7B5CFF_52%,#FF2E9A)]" />

          <div className="p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Entrada</p>
                <h1 className="titulo-display mt-2 text-3xl">{evento.eventoNombre}</h1>
              </div>

              <span
                className="dato rounded-full border px-2.5 py-1 text-[0.65rem] tracking-[0.14em] uppercase"
                style={{ color: paleta.texto, borderColor: paleta.borde, background: paleta.fondo }}
              >
                {tipoEntrada.tipoEntradaNombre}
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-2.5 text-sm">
              <div className="dato text-[0.65rem] tracking-[0.16em] text-faint uppercase">
                A nombre de
              </div>
              <div className="text-base font-medium">{asistente.asistenteNombre}</div>
            </div>

            <div className="mt-5 flex flex-col gap-2 text-sm text-dim">
              <span className="flex items-center gap-2.5">
                <CalendarDays size={15} className="shrink-0 text-cyan" />
                {evento.eventoFechaInicio
                  ? `${fechaLarga(evento.eventoFechaInicio)} · ${hora(evento.eventoFechaInicio)} hrs`
                  : 'Fecha por confirmar'}
              </span>
              <span className="flex items-center gap-2.5">
                <MapPin size={15} className="shrink-0 text-magenta" />
                {evento.eventoVenue ?? 'Lugar por confirmar'}
                {evento.eventoCiudad ? `, ${evento.eventoCiudad}` : ''}
              </span>
            </div>
          </div>

          {/* Perforado */}
          <div className="perforado mx-7" />

          {/* --------------------------------------------------------- QR */}
          <div className="flex flex-col items-center gap-4 px-7 pt-8 pb-9">
            <div className="relative rounded-[14px] bg-white p-3.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt={`Código QR de la entrada ${entrada.entradaCodigo}`}
                width={200}
                height={200}
                className="block h-[200px] w-[200px]"
              />

              {(quemada || anulada) && (
                <div className="absolute inset-0 flex items-center justify-center rounded-[14px] bg-void/88">
                  <span
                    className={`titulo-display -rotate-[9deg] border-[3px] px-4 py-1.5 text-2xl tracking-[0.12em] ${
                      anulada ? 'border-error text-error' : 'border-magenta text-magenta'
                    }`}
                    style={{
                      textShadow: `0 0 22px ${anulada ? 'rgba(255,77,109,.6)' : 'rgba(255,46,154,.6)'}`,
                    }}
                  >
                    {anulada ? 'ANULADA' : 'QUEMADA'}
                  </span>
                </div>
              )}
            </div>

            <p className="dato text-sm tracking-[0.28em] text-ink">{entrada.entradaCodigo}</p>

            {quemada ? (
              <p className="max-w-[16rem] text-center text-xs leading-relaxed text-dim">
                Esta entrada ya se usó el {fechaHora(entrada.entradaFechaQuemada)}.
              </p>
            ) : anulada ? (
              <p className="max-w-[16rem] text-center text-xs leading-relaxed text-error">
                Esta entrada fue anulada. Escríbenos si crees que es un error.
              </p>
            ) : (
              <p className="flex max-w-[17rem] items-start gap-2 text-center text-xs leading-relaxed text-dim">
                <ShieldCheck size={14} className="mt-px shrink-0 text-ok" />
                <span>
                  De un solo uso. Se quema al escanearla en la puerta, así que no la compartas.
                </span>
              </p>
            )}
          </div>
        </article>

        <p className="no-imprimir mt-7 text-center text-sm text-dim">
          <Link
            href={`/mi-entrada/${asistente.asistenteToken}`}
            className="text-cyan underline-offset-4 hover:underline"
          >
            Volver a mi página
          </Link>
        </p>
      </div>
    </main>
  );
}
