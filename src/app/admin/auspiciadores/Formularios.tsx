'use client';

import { useActionState } from 'react';
import { AlertCircle, Check, Loader2, Plus, Power, Trash2 } from 'lucide-react';

import {
  agregarAuspiciador,
  alternarAuspiciador,
  quitarAuspiciador,
  type EstadoAuspiciador,
} from './acciones';

/** Alta de un auspiciador con su logo. */
export function FormularioAuspiciador({
  eventoId,
  siguienteOrden,
}: {
  eventoId: number;
  siguienteOrden: number;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoAuspiciador, FormData>(
    agregarAuspiciador,
    {},
  );

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="eventoId" value={eventoId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="campo">
          <label className="campo-label" htmlFor="nombre">
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            maxLength={120}
            className="campo-input"
            placeholder="Bar Central"
          />
        </div>

        <div className="campo">
          <label className="campo-label" htmlFor="sitio">
            Sitio web <span className="text-faint">(opcional)</span>
          </label>
          <input id="sitio" name="sitio" className="campo-input" placeholder="barcentral.cl" />
          <span className="campo-ayuda">Si lo dejas, el logo queda enlazado.</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div className="campo">
          <label className="campo-label" htmlFor="logo">
            Logo
          </label>
          <input
            id="logo"
            name="logo"
            type="file"
            required
            accept="image/png,image/jpeg,image/webp"
            className="campo-input file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-ink"
          />
          <span className="campo-ayuda">
            PNG, JPG o WEBP, hasta 2 MB. En la portada se muestra a 48 px de alto, así que un
            PNG con fondo transparente es lo que mejor queda.
          </span>
        </div>

        <div className="campo">
          <label className="campo-label" htmlFor="orden">
            Orden
          </label>
          <input
            id="orden"
            name="orden"
            type="number"
            min={0}
            defaultValue={siguienteOrden}
            className="campo-input"
          />
        </div>
      </div>

      <div>
        <button type="submit" className="btn btn-primario" disabled={pendiente}>
          {pendiente ? (
            <>
              <Loader2 size={18} className="girando" />
              Subiendo…
            </>
          ) : (
            <>
              <Plus size={18} />
              Agregar auspiciador
            </>
          )}
        </button>
      </div>

      <Aviso estado={estado} />
    </form>
  );
}

/** Botones de cada fila: mostrar/ocultar y quitar. */
export function AccionesAuspiciador({
  auspiciadorId,
  activo,
}: {
  auspiciadorId: number;
  activo: boolean;
}) {
  const [, alternar, alternando] = useActionState<EstadoAuspiciador, FormData>(
    alternarAuspiciador,
    {},
  );
  const [, quitar, quitando] = useActionState<EstadoAuspiciador, FormData>(quitarAuspiciador, {});

  return (
    <div className="flex items-center gap-1.5">
      <form action={alternar}>
        <input type="hidden" name="auspiciadorId" value={auspiciadorId} />
        <button
          type="submit"
          disabled={alternando}
          title={activo ? 'Ocultar de la portada' : 'Mostrar en la portada'}
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
        <input type="hidden" name="auspiciadorId" value={auspiciadorId} />
        <button
          type="submit"
          disabled={quitando}
          title="Quitar (borra también el logo)"
          className="flex size-8 items-center justify-center rounded-[8px] border border-line text-dim transition-colors hover:border-[rgba(255,77,109,0.5)] hover:text-error"
        >
          {quitando ? <Loader2 size={14} className="girando" /> : <Trash2 size={14} />}
        </button>
      </form>
    </div>
  );
}

function Aviso({ estado }: { estado: EstadoAuspiciador }) {
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
