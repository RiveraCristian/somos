import { ExternalLink, Lock, MapPin } from 'lucide-react';

import { enlaceDeMapa } from '@/lib/ubicacion';

type Props = {
  venue: string | null;
  direccion: string | null;
  ciudad: string;
  mapaUrl: string | null;
  /** Compacto para la tarjeta de entrada, amplio para la pagina del comprador. */
  variante?: 'tarjeta' | 'panel';
};

/**
 * La direccion exacta del recinto.
 *
 * Este componente SOLO se monta en paginas que ya exigieron una entrada
 * valida. La portada nunca lo usa: alli la ubicacion es secreta a proposito,
 * y por eso la direccion no viaja al cliente en ninguna vista publica.
 */
export function UbicacionRevelada({
  venue,
  direccion,
  ciudad,
  mapaUrl,
  variante = 'panel',
}: Props) {
  const mapa = enlaceDeMapa({ mapaUrl, direccion, venue, ciudad });

  // Todavia no la cargan en el panel. Vale mas decirlo que mostrar un vacio
  // que parece un error del sitio.
  if (!direccion) {
    return (
      <div className="flex items-start gap-3 rounded-[12px] border border-line bg-white/[0.03] px-4 py-3.5">
        <Lock size={16} className="mt-0.5 shrink-0 text-violeta" />
        <p className="text-sm leading-relaxed text-dim">
          La dirección exacta se publica acá unos días antes del evento, y también te llega por
          correo. Guarda este enlace.
        </p>
      </div>
    );
  }

  if (variante === 'tarjeta') {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="flex items-start gap-2.5 text-sm text-dim">
          <MapPin size={15} className="mt-0.5 shrink-0 text-magenta" />
          <span>
            {venue && <span className="text-ink">{venue}</span>}
            {venue && <br />}
            {direccion}, {ciudad}
          </span>
        </span>
        {mapa && (
          <a
            href={mapa}
            target="_blank"
            rel="noreferrer"
            className="no-imprimir ml-[1.6rem] inline-flex items-center gap-1.5 text-sm text-cyan underline-offset-4 hover:underline"
          >
            Abrir en Google Maps
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-[rgba(255,46,154,0.28)] bg-[rgba(255,46,154,0.05)] px-5 py-4">
      <div className="flex items-start gap-3">
        <MapPin size={18} className="mt-0.5 shrink-0 text-magenta" />
        <div className="min-w-0">
          <p className="dato text-[0.65rem] tracking-[0.16em] text-faint uppercase">
            Dónde es — no lo compartas
          </p>
          {venue && <p className="mt-1.5 font-medium">{venue}</p>}
          <p className="mt-0.5 leading-relaxed text-dim">
            {direccion}, {ciudad}
          </p>

          {mapa && (
            <a
              href={mapa}
              target="_blank"
              rel="noreferrer"
              className="btn btn-borde btn-sm mt-3.5"
            >
              Cómo llegar
              <ExternalLink size={15} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
