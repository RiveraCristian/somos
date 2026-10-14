import type { Metadata } from 'next';
import { ExternalLink, Inbox, Instagram } from 'lucide-react';

import { EncabezadoPagina } from '@/components/admin/EncabezadoPagina';
import { obtenerEventoAdmin } from '@/lib/datos';
import { numero } from '@/lib/formato';
import { permalinkDe } from '@/lib/instagram';
import { prisma } from '@/lib/prisma';

import { AccionesPost, AgregarPosts } from './Formularios';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Instagram' };

export default async function PaginaInstagram() {
  const evento = await obtenerEventoAdmin();

  if (!evento) {
    return (
      <>
        <EncabezadoPagina titulo="Instagram" />
        <p className="text-dim">Primero crea el evento.</p>
      </>
    );
  }

  const posts = await prisma.publicacionIg.findMany({
    where: { publicacionEventoId: evento.eventoId },
    orderBy: { publicacionOrden: 'asc' },
  });

  const visibles = posts.filter((p) => p.publicacionActiva).length;

  return (
    <>
      <EncabezadoPagina
        titulo="Instagram"
        subtitulo={
          posts.length === 0
            ? 'Todavía no hay posts cargados'
            : `${numero(visibles)} en la portada · ${numero(posts.length)} cargados`
        }
      />

      <section className="tarjeta mb-9 p-6 sm:p-7">
        <div className="mb-5 flex items-start gap-2.5">
          <Instagram size={17} className="mt-0.5 shrink-0 text-violeta" />
          <div>
            <h2 className="font-medium">Posts de fiestas anteriores</h2>
            <p className="mt-1 text-sm leading-relaxed text-dim">
              Se muestran en la portada como publicaciones reales de Instagram, con su diseño y
              clickeables. No se lee el feed automáticamente: Meta lo cerró en 2024 y su
              reemplazo exige una app propia y un token que caduca cada 60 días. Así, eliges tú
              cuáles se ven y no se rompe nunca.
            </p>
          </div>
        </div>

        <AgregarPosts eventoId={evento.eventoId} />
      </section>

      {posts.length === 0 ? (
        <div className="tarjeta flex flex-col items-center gap-3 px-8 py-16 text-center">
          <Inbox size={28} className="text-faint" />
          <p className="titulo-display text-xl">Sin posts</p>
          <p className="max-w-sm text-sm leading-relaxed text-dim">
            Cuando agregues el primero, la sección aparece en la portada.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((post, i) => {
            const url = permalinkDe({
              codigo: post.publicacionCodigo,
              tipo: post.publicacionTipo,
            });

            return (
              <li
                key={post.publicacionId}
                className={`tarjeta flex flex-wrap items-center gap-4 p-4 ${
                  post.publicacionActiva ? '' : 'opacity-55'
                }`}
              >
                <span className="dato text-xs text-faint">#{post.publicacionOrden}</span>

                <div className="min-w-0 flex-1">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-cyan underline-offset-4 hover:underline"
                  >
                    {post.publicacionTipo === 'p' ? 'Post' : 'Reel'} · {post.publicacionCodigo}
                    <ExternalLink size={13} />
                  </a>
                  <p className="dato mt-1 truncate text-xs text-faint">{url}</p>
                </div>

                {!post.publicacionActiva && (
                  <span className="insignia insignia-neutral">Oculto</span>
                )}

                <AccionesPost
                  publicacionId={post.publicacionId}
                  activa={post.publicacionActiva}
                  primera={i === 0}
                  ultima={i === posts.length - 1}
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
