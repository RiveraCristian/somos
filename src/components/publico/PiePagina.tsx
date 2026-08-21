import Link from 'next/link';
import { Instagram } from 'lucide-react';

import { Logo } from '@/components/marca/Logo';

type Props = {
  instagram?: string | null;
  ciudad?: string | null;
};

export function PiePagina({ instagram, ciudad }: Props) {
  return (
    <footer className="mt-24 border-t border-line py-14">
      <div className="contenedor flex flex-col items-center gap-7 text-center">
        <Logo alto={52} className="opacity-50" />

        <p className="max-w-md text-sm leading-relaxed text-dim">
          Fiesta de música electrónica. Una entrada por persona, con QR de un solo uso.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          {instagram && (
            <a
              href={`https://instagram.com/${instagram.replace(/^@/, '')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-dim transition-colors hover:text-magenta"
            >
              <Instagram size={16} />@{instagram.replace(/^@/, '')}
            </a>
          )}
          <Link href="/mi-entrada" className="text-dim transition-colors hover:text-ink">
            Ver mi entrada
          </Link>
          <Link href="/ingresar" className="text-dim transition-colors hover:text-ink">
            Acceso staff
          </Link>
        </div>

        <p className="dato text-[0.65rem] tracking-[0.22em] text-faint uppercase">
          SOMOS{ciudad ? ` · ${ciudad}` : ''} · {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
