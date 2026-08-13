import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Encabezado } from '@/components/publico/Encabezado';
import { PiePagina } from '@/components/publico/PiePagina';
import { obtenerEventoPublico } from '@/lib/datos';

import { FormularioRecuperar } from './FormularioRecuperar';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Recuperar mi entrada',
  robots: { index: false, follow: false },
};

export default async function PaginaRecuperar() {
  const evento = await obtenerEventoPublico();

  return (
    <>
      <Encabezado />

      <main className="contenedor py-14">
        <div className="mx-auto max-w-md">
          <Link
            href="/"
            className="dato inline-flex items-center gap-2 text-xs tracking-[0.14em] text-dim uppercase transition-colors hover:text-cyan"
          >
            <ArrowLeft size={14} />
            Volver
          </Link>

          <header className="mt-7 mb-8">
            <h1 className="titulo-display text-3xl sm:text-4xl">Recupera tu entrada</h1>
            <p className="mt-3.5 leading-relaxed text-dim">
              Te mandamos de nuevo tu página privada, donde puedes ver tu QR o terminar de pagar.
            </p>
          </header>

          <div className="tarjeta p-7">
            <FormularioRecuperar />
          </div>

          <p className="mt-7 text-center text-sm text-dim">
            ¿Todavía no tienes entrada?{' '}
            <Link href="/comprar" className="text-cyan underline-offset-4 hover:underline">
              Comprar
            </Link>
          </p>
        </div>
      </main>

      <PiePagina instagram={evento?.eventoInstagram} ciudad={evento?.eventoCiudad} />
    </>
  );
}
