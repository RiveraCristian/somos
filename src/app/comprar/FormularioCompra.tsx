'use client';

import { useActionState, useState } from 'react';
import { AlertCircle, ArrowRight, Check, Loader2, MailCheck } from 'lucide-react';

import { paletaDeTipo } from '@/lib/constantes';
import { pesos } from '@/lib/formato';

import { reservarEntrada, type EstadoCompra } from './acciones';

export type TipoElegible = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  color: string;
  restantes: number | null;
};

type Props = {
  tipos: TipoElegible[];
  tipoInicialId: number | null;
};

export function FormularioCompra({ tipos, tipoInicialId }: Props) {
  const disponibles = tipos.filter((t) => t.restantes === null || t.restantes > 0);

  const [estado, accion, pendiente] = useActionState<EstadoCompra, FormData>(reservarEntrada, {});

  const [elegido, setElegido] = useState<number | null>(
    tipoInicialId ?? disponibles[0]?.id ?? null,
  );

  const tipoActual = tipos.find((t) => t.id === elegido) ?? null;

  if (disponibles.length === 0) {
    return (
      <div className="tarjeta p-8 text-center">
        <p className="titulo-display text-2xl">Entradas agotadas</p>
        <p className="mt-3 leading-relaxed text-dim">
          Por ahora no quedan entradas disponibles. Escríbenos por Instagram si quieres quedar en
          lista de espera.
        </p>
      </div>
    );
  }

  // Con un solo tipo no hay nada que elegir: se muestra como resumen y el id
  // viaja en un campo oculto. Un selector de una sola opcion solo estorba.
  const unico = disponibles.length === 1 ? disponibles[0] : null;

  if (unico) {
    const paleta = paletaDeTipo(unico.color);

    return (
      <form action={accion} className="flex flex-col gap-8">
        <input type="hidden" name="tipoEntradaId" value={unico.id} />

        <div
          className="flex items-center justify-between gap-4 rounded-[14px] border p-5"
          style={{ borderColor: paleta.borde, background: paleta.fondo }}
        >
          <div>
            <span
              className="dato text-[0.7rem] tracking-[0.16em] uppercase"
              style={{ color: paleta.texto }}
            >
              {unico.nombre}
            </span>
            <p className="mt-1 text-sm text-dim">
              {unico.restantes !== null ? `Quedan ${unico.restantes}` : 'Disponible'}
            </p>
          </div>
          <div className="titulo-display text-3xl">{pesos(unico.precio)}</div>
        </div>

        {unico.descripcion && <p className="campo-ayuda -mt-4">{unico.descripcion}</p>}

        <CamposComprador />

        <Mensajes estado={estado} />

        <button type="submit" className="btn btn-primario w-full" disabled={pendiente}>
          {pendiente ? (
            <>
              <Loader2 size={18} className="girando" />
              Reservando…
            </>
          ) : (
            <>
              Continuar al pago
              <span className="dato opacity-70">· {pesos(unico.precio)}</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>

        <Aviso />
      </form>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-8">
      {/* -------------------------------------------------- Tipo de entrada */}
      <fieldset className="flex flex-col gap-3">
        <legend className="campo-label mb-3">Qué entrada quieres</legend>

        <div className="grid gap-3 sm:grid-cols-3">
          {tipos.map((tipo) => {
            const paleta = paletaDeTipo(tipo.color);
            const agotado = tipo.restantes === 0;
            const activo = elegido === tipo.id;

            return (
              <label
                key={tipo.id}
                className={`relative flex cursor-pointer flex-col gap-2 rounded-[14px] border p-4 transition-all ${
                  agotado
                    ? 'cursor-not-allowed border-line opacity-40'
                    : activo
                      ? 'bg-white/[0.05]'
                      : 'border-line bg-white/[0.02] hover:border-line-fuerte'
                }`}
                style={
                  activo && !agotado
                    ? { borderColor: paleta.borde, boxShadow: `0 0 0 1px ${paleta.borde}` }
                    : undefined
                }
              >
                <input
                  type="radio"
                  name="tipoEntradaId"
                  value={tipo.id}
                  checked={activo}
                  disabled={agotado}
                  onChange={() => setElegido(tipo.id)}
                  className="sr-only"
                />

                <div className="flex items-center justify-between gap-2">
                  <span
                    className="dato text-[0.7rem] tracking-[0.16em] uppercase"
                    style={{ color: paleta.texto }}
                  >
                    {tipo.nombre}
                  </span>
                  {activo && !agotado && (
                    <Check size={15} style={{ color: paleta.texto }} aria-hidden />
                  )}
                </div>

                <div className="titulo-display text-2xl">{pesos(tipo.precio)}</div>

                <p className="text-xs leading-relaxed text-dim">
                  {agotado
                    ? 'Agotada'
                    : tipo.restantes !== null
                      ? `Quedan ${tipo.restantes}`
                      : 'Disponible'}
                </p>
              </label>
            );
          })}
        </div>

        {tipoActual?.descripcion && <p className="campo-ayuda">{tipoActual.descripcion}</p>}
      </fieldset>

      <CamposComprador />

      <Mensajes estado={estado} />

      <button type="submit" className="btn btn-primario w-full" disabled={pendiente || !elegido}>
        {pendiente ? (
          <>
            <Loader2 size={18} className="girando" />
            Reservando…
          </>
        ) : (
          <>
            Continuar al pago
            {tipoActual && <span className="dato opacity-70">· {pesos(tipoActual.precio)}</span>}
            <ArrowRight size={18} />
          </>
        )}
      </button>

      <Aviso />
    </form>
  );
}

/** Nombre, correo y datos opcionales. Identico en las dos variantes del form. */
function CamposComprador() {
  return (
    <div className="flex flex-col gap-5">
      <div className="campo">
        <label className="campo-label" htmlFor="nombre">
          Nombre completo
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          maxLength={200}
          autoComplete="name"
          className="campo-input"
          placeholder="Vicente Muñoz"
        />
        <span className="campo-ayuda">Es el nombre que sale en la entrada.</span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="campo">
          <label className="campo-label" htmlFor="correo">
            Correo
          </label>
          <input
            id="correo"
            name="correo"
            type="email"
            required
            maxLength={255}
            autoComplete="email"
            className="campo-input"
            placeholder="tu@correo.cl"
          />
          <span className="campo-ayuda">Ahí te llega tu entrada.</span>
        </div>

        <div className="campo">
          <label className="campo-label" htmlFor="telefono">
            Teléfono
          </label>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            required
            maxLength={30}
            autoComplete="tel"
            className="campo-input"
            placeholder="+56 9 1234 5678"
          />
          <span className="campo-ayuda">Con este número verificamos tu invitación.</span>
        </div>
      </div>

      <div className="campo">
        <label className="campo-label" htmlFor="instagram">
          Instagram <span className="text-faint">(opcional)</span>
        </label>
        <input
          id="instagram"
          name="instagram"
          maxLength={80}
          className="campo-input"
          placeholder="@tucuenta"
        />
      </div>

      <div className="campo">
        <label className="campo-label" htmlFor="mensaje">
          Algo que quieras decirnos <span className="text-faint">(opcional)</span>
        </label>
        <textarea
          id="mensaje"
          name="mensaje"
          maxLength={500}
          className="campo-textarea"
          placeholder="Voy con dos amigos más, ¿queda espacio?"
        />
      </div>
    </div>
  );
}

function Mensajes({ estado }: { estado: EstadoCompra }) {
  return (
    <>
      {estado.error && (
        <p className="flex items-start gap-2.5 rounded-[10px] border border-[rgba(255,77,109,0.3)] bg-[rgba(255,77,109,0.08)] px-4 py-3 text-sm text-error">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {estado.error}
        </p>
      )}

      {estado.aviso && (
        <p className="flex items-start gap-2.5 rounded-[10px] border border-[rgba(53,240,160,0.3)] bg-[rgba(53,240,160,0.08)] px-4 py-3 text-sm text-ok">
          <MailCheck size={16} className="mt-0.5 shrink-0" />
          {estado.aviso}
        </p>
      )}
    </>
  );
}

function Aviso() {
  return (
    <p className="text-center text-xs leading-relaxed text-faint">
      Guardamos tu nombre y correo solo para emitir tu entrada y avisarte del evento.
    </p>
  );
}
