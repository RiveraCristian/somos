import type { Metadata } from 'next';
import { Handshake, ImageOff, Inbox } from 'lucide-react';

import { EncabezadoPagina } from '@/components/admin/EncabezadoPagina';
import { urlDeLogo } from '@/lib/archivos';
import { obtenerEventoAdmin } from '@/lib/datos';
import { numero } from '@/lib/formato';

import { AccionesAuspiciador, FormularioAuspiciador } from './Formularios';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Auspiciadores' };

export default async function PaginaAuspiciadores() {
  const evento = await obtenerEventoAdmin();

  if (!evento) {
    return (
      <>
        <EncabezadoPagina titulo="Auspiciadores" />
        <p className="text-dim">Primero crea el evento.</p>
      </>
    );
  }

  const auspiciadores = evento.auspiciadores;
  const visibles = auspiciadores.filter((a) => a.auspiciadorActivo).length;
  const siguienteOrden =
    auspiciadores.reduce((mayor, a) => Math.max(mayor, a.auspiciadorOrden), 0) + 1;

  return (
    <>
      <EncabezadoPagina
        titulo="Auspiciadores"
        subtitulo={
          auspiciadores.length === 0
            ? 'Todavía no hay ninguno cargado'
            : `${numero(visibles)} en la portada · ${numero(auspiciadores.length)} cargados`
        }
      />

      {/* ------------------------------------------------------- Alta */}
      <section className="tarjeta mb-9 p-6 sm:p-7">
        <div className="mb-5 flex items-start gap-2.5">
          <Handshake size={17} className="mt-0.5 shrink-0 text-violeta" />
          <div>
            <h2 className="font-medium">Agregar un auspiciador</h2>
            <p className="mt-1 text-sm text-dim">
              Los logos salen en una fila al final de la portada, ordenados por el número que
              les pongas. Si no hay ninguno activo, la sección no aparece.
            </p>
          </div>
        </div>

        <FormularioAuspiciador eventoId={evento.eventoId} siguienteOrden={siguienteOrden} />
      </section>

      {/* ------------------------------------------------------- Lista */}
      {auspiciadores.length === 0 ? (
        <div className="tarjeta flex flex-col items-center gap-3 px-8 py-16 text-center">
          <Inbox size={28} className="text-faint" />
          <p className="titulo-display text-xl">Sin auspiciadores</p>
          <p className="max-w-sm text-sm leading-relaxed text-dim">
            Cuando cargues el primero, aparecerá acá y en la portada.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {auspiciadores.map((auspiciador) => (
            <li
              key={auspiciador.auspiciadorId}
              className={`tarjeta flex flex-wrap items-center gap-5 p-4 ${
                auspiciador.auspiciadorActivo ? '' : 'opacity-55'
              }`}
            >
              <div className="flex h-14 w-32 shrink-0 items-center justify-center rounded-[10px] border border-line bg-white/[0.03] px-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urlDeLogo(auspiciador.auspiciadorLogo)}
                  alt={auspiciador.auspiciadorNombre}
                  className="max-h-10 w-auto max-w-full object-contain"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-medium">{auspiciador.auspiciadorNombre}</p>
                <p className="mt-1 truncate text-sm text-dim">
                  {auspiciador.auspiciadorSitio ? (
                    <a
                      href={auspiciador.auspiciadorSitio}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan underline-offset-4 hover:underline"
                    >
                      {auspiciador.auspiciadorSitio}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-faint">
                      <ImageOff size={13} />
                      Sin enlace
                    </span>
                  )}
                </p>
              </div>

              <span className="dato text-xs text-faint">orden {auspiciador.auspiciadorOrden}</span>

              {!auspiciador.auspiciadorActivo && (
                <span className="insignia insignia-neutral">Oculto</span>
              )}

              <AccionesAuspiciador
                auspiciadorId={auspiciador.auspiciadorId}
                activo={auspiciador.auspiciadorActivo}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
