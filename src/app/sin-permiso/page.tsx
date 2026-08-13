import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

import { salir } from '@/app/ingresar/acciones';
import { Logo } from '@/components/marca/Logo';

export const metadata: Metadata = {
  title: 'Sin permiso',
  robots: { index: false, follow: false },
};

export default function PaginaSinPermiso() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-7 px-6 text-center">
      <Logo alto={30} />

      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(255,197,61,0.3)] bg-[rgba(255,197,61,0.08)]">
        <ShieldAlert size={24} className="text-alerta" />
      </div>

      <div>
        <h1 className="titulo-display text-3xl">Tu cuenta no llega hasta acá</h1>
        <p className="mt-3 max-w-sm leading-relaxed text-dim">
          Iniciaste sesión, pero tu rol no tiene acceso a esta sección. Pídele a un administrador
          que te cambie el rol.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-borde">
          Ir al inicio
        </Link>
        <form action={salir}>
          <button type="submit" className="btn btn-fantasma">
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
