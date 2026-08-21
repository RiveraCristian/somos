'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileUp, Loader2, Paperclip, X } from 'lucide-react';

import { ETIQUETAS_METODO, METODOS_DECLARABLES } from '@/lib/constantes';
import { pesos, tamanoArchivo } from '@/lib/formato';

import { declararPago, type EstadoPago } from './acciones';

type Props = {
  token: string;
  precio: number;
  saldoPendiente: number;
};

export function FormularioPago({ token, precio, saldoPendiente }: Props) {
  const [estado, accion, pendiente] = useActionState<EstadoPago, FormData>(declararPago, {});
  const [monto, setMonto] = useState<string>(String(saldoPendiente > 0 ? saldoPendiente : precio));
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const refArchivo = useRef<HTMLInputElement>(null);
  const refFormulario = useRef<HTMLFormElement>(null);

  // La vista previa se crea con un object URL; hay que soltarlo al cambiarlo.
  useEffect(() => {
    if (!archivo || !archivo.type.startsWith('image/')) {
      setVistaPrevia(null);
      return;
    }
    const url = URL.createObjectURL(archivo);
    setVistaPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  // Al confirmarse el envío se limpia el formulario para no reenviar lo mismo.
  useEffect(() => {
    if (estado.ok) {
      refFormulario.current?.reset();
      setArchivo(null);
    }
  }, [estado.ok]);

  function quitarArchivo() {
    setArchivo(null);
    if (refArchivo.current) refArchivo.current.value = '';
  }

  return (
    <form ref={refFormulario} action={accion} className="flex flex-col gap-6">
      <input type="hidden" name="token" value={token} />

      {/* ------------------------------------------------------------ Monto */}
      <div className="campo">
        <label className="campo-label" htmlFor="monto">
          Monto transferido
        </label>

        <div className="relative">
          <span className="dato pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-dim">
            $
          </span>
          <input
            id="monto"
            name="monto"
            type="number"
            required
            min={1}
            max={9_999_999}
            step={500}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="campo-input dato !pl-9 text-lg"
          />
        </div>

        <span className="campo-ayuda">
          {saldoPendiente > 0 && saldoPendiente !== precio
            ? `Te falta pagar ${pesos(saldoPendiente)} de los ${pesos(precio)} de tu entrada.`
            : `Tu entrada cuesta ${pesos(precio)}. Si transferiste otra cantidad, corrígelo acá.`}
        </span>
      </div>

      {/* ----------------------------------------------------------- Método */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="campo">
          <label className="campo-label" htmlFor="metodo">
            Cómo lo pagaste
          </label>
          <select id="metodo" name="metodo" className="campo-select" defaultValue="tenpo">
            {METODOS_DECLARABLES.map((m) => (
              <option key={m} value={m}>
                {ETIQUETAS_METODO[m]}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label className="campo-label" htmlFor="referencia">
            N° de operación <span className="text-faint">(opcional)</span>
          </label>
          <input
            id="referencia"
            name="referencia"
            maxLength={120}
            className="campo-input dato"
            placeholder="1234567"
          />
        </div>
      </div>

      {/* ----------------------------------------------------- Comprobante */}
      <div className="campo">
        <span className="campo-label">Comprobante de la transferencia</span>

        {!archivo ? (
          <label
            htmlFor="comprobante"
            className="flex cursor-pointer flex-col items-center gap-2.5 rounded-[12px] border border-dashed border-line-fuerte bg-white/[0.02] px-6 py-9 text-center transition-colors hover:border-[rgba(0,240,255,0.5)] hover:bg-[rgba(0,240,255,0.04)]"
          >
            <FileUp size={22} className="text-cyan" />
            <span className="text-sm font-medium">Subir la captura</span>
            <span className="text-xs text-dim">PNG, JPG, WEBP o PDF · hasta 8 MB</span>
          </label>
        ) : (
          <div className="flex items-center gap-4 rounded-[12px] border border-line bg-white/[0.03] p-3">
            {vistaPrevia ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={vistaPrevia}
                alt="Vista previa del comprobante"
                className="h-16 w-16 shrink-0 rounded-lg border border-line object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-line bg-white/[0.03]">
                <Paperclip size={20} className="text-dim" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{archivo.name}</p>
              <p className="dato mt-0.5 text-xs text-dim">{tamanoArchivo(archivo.size)}</p>
            </div>

            <button
              type="button"
              onClick={quitarArchivo}
              className="btn btn-fantasma !p-2"
              aria-label="Quitar archivo"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <input
          ref={refArchivo}
          id="comprobante"
          name="comprobante"
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="sr-only"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
        />
      </div>

      {/* ---------------------------------------------------------- Mensaje */}
      <div className="campo">
        <label className="campo-label" htmlFor="mensaje">
          Nota <span className="text-faint">(opcional)</span>
        </label>
        <textarea
          id="mensaje"
          name="mensaje"
          maxLength={500}
          className="campo-textarea !min-h-[4.5rem]"
          placeholder="Transferí desde la cuenta de mi hermana."
        />
      </div>

      {/* --------------------------------------------------------- Mensajes */}
      {estado.error && (
        <p className="flex items-start gap-2.5 rounded-[10px] border border-[rgba(255,77,109,0.3)] bg-[rgba(255,77,109,0.08)] px-4 py-3 text-sm text-error">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {estado.error}
        </p>
      )}

      {estado.ok && (
        <p className="flex items-start gap-2.5 rounded-[10px] border border-[rgba(53,240,160,0.3)] bg-[rgba(53,240,160,0.08)] px-4 py-3 text-sm text-ok">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          {estado.ok}
        </p>
      )}

      <button type="submit" className="btn btn-primario w-full" disabled={pendiente}>
        {pendiente ? (
          <>
            <Loader2 size={18} className="girando" />
            Enviando…
          </>
        ) : (
          'Enviar comprobante'
        )}
      </button>
    </form>
  );
}
