import Link from 'next/link';

import { Logo } from '@/components/marca/Logo';

const ENLACES = [
  { href: '/#entradas', texto: 'Entradas' },
  { href: '/#como-funciona', texto: 'Cómo funciona' },
  { href: '/#lineup', texto: 'Line-up' },
  { href: '/#preguntas', texto: 'Preguntas' },
];

export function Encabezado() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-void/70 backdrop-blur-xl">
      <div className="contenedor flex h-16 items-center justify-between gap-6">
        <Link href="/" className="shrink-0" aria-label="SOMOS — inicio">
          <Logo alto={26} />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {ENLACES.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className="text-sm text-dim transition-colors hover:text-ink"
            >
              {e.texto}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/mi-entrada" className="btn btn-fantasma text-sm max-sm:hidden">
            Mi entrada
          </Link>
          <Link href="/comprar" className="btn btn-primario btn-sm">
            Comprar
          </Link>
        </div>
      </div>
    </header>
  );
}
