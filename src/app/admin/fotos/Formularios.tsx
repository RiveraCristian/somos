'use client';

import { useActionState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Power,
  Trash2,
  Upload,
} from 'lucide-react';

import { alternarFoto, moverFoto, quitarFoto, subirFotos, type EstadoFoto } from './acciones';

/** Carga de fotos, varias a la vez. */
export function SubirFotos({ eventoId }: { eventoId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoFoto, FormData>(subirFotos, {});

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="eventoId" value={eventoId} />

      <div className="campo">
        <label className="campo-label" htmlFor="fotos">
          Fotos
        </label>
        <input
          id="fotos"
          name="fotos"
          type="file"
          multiple
          required
          accept="image/png,image/jpeg,image/webp"
          className="campo-input file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-ink"
        />
        <span className="campo-ayuda">
          PNG, JPG o WEBP, hasta 6 MB cada una y 20 por tanda. Puedes elegir varias de una vez.
          Si vienen directo de la cámara, bájales la resolución: la galería la carga cada
          persona que entra, muchas con datos móviles.
        </span>
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
              <Upload size={18} />
              Subir fotos
            </>
          )}
        </button>
      </div>

      <Aviso estado={estado} />
    </form>
  );
}

/** Botones de cada foto: mover, mostrar/ocultar y borrar. */
export function AccionesFoto({
  fotoId,
  activa,
  primera,
  ultima,
}: {
  fotoId: number;
  activa: boolean;
  primera: boolean;
  ultima: boolean;
}) {
  const [, mover, moviendo] = useActionState<EstadoFoto, FormData>(moverFoto, {});
  const [, alternar, alternando] = useActionState<EstadoFoto, FormData>(alternarFoto, {});
  const [, quitar, quitando] = useActionState<EstadoFoto, FormData>(quitarFoto, {});

  const boton =
    'flex size-8 items-center justify-center rounded-[8px] border border-line text-dim transition-colors disabled:opacity-35';

  return (
    <div className="flex items-center gap-1.5">
      <form action={mover}>
        <input type="hidden" name="fotoId" value={fotoId} />
        <input type="hidden" name="direccion" value="subir" />
        <button type="submit" disabled={moviendo || primera} title="Mover antes" className={boton}>
          <ArrowUp size={14} />
        </button>
      </form>

      <form action={mover}>
        <input type="hidden" name="fotoId" value={fotoId} />
        <input type="hidden" name="direccion" value="bajar" />
        <button type="submit" disabled={moviendo || ultima} title="Mover después" className={boton}>
          <ArrowDown size={14} />
        </button>
      </form>

      <form action={alternar}>
        <input type="hidden" name="fotoId" value={fotoId} />
        <button
          type="submit"
          disabled={alternando}
          title={activa ? 'Ocultar de la portada' : 'Mostrar en la portada'}
          className={`${boton} ${activa ? 'hover:border-[rgba(255,197,61,0.5)] hover:text-alerta' : 'text-faint hover:border-[rgba(53,240,160,0.5)] hover:text-ok'}`}
        >
          {alternando ? <Loader2 size={14} className="girando" /> : <Power size={14} />}
        </button>
      </form>

      <form action={quitar}>
        <input type="hidden" name="fotoId" value={fotoId} />
        <button
          type="submit"
          disabled={quitando}
          title="Borrar (elimina el archivo)"
          className={`${boton} hover:border-[rgba(255,77,109,0.5)] hover:text-error`}
        >
          {quitando ? <Loader2 size={14} className="girando" /> : <Trash2 size={14} />}
        </button>
      </form>
    </div>
  );
}

function Aviso({ estado }: { estado: EstadoFoto }) {
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
