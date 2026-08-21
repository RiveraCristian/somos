'use client';

import { useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export type Pregunta = {
  id: number;
  texto: string;
  respuesta: string;
};

/**
 * Preguntas frecuentes con apertura animada.
 *
 * Reemplaza al <details> nativo, que abre de golpe y no se puede transicionar:
 * la altura pasaba de 0 al total en un cuadro. Aca se anima con `height: auto`,
 * que Motion resuelve midiendo el contenido.
 */
export function Acordeon({ preguntas }: { preguntas: Pregunta[] }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const reducido = useReducedMotion();

  return (
    <div className="mx-auto max-w-3xl divide-y divide-[var(--color-line)] overflow-hidden rounded-[16px] border border-line">
      {preguntas.map((p) => {
        const activa = abierta === p.id;

        return (
          <div key={p.id} className={activa ? 'bg-white/[0.035]' : 'bg-white/[0.02]'}>
            <button
              type="button"
              onClick={() => setAbierta(activa ? null : p.id)}
              aria-expanded={activa}
              aria-controls={`respuesta-${p.id}`}
              className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left font-medium transition-colors hover:text-cyan"
            >
              {p.texto}
              <m.span
                animate={{ rotate: activa ? 180 : 0 }}
                transition={{ duration: reducido ? 0 : 0.25, ease: 'easeOut' }}
                className="shrink-0 text-dim"
              >
                <ChevronDown size={18} />
              </m.span>
            </button>

            <AnimatePresence initial={false}>
              {activa && (
                <m.div
                  id={`respuesta-${p.id}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    duration: reducido ? 0 : 0.3,
                    ease: [0.2, 0.7, 0.3, 1],
                    opacity: { duration: reducido ? 0 : 0.2 },
                  }}
                  className="overflow-hidden"
                >
                  <p className="px-6 pb-6 text-sm leading-relaxed whitespace-pre-line text-dim">
                    {p.respuesta}
                  </p>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
