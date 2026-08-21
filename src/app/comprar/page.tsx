import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';

import { Encabezado } from '@/components/publico/Encabezado';
import { PiePagina } from '@/components/publico/PiePagina';
import { cuposPorTipo, obtenerEventoPublico } from '@/lib/datos';
import { etapaVigente } from '@/lib/etapas';
import { pasarelaActiva } from '@/lib/pasarela';
import { pesos } from '@/lib/formato';

import { FormularioCompra, type TipoElegible } from './FormularioCompra';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Comprar entrada',
  description: 'Compra tu entrada para SOMOS.',
};

export default async function PaginaComprar({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const [evento, parametros] = await Promise.all([obtenerEventoPublico(), searchParams]);

  if (!evento) {
    return (
      <>
        <Encabezado />
        <main className="contenedor-angosto py-24 text-center">
          <h1 className="titulo-display text-3xl">No hay entradas a la venta</h1>
          <p className="mt-3 text-dim">Vuelve a intentarlo más tarde.</p>
        </main>
      </>
    );
  }

  const [cupos, etapa] = await Promise.all([
    cuposPorTipo(evento.eventoId),
    etapaVigente(evento.eventoId, evento.eventoFechaInicio),
  ]);

  const tipos: TipoElegible[] = evento.tiposEntrada.map((t) => ({
    id: t.tipoEntradaId,
    nombre: t.tipoEntradaNombre,
    descripcion: t.tipoEntradaDescripcion,
    // El precio lo manda la etapa vigente; el del tipo queda solo de respaldo
    // por si el evento todavia no tiene etapas configuradas.
    precio: etapa?.precio ?? t.tipoEntradaPrecio,
    color: t.tipoEntradaColor,
    restantes:
      t.tipoEntradaCupo !== null
        ? Math.max(0, t.tipoEntradaCupo - (cupos.get(t.tipoEntradaId) ?? 0))
        : null,
  }));

  const tipoInicial =
    evento.tiposEntrada.find((t) => t.tipoEntradaSlug === parametros.tipo)?.tipoEntradaId ?? null;

  return (
    <>
      <Encabezado />

      <main className="contenedor py-14">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/"
            className="dato inline-flex items-center gap-2 text-xs tracking-[0.14em] text-dim uppercase transition-colors hover:text-cyan"
          >
            <ArrowLeft size={14} />
            Volver
          </Link>

          <header className="mt-7 mb-10">
            <p className="eyebrow">Paso 1 de 2</p>
            <h1 className="titulo-display mt-3 text-4xl sm:text-5xl">Compra tu entrada</h1>
            <p className="mt-4 leading-relaxed text-dim">
              {tipos.length === 1 ? 'Déjanos tus datos' : 'Elige tu entrada y déjanos tus datos'}
              {pasarelaActiva()
                ? '. En el paso siguiente la pagas y te emitimos el QR al tiro.'
                : '. En el paso siguiente te mostramos cómo pagarla por transferencia para que te emitamos el QR.'}
            </p>
          </header>

          <div className="mb-6 flex items-start gap-3 rounded-[12px] border border-[rgba(178,102,255,0.28)] bg-[rgba(178,102,255,0.06)] px-5 py-4">
            <Lock size={17} className="mt-0.5 shrink-0 text-violeta" />
            <div className="text-sm leading-relaxed text-dim">
              <p className="font-medium text-ink">Solo por invitación</p>
              <p className="mt-1">
                Verificamos tu teléfono contra la lista de invitados. Cada número puede
                sacar hasta dos entradas, y cada entrada va a nombre de una persona con
                su propio correo.
                {etapa?.restantes ? (
                  <>
                    {' '}
                    Quedan <strong className="text-ink">{etapa.restantes}</strong> a{' '}
                    {pesos(etapa.precio)}.
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="tarjeta p-7 sm:p-9">
            <FormularioCompra tipos={tipos} tipoInicialId={tipoInicial} />
          </div>

          <p className="mt-8 text-center text-sm text-dim">
            ¿Ya compraste?{' '}
            <Link href="/mi-entrada" className="text-cyan underline-offset-4 hover:underline">
              Recupera tu entrada
            </Link>
          </p>
        </div>
      </main>

      <PiePagina instagram={evento.eventoInstagram} ciudad={evento.eventoCiudad} />
    </>
  );
}
