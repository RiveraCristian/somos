'use client';

import { useActionState } from 'react';
import { Check, CheckCircle2, Loader2 } from 'lucide-react';

import { resolverIncidencia, type EstadoRevision } from './acciones';

export function ResolverIncidencia({ incidenciaId }: { incidenciaId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoRevision, FormData>(
    resolverIncidencia,
    {},
  );

  if (estado.ok) {
    return (
      <p className="flex items-center gap-2 text-sm text-ok">
        <CheckCircle2 size={15} /> Revisada
      </p>
    );
  }

  return (
    <form action={accion} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="incidenciaId" value={incidenciaId} />
      <button type="submit" className="btn btn-borde text-sm" disabled={pendiente}>
        {pendiente ? <Loader2 size={15} className="girando" /> : <Check size={15} />}
        Marcar revisada
      </button>
      {estado.error && <p className="text-xs text-error">{estado.error}</p>}
    </form>
  );
}
