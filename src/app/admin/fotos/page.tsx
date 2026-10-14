import type { Metadata } from 'next';
import { Images, Inbox } from 'lucide-react';

import { EncabezadoPagina } from '@/components/admin/EncabezadoPagina';
import { urlDeFoto } from '@/lib/archivos';
import { obtenerEventoAdmin } from '@/lib/datos';
import { numero } from '@/lib/formato';
import { prisma } from '@/lib/prisma';

import { AccionesFoto, SubirFotos } from './Formularios';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Galería' };

export default async function PaginaFotos() {
  const evento = await obtenerEventoAdmin();

  if (!evento) {
    return (
      <>
        <EncabezadoPagina titulo="Galería" />
        <p className="text-dim">Primero crea el evento.</p>
      </>
    );
  }

  const fotos = await prisma.foto.findMany({
    where: { fotoEventoId: evento.eventoId },
    orderBy: { fotoOrden: 'asc' },
  });

  const visibles = fotos.filter((f) => f.fotoActiva).length;

  return (
    <>
      <EncabezadoPagina
        titulo="Galería"
        subtitulo={
          fotos.length === 0
            ? 'Todavía no hay fotos cargadas'
            : `${numero(visibles)} en la portada · ${numero(fotos.length)} cargadas`
        }
      />

      <section className="tarjeta mb-9 p-6 sm:p-7">
        <div className="mb-5 flex items-start gap-2.5">
          <Images size={17} className="mt-0.5 shrink-0 text-violeta" />
          <div>
            <h2 className="font-medium">Fotos de eventos anteriores</h2>
            <p className="mt-1 text-sm text-dim">
              Salen en una grilla en la portada, en el orden que les des acá. Si no hay ninguna
              activa, la sección no aparece.
            </p>
          </div>
        </div>

        <SubirFotos eventoId={evento.eventoId} />
      </section>

      {fotos.length === 0 ? (
        <div className="tarjeta flex flex-col items-center gap-3 px-8 py-16 text-center">
          <Inbox size={28} className="text-faint" />
          <p className="titulo-display text-xl">Sin fotos</p>
          <p className="max-w-sm text-sm leading-relaxed text-dim">
            Cuando subas la primera, aparecerá acá y en la portada.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fotos.map((foto, i) => (
            <li
              key={foto.fotoId}
              className={`tarjeta overflow-hidden ${foto.fotoActiva ? '' : 'opacity-55'}`}
            >
              <div className="relative aspect-[4/3] bg-white/[0.03]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urlDeFoto(foto.fotoArchivo)}
                  alt={foto.fotoAlt ?? `Foto ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                {!foto.fotoActiva && (
                  <span className="insignia insignia-neutral absolute top-3 right-3">Oculta</span>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 p-3">
                <span className="dato text-xs text-faint">#{foto.fotoOrden}</span>
                <AccionesFoto
                  fotoId={foto.fotoId}
                  activa={foto.fotoActiva}
                  primera={i === 0}
                  ultima={i === fotos.length - 1}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
