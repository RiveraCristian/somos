'use client';

import { useActionState, useState } from 'react';
import { AlertCircle, Check, HandCoins, Loader2, X } from 'lucide-react';

import { ETIQUETAS_METODO, METODOS_DECLARABLES } from '@/lib/constantes';
import { pesos } from '@/lib/formato';

import { registrarPagoManual, type EstadoPagoManual } from './acciones';

type Props = {
  asistenteId: number;
  nombre: string;
  precio: number;
};

/**
 * Registrar a mano un pago que llego por fuera de la pasarela.
 *
 * Va detras de un boton y no abierto en la tabla: es la excepcion, no el
 * camino normal. Emitir una entrada sin que haya entrado plata de verdad es
 * facil de hacer sin querer, asi que cuesta un clic extra a proposito.
 */
export function PagoManual({ asistenteId, nombre, precio }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState<EstadoPagoManual, FormData>(
    registrarPagoManual,
    {},
  );

  if (estado.ok) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ok">
        <Check size={13} />
        {estado.ok}
      </span>
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="dato inline-flex items-center gap-1.5 rounded-[8px] border border-line px-2.5 py-1.5 text-xs text-dim transition-colors hover:border-[rgba(53,240,160,0.5)] hover:text-ok"
      >
        <HandCoins size={13} />
        Marcar pagada
      </button>
    );
  }

  return (
    <form
      action={accion}
      className="flex w-64 flex-col gap-3 rounded-[10px] border border-line bg-void-2 p-3.5"
    >
      <input type="hidden" name="asistenteId" value={asistenteId} />

      <div className="flex items-start justify-between gap-2">
        <p className="text-xs leading-relaxed text-dim">
          Registrar un pago de <strong className="text-ink">{nombre}</strong> recibido fuera
          del sitio. Se emite la entrada al tiro.
        </p>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="shrink-0 text-faint transition-colors hover:text-ink"
          aria-label="Cancelar"
        >
          <X size={14} />
        </button>
      </div>

      <div className="campo">
        <label className="campo-label" htmlFor={`monto-${asistenteId}`}>
          Monto
        </label>
        <input
          id={`monto-${asistenteId}`}
          name="monto"
          type="number"
          min={1}
          required
          defaultValue={precio}
          className="campo-input"
        />
        <span className="campo-ayuda">Su entrada vale {pesos(precio)}.</span>
      </div>

      <div className="campo">
        <label className="campo-label" htmlFor={`metodo-${asistenteId}`}>
          Cómo pagó
        </label>
        <select
          id={`metodo-${asistenteId}`}
          name="metodo"
          className="campo-select"
          defaultValue="transferencia"
        >
          {METODOS_DECLARABLES.map((m) => (
            <option key={m} value={m}>
              {ETIQUETAS_METODO[m]}
            </option>
          ))}
        </select>
      </div>

      <div className="campo">
        <label className="campo-label" htmlFor={`referencia-${asistenteId}`}>
          N° de operación <span className="text-faint">(opcional)</span>
        </label>
        <input
          id={`referencia-${asistenteId}`}
          name="referencia"
          maxLength={120}
          className="campo-input"
        />
      </div>

      <div className="campo">
        <label className="campo-label" htmlFor={`comprobante-${asistenteId}`}>
          Comprobante <span className="text-faint">(opcional)</span>
        </label>
        <input
          id={`comprobante-${asistenteId}`}
          name="comprobante"
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="campo-input text-xs"
        />
      </div>

      <div className="campo">
        <label className="campo-label" htmlFor={`mensaje-${asistenteId}`}>
          Nota <span className="text-faint">(opcional)</span>
        </label>
        <textarea
          id={`mensaje-${asistenteId}`}
          name="mensaje"
          rows={2}
          maxLength={500}
          className="campo-textarea text-xs"
          placeholder="Me transfirió por WhatsApp."
        />
      </div>

      {estado.error && (
        <p className="flex items-start gap-2 text-xs text-error">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {estado.error}
        </p>
      )}

      <button type="submit" className="btn btn-primario w-full text-sm" disabled={pendiente}>
        {pendiente ? (
          <>
            <Loader2 size={15} className="girando" />
            Registrando…
          </>
        ) : (
          <>
            <HandCoins size={15} />
            Registrar y emitir
          </>
        )}
      </button>
    </form>
  );
}
