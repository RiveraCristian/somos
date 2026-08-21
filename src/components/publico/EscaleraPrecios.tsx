import { Check, DoorOpen, TrendingUp } from 'lucide-react';

import type { Etapa, EtapaVigente } from '@/lib/etapas';
import { numero, pesos } from '@/lib/formato';

type Props = {
  etapas: Etapa[];
  vigente: EtapaVigente | null;
};

/**
 * La escalera de precios.
 *
 * Se muestra completa, incluidas las etapas que ya pasaron y las que vienen,
 * porque el precio que sube es justamente el argumento para comprar ahora. Si
 * solo se viera el precio actual, nadie tendria apuro.
 */
export function EscaleraPrecios({ etapas, vigente }: Props) {
  if (etapas.length === 0) return null;

  // El corte acumulado de cada etapa: la primera cubre hasta su cupo, la
  // segunda hasta la suma de las dos, y asi.
  let acumulado = 0;
  const conCorte = etapas.map((etapa) => {
    const desde = acumulado + 1;
    if (etapa.cupo !== null) acumulado += etapa.cupo;
    return { etapa, desde, hasta: etapa.cupo !== null ? acumulado : null };
  });

  return (
    <ul className="mx-auto mt-8 flex max-w-2xl flex-col gap-2.5">
      {conCorte.map(({ etapa, desde, hasta }) => {
        const esVigente = vigente?.etapaId === etapa.etapaId;

        return (
          <li
            key={etapa.etapaId}
            className={`flex items-center gap-4 rounded-[12px] border px-5 py-3.5 transition-colors ${
              esVigente
                ? 'border-[rgba(0,240,255,0.45)] bg-[rgba(0,240,255,0.07)]'
                : 'border-line bg-white/[0.02]'
            }`}
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                esVigente ? 'bg-[rgba(0,240,255,0.15)] text-cyan' : 'bg-white/[0.04] text-faint'
              }`}
            >
              {esVigente ? (
                <Check size={15} />
              ) : etapa.enPuerta ? (
                <DoorOpen size={15} />
              ) : (
                <TrendingUp size={15} />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${esVigente ? 'text-ink' : 'text-dim'}`}>
                {etapa.nombre}
                {esVigente && (
                  <span className="dato ml-2.5 text-[0.65rem] tracking-[0.14em] text-cyan uppercase">
                    Ahora
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-faint">
                {etapa.enPuerta
                  ? 'El mismo día del evento, en la puerta'
                  : hasta !== null
                    ? `Entradas ${numero(desde)} a ${numero(hasta)}`
                    : `Desde la entrada ${numero(desde)} en adelante`}
              </p>
            </div>

            <span
              className={`dato shrink-0 text-lg font-semibold ${
                esVigente ? 'text-cyan' : 'text-dim'
              }`}
            >
              {pesos(etapa.precio)}
            </span>
          </li>
        );
      })}

      {vigente?.restantes !== null && vigente?.restantes !== undefined && vigente.restantes > 0 && (
        <li className="dato mt-1 text-center text-xs tracking-[0.1em] text-faint uppercase">
          Quedan {numero(vigente.restantes)} a {pesos(vigente.precio)}
        </li>
      )}
    </ul>
  );
}
