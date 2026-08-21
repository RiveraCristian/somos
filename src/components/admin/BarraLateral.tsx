'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  CalendarCog,
  ChevronLeft,
  LayoutDashboard,
  ListChecks,
  LogOut,
  ScanLine,
  Users,
  Wallet,
} from 'lucide-react';

import { Logo } from '@/components/marca/Logo';
import { iniciales } from '@/lib/formato';

const NAVEGACION = [
  { href: '/admin', texto: 'Resumen', icono: LayoutDashboard, exacto: true },
  { href: '/admin/pagos', texto: 'Pagos', icono: Wallet, exacto: false },
  { href: '/admin/asistentes', texto: 'Compradores', icono: Users, exacto: false },
  { href: '/admin/invitados', texto: 'Invitados', icono: ListChecks, exacto: false },
  { href: '/admin/evento', texto: 'Evento', icono: CalendarCog, exacto: false },
  { href: '/puerta', texto: 'Puerta', icono: ScanLine, exacto: false },
];

type Props = {
  nombre: string;
  rol: string;
  departamento: string | null;
  pendientes: number;
  salir: () => Promise<void>;
};

const CLAVE_ALMACEN = 'somos:sidebar-colapsada';

export function BarraLateral({ nombre, rol, departamento, pendientes, salir }: Props) {
  const ruta = usePathname();
  const [colapsada, setColapsada] = useState(false);
  const [montada, setMontada] = useState(false);

  // La preferencia se lee después de montar para no romper la hidratación.
  useEffect(() => {
    setColapsada(window.localStorage.getItem(CLAVE_ALMACEN) === '1');
    setMontada(true);
  }, []);

  function alternar() {
    setColapsada((previo) => {
      window.localStorage.setItem(CLAVE_ALMACEN, previo ? '0' : '1');
      return !previo;
    });
  }

  const ancho = colapsada ? 'lg:w-[4.5rem]' : 'lg:w-60';

  return (
    <aside
      className={`relative z-30 flex shrink-0 flex-row items-center gap-3 border-b border-line bg-void-2/80 px-4 py-3 backdrop-blur-xl lg:sticky lg:top-0 lg:h-dvh lg:flex-col lg:items-stretch lg:border-r lg:border-b-0 lg:px-3 lg:py-5 ${ancho} ${
        montada ? 'transition-[width] duration-200' : ''
      }`}
    >
      {/* Botón de colapsar, en el borde derecho */}
      <button
        type="button"
        onClick={alternar}
        aria-label={colapsada ? 'Expandir menú' : 'Colapsar menú'}
        className="absolute top-1/2 -right-3 hidden h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-dim transition-colors hover:border-[rgba(0,240,255,0.5)] hover:text-cyan lg:flex"
      >
        <ChevronLeft size={14} className={colapsada ? 'rotate-180' : ''} />
      </button>

      {/* Cabecera */}
      <Link href="/" className="flex items-center gap-3 lg:px-2 lg:pb-6" aria-label="SOMOS">
        <Logo alto={colapsada ? 28 : 42} />
      </Link>

      {!colapsada && (
        <p className="dato hidden text-[0.6rem] tracking-[0.2em] text-faint uppercase lg:block lg:px-2 lg:-mt-4 lg:pb-5">
          Producción
        </p>
      )}

      {/* Navegación */}
      <nav className="flex flex-1 flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {NAVEGACION.map((item) => {
          const activo = item.exacto ? ruta === item.href : ruta.startsWith(item.href);
          const Icono = item.icono;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={colapsada ? item.texto : undefined}
              className={`relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
                activo ? 'bg-white/[0.07] text-ink' : 'text-dim hover:bg-white/[0.04] hover:text-ink'
              } ${colapsada ? 'lg:justify-center lg:px-0' : ''}`}
            >
              {activo && (
                <span className="absolute top-1/2 left-0 hidden h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[linear-gradient(180deg,#00F0FF,#FF2E9A)] lg:block" />
              )}

              <Icono size={19} className={activo ? 'text-cyan' : ''} />

              {!colapsada && <span className="lg:inline">{item.texto}</span>}

              {item.href === '/admin/pagos' && pendientes > 0 && (
                <span
                  className={`dato ml-auto rounded-full bg-magenta px-1.5 py-0.5 text-[0.65rem] font-semibold text-void ${
                    colapsada ? 'lg:absolute lg:top-1 lg:right-1 lg:ml-0' : ''
                  }`}
                >
                  {pendientes}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Pie: usuario */}
      <div className="ml-auto flex items-center gap-2 lg:ml-0 lg:mt-4 lg:flex-col lg:items-stretch lg:gap-3 lg:border-t lg:border-line lg:pt-4">
        <div className={`flex items-center gap-3 ${colapsada ? 'lg:justify-center' : ''}`}>
          <span className="dato flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line-fuerte bg-[linear-gradient(140deg,rgba(0,240,255,0.18),rgba(255,46,154,0.18))] text-xs font-semibold">
            {iniciales(nombre)}
          </span>

          {!colapsada && (
            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-sm font-medium">{nombre}</p>
              <p className="truncate text-xs text-dim">{departamento ?? rol}</p>
            </div>
          )}
        </div>

        <form action={salir} className={colapsada ? 'lg:flex lg:justify-center' : ''}>
          <button
            type="submit"
            title="Cerrar sesión"
            className={`btn btn-fantasma !px-2.5 !py-2 ${colapsada ? '' : 'lg:w-full lg:justify-start lg:!px-3'}`}
          >
            <LogOut size={17} />
            {!colapsada && <span className="hidden lg:inline">Salir</span>}
          </button>
        </form>
      </div>
    </aside>
  );
}
