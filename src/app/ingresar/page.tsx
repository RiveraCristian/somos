import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check } from 'lucide-react';

import { Logo } from '@/components/marca/Logo';
import { OndaAnimada } from '@/components/publico/OndaAnimada';
import { obtenerUsuarioActual } from '@/lib/auth';
import { ROLES_ADMIN, ROLES_PUERTA } from '@/lib/constantes';

import { FormularioIngreso } from './FormularioIngreso';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Acceso staff',
  robots: { index: false, follow: false },
};

const CAPACIDADES = [
  'Confirma los pagos y emite las entradas',
  'Sigue la venta y la recaudación en tiempo real',
  'Valida los QR en la puerta con la cámara',
  'Exporta la lista completa de asistentes',
];

export default async function PaginaIngresar({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string }>;
}) {
  const [usuario, parametros] = await Promise.all([obtenerUsuarioActual(), searchParams]);

  // Si ya hay sesión, no tiene sentido mostrar el login.
  if (usuario) {
    if (ROLES_ADMIN.includes(usuario.usuarioRol)) redirect('/admin');
    if (ROLES_PUERTA.includes(usuario.usuarioRol)) redirect('/puerta');
    redirect('/');
  }

  const siguiente = parametros.siguiente ?? '';

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      {/* ------------------------------------------------- Panel de marca */}
      <section className="relative flex min-h-[15rem] flex-col justify-center overflow-hidden px-8 py-12 sm:px-14 lg:min-h-dvh">
        <OndaAnimada className="pointer-events-none absolute inset-0 h-full w-full opacity-60" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_30%_50%,transparent_10%,var(--color-void)_90%)]" />

        <div className="relative z-10">
          <Link href="/" aria-label="SOMOS — inicio">
            <Logo alto={38} />
          </Link>

          <h1 className="titulo-display mt-9 max-w-md text-4xl sm:text-5xl">
            Panel de <span className="texto-neon">producción</span>
          </h1>

          <p className="mt-5 max-w-sm leading-relaxed text-dim">
            Acceso interno para el equipo que organiza la fiesta y controla la puerta.
          </p>

          <ul className="mt-10 hidden flex-col gap-3.5 lg:flex">
            {CAPACIDADES.map((c) => (
              <li key={c} className="flex items-center gap-3 text-sm text-dim">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[rgba(0,240,255,0.35)] bg-[rgba(0,240,255,0.08)]">
                  <Check size={13} className="text-cyan" />
                </span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------- Panel de formulario */}
      <section className="flex items-center justify-center border-t border-line bg-void-2 px-6 py-14 lg:border-t-0 lg:border-l">
        <div className="w-full max-w-sm">
          <h2 className="titulo-display text-3xl">Bienvenido</h2>
          <p className="mt-2.5 mb-9 text-dim">Entra con tu cuenta del equipo.</p>

          <FormularioIngreso siguiente={siguiente} />

          <p className="mt-9 text-center text-xs leading-relaxed text-faint">
            Las cuentas las crea un administrador. Si no puedes entrar, escribe al grupo interno.
          </p>
        </div>
      </section>
    </main>
  );
}
