'use client';

import { useActionState } from 'react';
import { AlertCircle, Check, Loader2, Power, Trash2, Upload } from 'lucide-react';

import {
  alternarInvitado,
  cargarInvitados,
  quitarInvitado,
  type EstadoInvitados,
} from './acciones';

/** Pegado en bloque de la lista de invitados. */
export function CargaMasiva({ eventoId }: { eventoId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoInvitados, FormData>(
    cargarInvitados,
    {},
  );

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="eventoId" value={eventoId} />

      <div className="campo">
        <label className="campo-label" htmlFor="numeros">
          Números invitados
        </label>
        <textarea
          id="numeros"
          name="numeros"
          rows={8}
          required
          className="campo-textarea font-mono text-sm"
          placeholder={'+56 9 1234 5678, Javiera\n991234567, Tomás\n+56987654321'}
        />
        <span className="campo-ayuda">
          Uno por línea. Opcionalmente una coma y el nombre. Da lo mismo cómo esté escrito
          el número: se normaliza solo.
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="campo w-40">
          <label className="campo-label" htmlFor="cupo">
            Entradas por número
          </label>
          <input
            id="cupo"
            name="cupo"
            type="number"
            min={1}
            max={10}
            defaultValue={2}
            className="campo-input"
          />
        </div>

        <button type="submit" className="btn btn-primario" disabled={pendiente}>
          {pendiente ? (
            <>
              <Loader2 size={18} className="girando" />
              Cargando…
            </>
          ) : (
            <>
              <Upload size={18} />
              Cargar a la lista
            </>
          )}
        </button>
      </div>

      <Aviso estado={estado} />
    </form>
  );
}

/** Botones de cada fila: activar/desactivar y quitar. */
export function AccionesInvitado({ invitadoId, activo }: { invitadoId: number; activo: boolean }) {
  const [, alternar, alternando] = useActionState<EstadoInvitados, FormData>(
    alternarInvitado,
    {},
  );
  const [, quitar, quitando] = useActionState<EstadoInvitados, FormData>(quitarInvitado, {});

  return (
    <div className="flex items-center gap-1.5">
      <form action={alternar}>
        <input type="hidden" name="invitadoId" value={invitadoId} />
        <button
          type="submit"
          disabled={alternando}
          title={activo ? 'Desactivar' : 'Activar'}
          className={`flex size-8 items-center justify-center rounded-[8px] border transition-colors ${
            activo
              ? 'border-line text-dim hover:border-[rgba(255,197,61,0.5)] hover:text-alerta'
              : 'border-line text-faint hover:border-[rgba(53,240,160,0.5)] hover:text-ok'
          }`}
        >
          {alternando ? <Loader2 size={14} className="girando" /> : <Power size={14} />}
        </button>
      </form>

      <form action={quitar}>
        <input type="hidden" name="invitadoId" value={invitadoId} />
        <button
          type="submit"
          disabled={quitando}
          title="Quitar de la lista"
          className="flex size-8 items-center justify-center rounded-[8px] border border-line text-dim transition-colors hover:border-[rgba(255,77,109,0.5)] hover:text-error"
        >
          {quitando ? <Loader2 size={14} className="girando" /> : <Trash2 size={14} />}
        </button>
      </form>
    </div>
  );
}

function Aviso({ estado }: { estado: EstadoInvitados }) {
  if (estado.error) {
    return (
      <p className="flex items-start gap-2.5 rounded-[10px] border border-[rgba(255,77,109,0.3)] bg-[rgba(255,77,109,0.08)] px-4 py-3 text-sm text-error">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        {estado.error}
      </p>
    );
  }

  if (estado.ok) {
    return (
      <p className="flex items-start gap-2.5 rounded-[10px] border border-[rgba(53,240,160,0.3)] bg-[rgba(53,240,160,0.08)] px-4 py-3 text-sm text-ok">
        <Check size={16} className="mt-0.5 shrink-0" />
        {estado.ok}
      </p>
    );
  }

  return null;
}
