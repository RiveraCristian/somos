'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

type Props = {
  etiqueta: string;
  valor: string;
  /** Texto que se copia si es distinto de lo que se muestra. */
  copiar?: string;
};

export function DatoCopiable({ etiqueta, valor, copiar }: Props) {
  const [copiado, setCopiado] = useState(false);

  async function alCopiar() {
    try {
      await navigator.clipboard.writeText(copiar ?? valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Navegador sin permiso de portapapeles: el dato igual se ve en pantalla.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="dato text-[0.65rem] tracking-[0.16em] text-faint uppercase">{etiqueta}</div>
        <div className="dato mt-1 truncate text-sm text-ink">{valor}</div>
      </div>

      <button
        type="button"
        onClick={alCopiar}
        aria-label={`Copiar ${etiqueta}`}
        className="btn btn-fantasma shrink-0 !p-2"
      >
        {copiado ? <Check size={16} className="text-ok" /> : <Copy size={16} />}
      </button>
    </div>
  );
}
