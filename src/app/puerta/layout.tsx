import Link from 'next/link';
import { LayoutDashboard, LogOut } from 'lucide-react';

import { salir } from '@/app/ingresar/acciones';
import { Logo } from '@/components/marca/Logo';
import { requerirUsuario } from '@/lib/auth';
import { ROLES_ADMIN, ROLES_PUERTA } from '@/lib/constantes';
import { iniciales } from '@/lib/formato';

export const dynamic = 'force-dynamic';

export default async function LayoutPuerta({ children }: { children: React.ReactNode }) {
  const usuario = await requerirUsuario(ROLES_PUERTA, '/puerta');
  const esAdmin = ROLES_ADMIN.includes(usuario.usuarioRol);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-void/80 backdrop-blur-xl">
        <div className="contenedor flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo alto={24} />
            <span className="dato hidden text-[0.65rem] tracking-[0.2em] text-faint uppercase sm:inline">
              Puerta
            </span>
          </div>

          <div className="flex items-center gap-2">
            {esAdmin && (
              <Link href="/admin" className="btn btn-fantasma btn-sm">
                <LayoutDashboard size={16} />
                <span className="max-sm:hidden">Panel</span>
              </Link>
            )}

            <span className="dato flex h-8 w-8 items-center justify-center rounded-full border border-line-fuerte bg-[linear-gradient(140deg,rgba(0,240,255,0.18),rgba(255,46,154,0.18))] text-[0.7rem] font-semibold">
              {iniciales(usuario.usuarioNombre)}
            </span>

            <form action={salir}>
              <button type="submit" className="btn btn-fantasma btn-sm" title="Cerrar sesión">
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="contenedor flex-1 py-7">{children}</main>
    </div>
  );
}
