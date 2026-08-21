'use client';

import { useActionState, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';

import {
  confirmarPago,
  rechazarPago,
  reconciliarConPasarela,
  type EstadoRevision,
} from './acciones';

type Props = {
  pagoId: number;
  /** manual = alguien revisa el comprobante · fintoc = lo confirma el webhook */
  proveedor: string;
};

export function AccionesPago({ pagoId, proveedor }: Props) {
  const [estadoOk, accionConfirmar, confirmando] = useActionState<EstadoRevision, FormData>(
    confirmarPago,
    {},
  );
  const [estadoNo, accionRechazar, rechazando] = useActionState<EstadoRevision, FormData>(
    rechazarPago,
    {},
  );
  const [estadoSync, accionSync, sincronizando] = useActionState<EstadoRevision, FormData>(
    reconciliarConPasarela,
    {},
  );
  const [mostrarMotivo, setMostrarMotivo] = useState(false);

  const mensaje = estadoOk.ok ?? estadoNo.ok ?? estadoSync.ok;
  const error = estadoOk.error ?? estadoNo.error ?? estadoSync.error;
  const dePasarela = proveedor !== 'manual';

  if (mensaje) {
    return (
      <p className="flex items-start gap-2 text-sm text-ok">
        <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
        {mensaje}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-stretch gap-2.5 sm:min-w-56">
      {!mostrarMotivo ? (
        <div className="flex flex-wrap gap-2">
          {dePasarela ? (
            // En un cobro de pasarela la verdad la tiene la pasarela, no
            // nosotros: por eso no se ofrece confirmarlo a mano, solo volver a
            // preguntar.
            <form action={accionSync}>
              <input type="hidden" name="pagoId" value={pagoId} />
              <button type="submit" className="btn btn-borde btn-sm" disabled={sincronizando}>
                {sincronizando ? (
                  <Loader2 size={15} className="girando" />
                ) : (
                  <RefreshCw size={15} />
                )}
                Consultar a la pasarela
              </button>
            </form>
          ) : (
            <form action={accionConfirmar}>
              <input type="hidden" name="pagoId" value={pagoId} />
              <button type="submit" className="btn btn-ok btn-sm" disabled={confirmando}>
                {confirmando ? <Loader2 size={15} className="girando" /> : <Check size={15} />}
                Confirmar
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => setMostrarMotivo(true)}
            className="btn btn-peligro btn-sm"
          >
            <X size={15} />
            Rechazar
          </button>
        </div>
      ) : (
        <form action={accionRechazar} className="flex flex-col gap-2">
          <input type="hidden" name="pagoId" value={pagoId} />

          <textarea
            name="motivo"
            required
            minLength={5}
            maxLength={300}
            autoFocus
            rows={2}
            className="campo-textarea !min-h-0 !py-2 text-sm"
            placeholder="El comprobante no se ve o el monto no cuadra…"
          />

          <div className="flex gap-2">
            <button type="submit" className="btn btn-peligro btn-sm flex-1" disabled={rechazando}>
              {rechazando ? <Loader2 size={15} className="girando" /> : <X size={15} />}
              Rechazar
            </button>
            <button
              type="button"
              onClick={() => setMostrarMotivo(false)}
              className="btn btn-fantasma btn-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="flex items-start gap-2 text-sm text-error">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
