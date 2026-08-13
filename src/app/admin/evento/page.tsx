import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, EyeOff, Plus, Save } from 'lucide-react';

import { EncabezadoPagina } from '@/components/admin/EncabezadoPagina';
import { COLORES_TIPO } from '@/lib/constantes';
import { obtenerEventoAdmin } from '@/lib/datos';
import { aValorInputFecha } from '@/lib/fechas';
import { prisma } from '@/lib/prisma';

import {
  desactivarTipoEntrada,
  guardarArtista,
  guardarPregunta,
  guardarTipoEntrada,
  ocultarArtista,
  ocultarPregunta,
} from './acciones';
import { FormularioEvento } from './FormularioEvento';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Evento' };

export default async function PaginaEvento() {
  const evento = await obtenerEventoAdmin();

  if (!evento) {
    return (
      <>
        <EncabezadoPagina titulo="Evento" />
        <div className="tarjeta p-8 text-center">
          <p className="titulo-display text-xl">No hay evento creado</p>
          <p className="mt-3 text-dim">
            Corre <code className="dato text-cyan">npm run db:seed</code> para crearlo.
          </p>
        </div>
      </>
    );
  }

  // Cuántas personas hay por tipo: define si se puede desactivar sin dejar
  // gente colgando.
  const usoPorTipo = await prisma.asistente.groupBy({
    by: ['asistenteTipoEntradaId'],
    where: { isDeleted: false },
    _count: { _all: true },
  });
  const uso = new Map(usoPorTipo.map((u) => [u.asistenteTipoEntradaId, u._count._all]));

  return (
    <>
      <EncabezadoPagina titulo="Evento" subtitulo="Todo lo que se ve en el sitio público">
        <Link href="/" target="_blank" className="btn btn-borde btn-sm">
          Ver sitio
          <ExternalLink size={15} />
        </Link>
      </EncabezadoPagina>

      {/* -------------------------------------------------------- El evento */}
      <section className="tarjeta p-6 sm:p-8">
        <FormularioEvento
          datos={{
            eventoId: evento.eventoId,
            nombre: evento.eventoNombre,
            lema: evento.eventoLema ?? '',
            descripcion: evento.eventoDescripcion ?? '',
            fechaInicio: aValorInputFecha(evento.eventoFechaInicio),
            venue: evento.eventoVenue ?? '',
            direccion: evento.eventoDireccion ?? '',
            ciudad: evento.eventoCiudad,
            region: evento.eventoRegion ?? '',
            mapaUrl: evento.eventoMapaUrl ?? '',
            capacidad: String(evento.eventoCapacidad ?? ''),
            estado: evento.eventoEstado,
            instagram: evento.eventoInstagram ?? '',
            tenpoNombre: evento.eventoTenpoNombre ?? '',
            tenpoRut: evento.eventoTenpoRut ?? '',
            tenpoCorreo: evento.eventoTenpoCorreo ?? '',
            tenpoBanco: evento.eventoTenpoBanco ?? '',
            tenpoTipoCuenta: evento.eventoTenpoTipoCuenta ?? '',
            tenpoCuenta: evento.eventoTenpoCuenta ?? '',
            tenpoQrUrl: evento.eventoTenpoQrUrl ?? '',
          }}
        />
      </section>

      {/* ------------------------------------------------ Tipos de entrada */}
      <section className="tarjeta mt-5 p-6 sm:p-8">
        <h2 className="titulo-display text-xl">Tipos de entrada</h2>
        <p className="mt-2 mb-6 text-sm text-dim">
          Precio, cupo y color de cada entrada. Los que ya vendieron no se pueden borrar, solo
          ocultar.
        </p>

        <div className="flex flex-col gap-3">
          {evento.tiposEntrada.map((tipo) => (
            <form
              key={tipo.tipoEntradaId}
              action={guardarTipoEntrada}
              className={`grid items-end gap-3 rounded-[12px] border border-line bg-white/[0.02] p-4 lg:grid-cols-[1.2fr_2fr_0.8fr_0.7fr_0.6fr_0.9fr_auto] ${
                tipo.tipoEntradaActivo ? '' : 'opacity-50'
              }`}
            >
              <input type="hidden" name="tipoEntradaId" value={tipo.tipoEntradaId} />
              <input type="hidden" name="eventoId" value={evento.eventoId} />

              <div className="campo">
                <label className="campo-label">Nombre</label>
                <input
                  name="nombre"
                  required
                  maxLength={80}
                  defaultValue={tipo.tipoEntradaNombre}
                  className="campo-input !py-2 text-sm"
                />
              </div>

              <div className="campo">
                <label className="campo-label">Descripción</label>
                <input
                  name="descripcion"
                  maxLength={300}
                  defaultValue={tipo.tipoEntradaDescripcion ?? ''}
                  className="campo-input !py-2 text-sm"
                />
              </div>

              <div className="campo">
                <label className="campo-label">Precio</label>
                <input
                  name="precio"
                  type="number"
                  min={0}
                  step={500}
                  defaultValue={tipo.tipoEntradaPrecio}
                  className="campo-input dato !py-2 text-sm"
                />
              </div>

              <div className="campo">
                <label className="campo-label">Cupo</label>
                <input
                  name="cupo"
                  type="number"
                  min={1}
                  defaultValue={tipo.tipoEntradaCupo ?? ''}
                  placeholder="∞"
                  className="campo-input dato !py-2 text-sm"
                />
              </div>

              <div className="campo">
                <label className="campo-label">Orden</label>
                <input
                  name="orden"
                  type="number"
                  defaultValue={tipo.tipoEntradaOrden}
                  className="campo-input dato !py-2 text-sm"
                />
              </div>

              <div className="campo">
                <label className="campo-label">Color</label>
                <select
                  name="color"
                  defaultValue={tipo.tipoEntradaColor}
                  className="campo-select !py-2 text-sm"
                >
                  {COLORES_TIPO.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 lg:pb-1.5">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-dim">
                  <input
                    type="checkbox"
                    name="activo"
                    defaultChecked={tipo.tipoEntradaActivo}
                    className="h-4 w-4 accent-[#00F0FF]"
                  />
                  Visible
                </label>

                <button type="submit" className="btn btn-borde btn-sm !px-3" title="Guardar">
                  <Save size={15} />
                </button>
              </div>

              <p className="dato text-xs text-faint lg:col-span-7">
                {uso.get(tipo.tipoEntradaId) ?? 0} persona(s) con esta entrada
              </p>
            </form>
          ))}
        </div>

        {/* Desactivar */}
        {evento.tiposEntrada.some((t) => t.tipoEntradaActivo) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {evento.tiposEntrada
              .filter((t) => t.tipoEntradaActivo)
              .map((tipo) => (
                <form key={tipo.tipoEntradaId} action={desactivarTipoEntrada}>
                  <input type="hidden" name="tipoEntradaId" value={tipo.tipoEntradaId} />
                  <button type="submit" className="btn btn-fantasma btn-sm">
                    <EyeOff size={14} />
                    Ocultar {tipo.tipoEntradaNombre}
                  </button>
                </form>
              ))}
          </div>
        )}

        <details className="group mt-5">
          <summary className="btn btn-borde btn-sm inline-flex cursor-pointer list-none">
            <Plus size={15} />
            Agregar tipo de entrada
          </summary>

          <form
            action={guardarTipoEntrada}
            className="mt-4 grid items-end gap-3 rounded-[12px] border border-dashed border-line-fuerte p-4 lg:grid-cols-[1.2fr_2fr_0.8fr_0.7fr_0.9fr_auto]"
          >
            <input type="hidden" name="eventoId" value={evento.eventoId} />
            <input type="hidden" name="activo" value="on" />

            <div className="campo">
              <label className="campo-label">Nombre</label>
              <input name="nombre" required maxLength={80} className="campo-input !py-2 text-sm" />
            </div>
            <div className="campo">
              <label className="campo-label">Descripción</label>
              <input name="descripcion" maxLength={300} className="campo-input !py-2 text-sm" />
            </div>
            <div className="campo">
              <label className="campo-label">Precio</label>
              <input
                name="precio"
                type="number"
                min={0}
                step={500}
                defaultValue={10000}
                className="campo-input dato !py-2 text-sm"
              />
            </div>
            <div className="campo">
              <label className="campo-label">Cupo</label>
              <input
                name="cupo"
                type="number"
                min={1}
                placeholder="∞"
                className="campo-input dato !py-2 text-sm"
              />
            </div>
            <div className="campo">
              <label className="campo-label">Color</label>
              <select name="color" className="campo-select !py-2 text-sm">
                {COLORES_TIPO.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primario btn-sm">
              Crear
            </button>
          </form>
        </details>
      </section>

      {/* ----------------------------------------------------------- Line-up */}
      <section className="tarjeta mt-5 p-6 sm:p-8">
        <h2 className="titulo-display text-xl">Line-up</h2>
        <p className="mt-2 mb-6 text-sm text-dim">Quién toca y a qué hora.</p>

        <div className="flex flex-col gap-3">
          {evento.artistas
            .filter((a) => a.artistaActivo)
            .map((artista) => (
              <form
                key={artista.artistaId}
                action={guardarArtista}
                className="grid items-end gap-3 rounded-[12px] border border-line bg-white/[0.02] p-4 lg:grid-cols-[1.2fr_1fr_1.6fr_1.1fr_0.5fr_auto_auto]"
              >
                <input type="hidden" name="artistaId" value={artista.artistaId} />
                <input type="hidden" name="eventoId" value={evento.eventoId} />

                <div className="campo">
                  <label className="campo-label">Artista</label>
                  <input
                    name="nombre"
                    required
                    maxLength={120}
                    defaultValue={artista.artistaNombre}
                    className="campo-input !py-2 text-sm"
                  />
                </div>

                <div className="campo">
                  <label className="campo-label">Género</label>
                  <input
                    name="genero"
                    maxLength={80}
                    defaultValue={artista.artistaGenero ?? ''}
                    className="campo-input !py-2 text-sm"
                  />
                </div>

                <div className="campo">
                  <label className="campo-label">Descripción</label>
                  <input
                    name="descripcion"
                    maxLength={400}
                    defaultValue={artista.artistaDescripcion ?? ''}
                    className="campo-input !py-2 text-sm"
                  />
                </div>

                <div className="campo">
                  <label className="campo-label">Empieza</label>
                  <input
                    name="horaInicio"
                    type="datetime-local"
                    defaultValue={aValorInputFecha(artista.artistaHoraInicio)}
                    className="campo-input !py-2 text-sm"
                  />
                </div>

                <div className="campo">
                  <label className="campo-label">Orden</label>
                  <input
                    name="orden"
                    type="number"
                    defaultValue={artista.artistaOrden}
                    className="campo-input dato !py-2 text-sm"
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-xs text-dim lg:pb-3">
                  <input
                    type="checkbox"
                    name="destacado"
                    defaultChecked={artista.artistaDestacado}
                    className="h-4 w-4 accent-[#FF2E9A]"
                  />
                  Headliner
                </label>

                <div className="flex gap-2 lg:pb-1.5">
                  <button type="submit" className="btn btn-borde btn-sm !px-3" title="Guardar">
                    <Save size={15} />
                  </button>
                </div>
              </form>
            ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {evento.artistas
            .filter((a) => a.artistaActivo)
            .map((artista) => (
              <form key={artista.artistaId} action={ocultarArtista}>
                <input type="hidden" name="artistaId" value={artista.artistaId} />
                <button type="submit" className="btn btn-fantasma btn-sm">
                  <EyeOff size={14} />
                  Quitar {artista.artistaNombre}
                </button>
              </form>
            ))}
        </div>

        <details className="mt-5">
          <summary className="btn btn-borde btn-sm inline-flex cursor-pointer list-none">
            <Plus size={15} />
            Agregar artista
          </summary>

          <form
            action={guardarArtista}
            className="mt-4 grid items-end gap-3 rounded-[12px] border border-dashed border-line-fuerte p-4 lg:grid-cols-[1.2fr_1fr_1.6fr_1.1fr_auto]"
          >
            <input type="hidden" name="eventoId" value={evento.eventoId} />

            <div className="campo">
              <label className="campo-label">Artista</label>
              <input name="nombre" required maxLength={120} className="campo-input !py-2 text-sm" />
            </div>
            <div className="campo">
              <label className="campo-label">Género</label>
              <input name="genero" maxLength={80} className="campo-input !py-2 text-sm" />
            </div>
            <div className="campo">
              <label className="campo-label">Descripción</label>
              <input name="descripcion" maxLength={400} className="campo-input !py-2 text-sm" />
            </div>
            <div className="campo">
              <label className="campo-label">Empieza</label>
              <input name="horaInicio" type="datetime-local" className="campo-input !py-2 text-sm" />
            </div>
            <button type="submit" className="btn btn-primario btn-sm">
              Agregar
            </button>
          </form>
        </details>
      </section>

      {/* -------------------------------------------------------- Preguntas */}
      <section className="tarjeta mt-5 p-6 sm:p-8">
        <h2 className="titulo-display text-xl">Preguntas frecuentes</h2>
        <p className="mt-2 mb-6 text-sm text-dim">Lo que evita que te escriban por privado.</p>

        <div className="flex flex-col gap-3">
          {evento.preguntas
            .filter((p) => p.preguntaActiva)
            .map((pregunta) => (
              <form
                key={pregunta.preguntaId}
                action={guardarPregunta}
                className="flex flex-col gap-3 rounded-[12px] border border-line bg-white/[0.02] p-4"
              >
                <input type="hidden" name="preguntaId" value={pregunta.preguntaId} />
                <input type="hidden" name="eventoId" value={evento.eventoId} />

                <div className="grid gap-3 sm:grid-cols-[1fr_5rem]">
                  <div className="campo">
                    <label className="campo-label">Pregunta</label>
                    <input
                      name="pregunta"
                      required
                      maxLength={300}
                      defaultValue={pregunta.preguntaTexto}
                      className="campo-input !py-2 text-sm"
                    />
                  </div>
                  <div className="campo">
                    <label className="campo-label">Orden</label>
                    <input
                      name="orden"
                      type="number"
                      defaultValue={pregunta.preguntaOrden}
                      className="campo-input dato !py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="campo">
                  <label className="campo-label">Respuesta</label>
                  <textarea
                    name="respuesta"
                    required
                    defaultValue={pregunta.preguntaRespuesta}
                    className="campo-textarea !min-h-[4.5rem] text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <button type="submit" className="btn btn-borde btn-sm">
                    <Save size={15} />
                    Guardar
                  </button>
                </div>
              </form>
            ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {evento.preguntas
            .filter((p) => p.preguntaActiva)
            .map((pregunta) => (
              <form key={pregunta.preguntaId} action={ocultarPregunta}>
                <input type="hidden" name="preguntaId" value={pregunta.preguntaId} />
                <button type="submit" className="btn btn-fantasma btn-sm">
                  <EyeOff size={14} />
                  Quitar «{pregunta.preguntaTexto.slice(0, 28)}…»
                </button>
              </form>
            ))}
        </div>

        <details className="mt-5">
          <summary className="btn btn-borde btn-sm inline-flex cursor-pointer list-none">
            <Plus size={15} />
            Agregar pregunta
          </summary>

          <form
            action={guardarPregunta}
            className="mt-4 flex flex-col gap-3 rounded-[12px] border border-dashed border-line-fuerte p-4"
          >
            <input type="hidden" name="eventoId" value={evento.eventoId} />

            <div className="campo">
              <label className="campo-label">Pregunta</label>
              <input name="pregunta" required maxLength={300} className="campo-input !py-2 text-sm" />
            </div>
            <div className="campo">
              <label className="campo-label">Respuesta</label>
              <textarea
                name="respuesta"
                required
                className="campo-textarea !min-h-[4.5rem] text-sm"
              />
            </div>
            <button type="submit" className="btn btn-primario btn-sm self-start">
              Agregar
            </button>
          </form>
        </details>
      </section>
    </>
  );
}
