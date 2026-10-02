'use client';

import { useActionState, useState } from 'react';
import { AlertCircle, Check, Loader2, RotateCcw, UserX } from 'lucide-react';

import { anularReserva, reactivarReserva, type EstadoReserva } from './acciones';

type Props = {
  asistenteId: number;
  nombre: string;
  anulada: boolean;
};

/**
 * Anular una reserva que quedo colgada, o deshacer la anulacion.
 *
 * Anular pide confirmacion porque libera el cupo del telefono y el correo: es
 * lo que desbloquea a alguien, pero tambien lo que lo deja fuera si se aprieta
 * en la fila equivocada. Reactivar no la pide — es la marcha atras.
 */
export function AccionesReserva({ asistenteId, nombre, anulada }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [anular, accionAnular, anulando] = useActionState<EstadoReserva, FormData>(
    anularReserva,
    {},
  );
  const [reactivar, accionReactivar, reactivando] = useActionState<EstadoReserva, FormData>(
    reactivarReserva,
    {},
  );

  const estado = anulada ? reactivar : anular;

  if (anulada) {
    return (
      <div className="flex flex-col gap-2">
        <form action={accionReactivar}>
          <input type="hidden" name="asistenteId" value={asistenteId} />
          <button
            type="submit"
            disabled={reactivando}
            className="btn btn-borde btn-sm whitespace-nowrap"
            title="Deshacer la anulación"
          >
            {reactivando ? <Loader2 size={14} className="girando" /> : <RotateCcw size={14} />}
            Reactivar
          </button>
        </form>
        <Aviso estado={estado} />
      </div>
    );
  }

  if (!confirmando) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="btn btn-borde btn-sm whitespace-nowrap"
          title="Liberar el cupo de esta persona"
        >
          <UserX size={14} />
          Anular
        </button>
        <Aviso estado={estado} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-[rgba(255,197,61,0.35)] bg-[rgba(255,197,61,0.06)] p-3">
      <p className="text-xs leading-relaxed text-dim">
        Se libera el cupo de <strong className="text-ink">{nombre}</strong>: su teléfono y su
        correo quedan disponibles para reservar de nuevo.
      </p>
      <div className="flex gap-2">
        <form action={accionAnular}>
          <input type="hidden" name="asistenteId" value={asistenteId} />
          <button
            type="submit"
            disabled={anulando}
            className="btn btn-borde btn-sm whitespace-nowrap !border-[rgba(255,77,109,0.5)] !text-error"
          >
            {anulando ? <Loader2 size={14} className="girando" /> : <UserX size={14} />}
            Sí, anular
          </button>
        </form>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="btn btn-fantasma btn-sm"
        >
          Cancelar
        </button>
      </div>
      <Aviso estado={estado} />
    </div>
  );
}

function Aviso({ estado }: { estado: EstadoReserva }) {
  if (estado.error) {
    return (
      <p className="flex items-start gap-2 text-xs leading-relaxed text-error">
        <AlertCircle size={13} className="mt-0.5 shrink-0" />
        {estado.error}
      </p>
    );
  }

  if (estado.ok) {
    return (
      <p className="flex items-start gap-2 text-xs leading-relaxed text-ok">
        <Check size={13} className="mt-0.5 shrink-0" />
        {estado.ok}
      </p>
    );
  }

  return null;
}
