import Link from 'next/link';
import {
  ArrowRight,
  ChevronDown,
  Clock,
  Disc3,
  MapPin,
  QrCode,
  Ticket,
  Upload,
  Users,
} from 'lucide-react';

import { CuentaRegresiva } from '@/components/publico/CuentaRegresiva';
import { Encabezado } from '@/components/publico/Encabezado';
import { OndaAnimada } from '@/components/publico/OndaAnimada';
import { PiePagina } from '@/components/publico/PiePagina';
import { Logo } from '@/components/marca/Logo';
import { paletaDeTipo } from '@/lib/constantes';
import { cuposPorTipo, obtenerEventoPublico } from '@/lib/datos';
import { fechaLarga, hora, numero, pesos } from '@/lib/formato';

// El stock de entradas cambia en vivo: nunca se cachea la pagina.
export const dynamic = 'force-dynamic';

const PASOS = [
  {
    icono: <Users size={18} />,
    titulo: 'Eliges tu entrada',
    texto: 'Preventa, General o VIP. Dejas tu nombre y correo y te la reservamos.',
  },
  {
    icono: <Upload size={18} />,
    titulo: 'Pagas por Tenpo',
    texto:
      'Transfieres el valor de tu entrada a nuestra cuenta y subes la captura de la transferencia.',
  },
  {
    icono: <QrCode size={18} />,
    titulo: 'Te llega tu QR',
    texto:
      'Revisamos el comprobante a mano. Al confirmarlo emitimos tu entrada y te la mandamos por correo.',
  },
];

export default async function PaginaInicio() {
  const evento = await obtenerEventoPublico();

  if (!evento) {
    return <SinEvento />;
  }

  const cupos = await cuposPorTipo(evento.eventoId);

  const fechaTexto = fechaLarga(evento.eventoFechaInicio);
  const horaTexto = hora(evento.eventoFechaInicio);

  return (
    <>
      <Encabezado />

      {/* ---------------------------------------------------------------- HERO */}
      <section className="relative flex min-h-[86vh] flex-col items-center justify-center overflow-hidden px-6 py-20">
        <OndaAnimada className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />

        {/* Difumina la onda en los bordes para que el texto respire. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_50%,transparent_20%,var(--color-void)_88%)]" />

        <div className="relative z-10 flex w-full max-w-4xl flex-col items-center text-center">
          <p className="eyebrow animar-aparecer">
            {[evento.eventoCiudad, evento.eventoRegion].filter(Boolean).join(' · ')}
          </p>

          <Logo
            variante="palabra"
            alto={140}
            className="animar-aparecer mt-7 h-auto w-full max-w-2xl"
          />

          {evento.eventoLema && (
            <p className="animar-aparecer mt-8 max-w-xl text-lg leading-relaxed text-balance text-dim">
              {evento.eventoLema}
            </p>
          )}

          <div className="animar-aparecer mt-10">
            <CuentaRegresiva fechaIso={evento.eventoFechaInicio?.toISOString() ?? null} />
          </div>

          <div className="animar-aparecer mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm text-dim">
            <span className="inline-flex items-center gap-2">
              <MapPin size={15} className="text-cyan" />
              {evento.eventoVenue ?? 'Lugar por confirmar'}
            </span>
            {horaTexto && (
              <span className="inline-flex items-center gap-2">
                <Clock size={15} className="text-violeta" />
                {horaTexto} hrs
              </span>
            )}
            <span className="inline-flex items-center gap-2">
              <Ticket size={15} className="text-magenta" />
              {evento.eventoCapacidad
                ? `${numero(evento.eventoCapacidad)} cupos`
                : 'Cupos limitados'}
            </span>
          </div>

          <div className="animar-aparecer mt-11 flex flex-wrap items-center justify-center gap-3">
            <Link href="/comprar" className="btn btn-primario">
              Comprar entrada
              <ArrowRight size={18} />
            </Link>
            <Link href="#entradas" className="btn btn-borde">
              Ver precios
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ ENTRADAS */}
      <section id="entradas" className="contenedor scroll-mt-24 py-16">
        <EncabezadoSeccion
          etiqueta="Entradas"
          titulo="Elige la tuya"
          descripcion="Una entrada por persona. El QR se quema al entrar, así que no se puede compartir."
        />

        <div className="grid gap-5 md:grid-cols-3">
          {evento.tiposEntrada.map((tipo) => {
            const paleta = paletaDeTipo(tipo.tipoEntradaColor);
            const tomadas = cupos.get(tipo.tipoEntradaId) ?? 0;
            const restantes =
              tipo.tipoEntradaCupo !== null ? Math.max(0, tipo.tipoEntradaCupo - tomadas) : null;
            const agotado = restantes === 0;

            return (
              <article
                key={tipo.tipoEntradaId}
                className="tarjeta relative flex flex-col gap-5 p-7 transition-all duration-300 hover:-translate-y-1"
                style={{ borderColor: agotado ? undefined : paleta.borde }}
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-24 rounded-t-[16px] opacity-60"
                  style={{ background: `linear-gradient(180deg, ${paleta.fondo}, transparent)` }}
                />

                <div className="relative flex items-start justify-between gap-3">
                  <span
                    className="dato text-xs tracking-[0.2em] uppercase"
                    style={{ color: paleta.texto }}
                  >
                    {tipo.tipoEntradaNombre}
                  </span>
                  {agotado ? (
                    <span className="insignia insignia-error">Agotada</span>
                  ) : restantes !== null && restantes <= 10 ? (
                    <span className="insignia insignia-pendiente">Quedan {restantes}</span>
                  ) : null}
                </div>

                <div className="relative">
                  <div className="titulo-display text-4xl">{pesos(tipo.tipoEntradaPrecio)}</div>
                  <div className="mt-1 text-xs text-faint">por persona</div>
                </div>

                {tipo.tipoEntradaDescripcion && (
                  <p className="relative text-sm leading-relaxed text-dim">
                    {tipo.tipoEntradaDescripcion}
                  </p>
                )}

                <div className="perforado relative mt-auto pt-5">
                  <Link
                    href={agotado ? '/comprar' : `/comprar?tipo=${tipo.tipoEntradaSlug}`}
                    aria-disabled={agotado}
                    className={`btn btn-borde w-full ${agotado ? 'pointer-events-none opacity-45' : ''}`}
                  >
                    {agotado ? 'Sin stock' : 'Comprar'}
                    {!agotado && <ArrowRight size={16} />}
                  </Link>

                  {restantes !== null && !agotado && (
                    <p className="dato mt-3 text-center text-xs text-faint">
                      {tomadas} / {tipo.tipoEntradaCupo} vendidas
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {fechaTexto && (
          <p className="dato mt-8 text-center text-sm text-dim">
            {fechaTexto}
            {evento.eventoVenue ? ` · ${evento.eventoVenue}` : ''}
          </p>
        )}
      </section>

      {/* ------------------------------------------------------ CÓMO FUNCIONA */}
      <section id="como-funciona" className="contenedor scroll-mt-24 py-16">
        <div className="borde-neon tarjeta overflow-hidden">
          <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
            <div>
              <p className="eyebrow">Cómo funciona</p>
              <h2 className="titulo-display mt-3 text-3xl sm:text-4xl">Tres pasos y estás dentro</h2>
              <p className="mt-4 max-w-md leading-relaxed text-dim">
                {evento.eventoDescripcion ??
                  'Compras tu entrada, pagas por Tenpo y te mandamos el QR por correo.'}
              </p>
            </div>

            <ol className="flex flex-col gap-5">
              {PASOS.map((paso, i) => (
                <li key={paso.titulo} className="tarjeta-solida flex gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-fuerte bg-white/[0.04] text-cyan">
                    {paso.icono}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="dato text-xs text-faint">0{i + 1}</span>
                      <h3 className="font-semibold">{paso.titulo}</h3>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-dim">{paso.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- LINEUP */}
      {evento.artistas.length > 0 && (
        <section id="lineup" className="contenedor scroll-mt-24 py-16">
          <EncabezadoSeccion
            etiqueta="Line-up"
            titulo="Quién toca"
            descripcion="El orden de la noche. Se va confirmando a medida que cerramos fechas."
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {evento.artistas.map((artista) => (
              <article
                key={artista.artistaId}
                className={`tarjeta group relative overflow-hidden p-6 transition-transform duration-300 hover:-translate-y-1 ${
                  artista.artistaDestacado ? 'sm:col-span-2 lg:col-span-1' : ''
                }`}
              >
                {artista.artistaDestacado && (
                  <span className="insignia insignia-cyan absolute top-5 right-5">Headliner</span>
                )}

                <Disc3
                  size={20}
                  className={artista.artistaDestacado ? 'text-magenta' : 'text-violeta'}
                />

                <h3 className="titulo-display mt-4 text-2xl">{artista.artistaNombre}</h3>

                {artista.artistaGenero && (
                  <p className="dato mt-1.5 text-xs tracking-[0.16em] text-cyan uppercase">
                    {artista.artistaGenero}
                  </p>
                )}

                {artista.artistaDescripcion && (
                  <p className="mt-3 text-sm leading-relaxed text-dim">
                    {artista.artistaDescripcion}
                  </p>
                )}

                {artista.artistaHoraInicio && (
                  <p className="dato mt-4 text-sm text-dim">
                    {hora(artista.artistaHoraInicio)}
                    {artista.artistaHoraTermino ? ` — ${hora(artista.artistaHoraTermino)}` : ''}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ PREGUNTAS */}
      {evento.preguntas.length > 0 && (
        <section id="preguntas" className="contenedor scroll-mt-24 py-16">
          <EncabezadoSeccion etiqueta="Preguntas" titulo="Lo que siempre nos preguntan" />

          <div className="mx-auto max-w-3xl divide-y divide-[var(--color-line)] overflow-hidden rounded-[16px] border border-line">
            {evento.preguntas.map((p) => (
              <details key={p.preguntaId} className="group bg-white/[0.02] px-6 open:bg-white/[0.035]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium">
                  {p.preguntaTexto}
                  <ChevronDown
                    size={18}
                    className="shrink-0 text-dim transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>
                <p className="pb-6 text-sm leading-relaxed whitespace-pre-line text-dim">
                  {p.preguntaRespuesta}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* --------------------------------------------------------------- CIERRE */}
      <section className="contenedor py-16">
        <div className="tarjeta relative overflow-hidden px-8 py-14 text-center sm:px-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_50%_0%,rgba(123,92,255,0.18),transparent_70%)]" />
          <div className="relative">
            <h2 className="titulo-display text-3xl sm:text-4xl">
              <span className="texto-neon">Nos vemos en la pista</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md leading-relaxed text-dim">
              Compra tu entrada y guarda tu QR. Una entrada, una persona.
            </p>
            <Link href="/comprar" className="btn btn-primario mt-8">
              Comprar entrada
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <PiePagina instagram={evento.eventoInstagram} ciudad={evento.eventoCiudad} />
    </>
  );
}

function EncabezadoSeccion({
  etiqueta,
  titulo,
  descripcion,
}: {
  etiqueta: string;
  titulo: string;
  descripcion?: string;
}) {
  return (
    <div className="mb-9">
      <p className="eyebrow">{etiqueta}</p>
      <h2 className="titulo-display mt-3 text-3xl sm:text-4xl">{titulo}</h2>
      {descripcion && <p className="mt-3 max-w-2xl leading-relaxed text-dim">{descripcion}</p>}
    </div>
  );
}

function SinEvento() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo alto={40} />
      <h1 className="titulo-display text-3xl">Todavía no hay ningún evento cargado</h1>
      <p className="max-w-md leading-relaxed text-dim">
        Corre las migraciones y el seed para crear el evento inicial:
      </p>
      <code className="dato rounded-lg border border-line bg-white/[0.04] px-4 py-3 text-sm text-cyan">
        npm run db:deploy &amp;&amp; npm run db:seed
      </code>
      <Link href="/ingresar" className="btn btn-borde mt-2">
        Acceso staff
      </Link>
    </div>
  );
}
