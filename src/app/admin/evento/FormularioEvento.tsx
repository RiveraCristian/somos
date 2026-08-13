'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Save } from 'lucide-react';

import { guardarEvento, type EstadoEdicion } from './acciones';

export type DatosEvento = {
  eventoId: number;
  nombre: string;
  lema: string;
  descripcion: string;
  fechaInicio: string;
  venue: string;
  direccion: string;
  ciudad: string;
  region: string;
  mapaUrl: string;
  capacidad: string;
  estado: string;
  instagram: string;
  tenpoNombre: string;
  tenpoRut: string;
  tenpoCorreo: string;
  tenpoBanco: string;
  tenpoTipoCuenta: string;
  tenpoCuenta: string;
  tenpoQrUrl: string;
};

const ESTADOS = [
  { valor: 'borrador', texto: 'Borrador — no acepta inscripciones' },
  { valor: 'publicado', texto: 'Publicado — abierto al público' },
  { valor: 'cerrado', texto: 'Cerrado — sin inscripciones nuevas' },
  { valor: 'finalizado', texto: 'Finalizado — ya pasó' },
];

export function FormularioEvento({ datos }: { datos: DatosEvento }) {
  const [estado, accion, guardando] = useActionState<EstadoEdicion, FormData>(guardarEvento, {});

  return (
    <form action={accion} className="flex flex-col gap-8">
      <input type="hidden" name="eventoId" value={datos.eventoId} />

      {/* ------------------------------------------------------- Lo básico */}
      <fieldset className="flex flex-col gap-5">
        <legend className="dato mb-2 text-[0.65rem] tracking-[0.18em] text-faint uppercase">
          Lo básico
        </legend>

        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <div className="campo">
            <label className="campo-label" htmlFor="nombre">
              Nombre del evento
            </label>
            <input
              id="nombre"
              name="nombre"
              required
              maxLength={200}
              defaultValue={datos.nombre}
              className="campo-input"
            />
          </div>

          <div className="campo">
            <label className="campo-label" htmlFor="estado">
              Estado
            </label>
            <select id="estado" name="estado" defaultValue={datos.estado} className="campo-select">
              {ESTADOS.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.texto}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="campo">
          <label className="campo-label" htmlFor="lema">
            Lema
          </label>
          <input
            id="lema"
            name="lema"
            maxLength={300}
            defaultValue={datos.lema}
            className="campo-input"
            placeholder="Una noche, un lugar, una sola entrada por persona."
          />
        </div>

        <div className="campo">
          <label className="campo-label" htmlFor="descripcion">
            Descripción
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            maxLength={4000}
            defaultValue={datos.descripcion}
            className="campo-textarea"
          />
        </div>
      </fieldset>

      <hr className="regla" />

      {/* ------------------------------------------------- Cuándo y dónde */}
      <fieldset className="flex flex-col gap-5">
        <legend className="dato mb-2 text-[0.65rem] tracking-[0.18em] text-faint uppercase">
          Cuándo y dónde
        </legend>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="campo">
            <label className="campo-label" htmlFor="fechaInicio">
              Fecha y hora de inicio
            </label>
            <input
              id="fechaInicio"
              name="fechaInicio"
              type="datetime-local"
              defaultValue={datos.fechaInicio}
              className="campo-input"
            />
            <span className="campo-ayuda">Hora de Chile. Déjalo vacío si aún no la defines.</span>
          </div>

          <div className="campo">
            <label className="campo-label" htmlFor="venue">
              Lugar
            </label>
            <input
              id="venue"
              name="venue"
              maxLength={200}
              defaultValue={datos.venue}
              className="campo-input"
              placeholder="Galpón sin nombre"
            />
          </div>
        </div>

        <div className="campo">
          <label className="campo-label" htmlFor="direccion">
            Dirección
          </label>
          <input
            id="direccion"
            name="direccion"
            maxLength={300}
            defaultValue={datos.direccion}
            className="campo-input"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div className="campo">
            <label className="campo-label" htmlFor="ciudad">
              Ciudad
            </label>
            <input
              id="ciudad"
              name="ciudad"
              required
              maxLength={120}
              defaultValue={datos.ciudad}
              className="campo-input"
            />
          </div>

          <div className="campo">
            <label className="campo-label" htmlFor="region">
              Región
            </label>
            <input
              id="region"
              name="region"
              maxLength={120}
              defaultValue={datos.region}
              className="campo-input"
            />
          </div>

          <div className="campo">
            <label className="campo-label" htmlFor="capacidad">
              Capacidad
            </label>
            <input
              id="capacidad"
              name="capacidad"
              type="number"
              min={0}
              max={100000}
              defaultValue={datos.capacidad}
              className="campo-input dato"
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="campo">
            <label className="campo-label" htmlFor="mapaUrl">
              Link del mapa
            </label>
            <input
              id="mapaUrl"
              name="mapaUrl"
              maxLength={500}
              defaultValue={datos.mapaUrl}
              className="campo-input"
              placeholder="https://maps.google.com/…"
            />
          </div>

          <div className="campo">
            <label className="campo-label" htmlFor="instagram">
              Instagram
            </label>
            <input
              id="instagram"
              name="instagram"
              maxLength={120}
              defaultValue={datos.instagram}
              className="campo-input"
              placeholder="somos.cl"
            />
          </div>
        </div>
      </fieldset>

      <hr className="regla" />

      {/* ----------------------------------------------------------- Tenpo */}
      <fieldset className="flex flex-col gap-5">
        <legend className="dato mb-1 text-[0.65rem] tracking-[0.18em] text-faint uppercase">
          Datos para recibir los pagos
        </legend>

        <p className="mb-2 text-sm leading-relaxed text-dim">
          Esto es lo que ve cada comprador en su página privada para transferirte. Tenpo no expone
          una API que avise cuando llega una transferencia, así que la confirmación siempre pasa
          por revisar el comprobante acá.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="campo">
            <label className="campo-label" htmlFor="tenpoNombre">
              Titular de la cuenta
            </label>
            <input
              id="tenpoNombre"
              name="tenpoNombre"
              maxLength={200}
              defaultValue={datos.tenpoNombre}
              className="campo-input"
            />
          </div>

          <div className="campo">
            <label className="campo-label" htmlFor="tenpoRut">
              RUT
            </label>
            <input
              id="tenpoRut"
              name="tenpoRut"
              maxLength={20}
              defaultValue={datos.tenpoRut}
              className="campo-input dato"
              placeholder="12.345.678-9"
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div className="campo">
            <label className="campo-label" htmlFor="tenpoBanco">
              Banco
            </label>
            <input
              id="tenpoBanco"
              name="tenpoBanco"
              maxLength={120}
              defaultValue={datos.tenpoBanco}
              className="campo-input"
              placeholder="Tenpo"
            />
          </div>

          <div className="campo">
            <label className="campo-label" htmlFor="tenpoTipoCuenta">
              Tipo de cuenta
            </label>
            <input
              id="tenpoTipoCuenta"
              name="tenpoTipoCuenta"
              maxLength={60}
              defaultValue={datos.tenpoTipoCuenta}
              className="campo-input"
              placeholder="Cuenta Vista"
            />
          </div>

          <div className="campo">
            <label className="campo-label" htmlFor="tenpoCuenta">
              N° de cuenta
            </label>
            <input
              id="tenpoCuenta"
              name="tenpoCuenta"
              maxLength={50}
              defaultValue={datos.tenpoCuenta}
              className="campo-input dato"
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="campo">
            <label className="campo-label" htmlFor="tenpoCorreo">
              Correo asociado
            </label>
            <input
              id="tenpoCorreo"
              name="tenpoCorreo"
              type="email"
              maxLength={255}
              defaultValue={datos.tenpoCorreo}
              className="campo-input"
            />
          </div>

          <div className="campo">
            <label className="campo-label" htmlFor="tenpoQrUrl">
              Imagen del QR de cobro
            </label>
            <input
              id="tenpoQrUrl"
              name="tenpoQrUrl"
              maxLength={500}
              defaultValue={datos.tenpoQrUrl}
              className="campo-input"
              placeholder="/tenpo-qr.png"
            />
            <span className="campo-ayuda">
              Exporta el QR desde la app de Tenpo, déjalo en <code>public/</code> y pon acá su ruta.
            </span>
          </div>
        </div>
      </fieldset>

      {/* -------------------------------------------------------- Mensajes */}
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

      <div className="flex justify-end">
        <button type="submit" className="btn btn-primario" disabled={guardando}>
          {guardando ? (
            <>
              <Loader2 size={18} className="girando" />
              Guardando…
            </>
          ) : (
            <>
              <Save size={18} />
              Guardar cambios
            </>
          )}
        </button>
      </div>
    </form>
  );
}
