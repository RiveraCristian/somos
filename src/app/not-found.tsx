import Link from 'next/link';

import { Logo } from '@/components/marca/Logo';

export default function NoEncontrado() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-7 px-6 text-center">
      <Logo alto={52} />

      <div>
        <p className="titulo-display text-6xl">
          <span className="texto-neon">404</span>
        </p>
        <h1 className="titulo-display mt-4 text-2xl">Acá no hay nada</h1>
        <p className="mt-3 max-w-sm leading-relaxed text-dim">
          El link puede estar mal escrito o la entrada que buscas ya no existe.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primario">
          Ir al inicio
        </Link>
        <Link href="/mi-entrada" className="btn btn-borde">
          Recuperar mi entrada
        </Link>
      </div>
    </main>
  );
}
