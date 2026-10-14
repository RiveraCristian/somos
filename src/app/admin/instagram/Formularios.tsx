'use client';

import { useActionState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, Check, Loader2, Plus, Power, Trash2 } from 'lucide-react';

import {
  agregarPublicaciones,
  alternarPublicacion,
  moverPublicacion,
  quitarPublicacion,
  type EstadoPublicacion,
} from './acciones';

/** Pegado en bloque de links de Instagram. */
export function AgregarPosts({ eventoId }: { eventoId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoPublicacion, FormData>(
    agregarPublicaciones,
    {},
  );

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="eventoId" value={eventoId} />

      <div className="campo">
        <label className="campo-label" htmlFor="links">
          Links de los posts
        </label>
        <textarea
          id="links"
          name="links"
          rows={6}
          required
          className="campo-textarea font-mono text-sm"
          placeholder={
            'https://www.instagram.com/p/CxAbCdEfGhI/\nhttps://www.instagram.com/reel/CyZzYyXxWwV/'
          }
        />
        <span className="campo-ayuda">
          Uno por línea. En Instagram: abre el post, menú de los tres puntos, &ldquo;Copiar
          enlace&rdquo;. Da lo mismo si trae el <code className="dato">?igsh=…</code> del final.
          Los posts tienen que ser públicos.
        </span>
      </div>

      <div>
        <button type="submit" className="btn btn-primario" disabled={pendiente}>
          {pendiente ? (
            <>
              <Loader2 size={18} className="girando" />
              Agregando…
            </>
          ) : (
            <>
              <Plus size={18} />
              Agregar posts
            </>
          )}
        </button>
      </div>

      <Aviso estado={estado} />
    </form>
  );
}

/** Botones de cada post: mover, mostrar/ocultar y quitar. */
export function AccionesPost({
  publicacionId,
  activa,
  primera,
  ultima,
}: {
  publicacionId: number;
  activa: boolean;
  primera: boolean;
  ultima: boolean;
}) {
  const [, mover, moviendo] = useActionState<EstadoPublicacion, FormData>(moverPublicacion, {});
  const [, alternar, alternando] = useActionState<EstadoPublicacion, FormData>(
    alternarPublicacion,
    {},
  );
  const [, quitar, quitando] = useActionState<EstadoPublicacion, FormData>(quitarPublicacion, {});

  const boton =
    'flex size-8 items-center justify-center rounded-[8px] border border-line text-dim transition-colors disabled:opacity-35';

  return (
    <div className="flex items-center gap-1.5">
      <form action={mover}>
        <input type="hidden" name="publicacionId" value={publicacionId} />
        <input type="hidden" name="direccion" value="subir" />
        <button type="submit" disabled={moviendo || primera} title="Mover antes" className={boton}>
          <ArrowUp size={14} />
        </button>
      </form>

      <form action={mover}>
        <input type="hidden" name="publicacionId" value={publicacionId} />
        <input type="hidden" name="direccion" value="bajar" />
        <button type="submit" disabled={moviendo || ultima} title="Mover después" className={boton}>
          <ArrowDown size={14} />
        </button>
      </form>

      <form action={alternar}>
        <input type="hidden" name="publicacionId" value={publicacionId} />
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
        <input type="hidden" name="publicacionId" value={publicacionId} />
        <button
          type="submit"
          disabled={quitando}
          title="Quitar de la portada"
          className={`${boton} hover:border-[rgba(255,77,109,0.5)] hover:text-error`}
        >
          {quitando ? <Loader2 size={14} className="girando" /> : <Trash2 size={14} />}
        </button>
      </form>
    </div>
  );
}

function Aviso({ estado }: { estado: EstadoPublicacion }) {
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
