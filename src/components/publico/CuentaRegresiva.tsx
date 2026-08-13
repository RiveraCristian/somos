'use client';

import { useEffect, useState } from 'react';

type Props = { fechaIso: string | null };

function partes(restanteMs: number) {
  const total = Math.max(0, Math.floor(restanteMs / 1000));
  return {
    dias: Math.floor(total / 86400),
    horas: Math.floor((total % 86400) / 3600),
    minutos: Math.floor((total % 3600) / 60),
    segundos: total % 60,
  };
}

export function CuentaRegresiva({ fechaIso }: Props) {
  // Arranca en null para que servidor y cliente rendericen lo mismo y no haya
  // desajuste de hidratacion; el reloj parte recien al montar.
  const [restante, setRestante] = useState<ReturnType<typeof partes> | null>(null);

  useEffect(() => {
    if (!fechaIso) return;
    const objetivo = new Date(fechaIso).getTime();
    if (Number.isNaN(objetivo)) return;

    const tick = () => setRestante(partes(objetivo - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [fechaIso]);

  if (!fechaIso) {
    return (
      <div className="inline-flex items-center gap-2.5 rounded-full border border-line bg-white/[0.03] px-4 py-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan" />
        </span>
        <span className="dato text-xs tracking-[0.2em] text-dim uppercase">Fecha por confirmar</span>
      </div>
    );
  }

  const bloques = restante
    ? [
        { valor: restante.dias, etiqueta: 'días' },
        { valor: restante.horas, etiqueta: 'horas' },
        { valor: restante.minutos, etiqueta: 'min' },
        { valor: restante.segundos, etiqueta: 'seg' },
      ]
    : [
        { valor: 0, etiqueta: 'días' },
        { valor: 0, etiqueta: 'horas' },
        { valor: 0, etiqueta: 'min' },
        { valor: 0, etiqueta: 'seg' },
      ];

  return (
    <div className="flex items-stretch gap-2 sm:gap-3">
      {bloques.map((b) => (
        <div
          key={b.etiqueta}
          className="tarjeta min-w-[4.2rem] px-3 py-2.5 text-center sm:min-w-[5rem] sm:px-4"
        >
          <div className="dato text-2xl font-semibold text-ink sm:text-3xl">
            {String(b.valor).padStart(2, '0')}
          </div>
          <div className="mt-0.5 text-[0.6rem] tracking-[0.18em] text-dim uppercase">{b.etiqueta}</div>
        </div>
      ))}
    </div>
  );
}
