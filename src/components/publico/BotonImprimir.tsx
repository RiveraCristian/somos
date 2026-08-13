'use client';

import { Printer } from 'lucide-react';

export function BotonImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-borde btn-sm">
      <Printer size={16} />
      Imprimir
    </button>
  );
}
