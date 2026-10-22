import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Clock3,
  Info,
  Loader2,
  QrCode,
  ShieldCheck,
  XCircle,
  Zap,
} from 'lucide-react';

import { Encabezado } from '@/components/publico/Encabezado';
import { UbicacionRevelada } from '@/components/publico/UbicacionRevelada';
import { PiePagina } from '@/components/publico/PiePagina';
import { conciliarPagosPasarela } from '@/lib/conciliacion';
import { ETIQUETAS_METODO, type MetodoPago, paletaDeTipo } from '@/lib/constantes';
import { obtenerAsistentePorToken } from '@/lib/datos';
import { clavePublicaFintoc } from '@/lib/fintoc';
import { fechaHora, hora, pesos } from '@/lib/formato';
import { mensajeDeRechazoMp } from '@/lib/mercadopago';
import { pasarelaActiva } from '@/lib/pasarela';
import { VIGENCIA_RESERVA_MS, reservaVencida } from '@/lib/reservas';

import { BotonPagarEnLinea } from './BotonPagarEnLinea';
import { BotonPagarFlow } from './BotonPagarFlow';
import { BotonPagarMercadoPago } from './BotonPagarMercadoPago';
import { EsperandoConfirmacion } from './EsperandoConfirmacion';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mi entrada',
  robots: { index: false, follow: false },
};

export default async function PaginaMiEntrada({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ pago?: string }>;
}) {
  const [{ token }, parametros] = await Promise.all([params, searchParams]);

  let asistente = await obtenerAsistentePorToken(token);

  if (!asistente) notFound();

  // Alguien pudo pagar y cerrar la pestaña antes de que llegara el webhook (o
  // este pudo perderse). Si quedo un cobro colgado, se le pregunta a Fintoc y se
  // emite la entrada acá mismo. El filtro de antiguedad evita consultar cuando
  // el cliente ya esta preguntando por su cuenta, recien apretado el boton.
  const hayCobroColgado =
    !asistente.entrada &&
    asistente.pagos.some((p) => p.pagoProveedor !== 'manual' && p.pagoEstado === 'pendiente');

  // Recien vuelto de Mercado Pago se consulta sin esperar: es justo el momento
  // en que la persona quiere ver su entrada.
  const volvioDeMp = parametros.pago === 'mp';

  if (hayCobroColgado) {
    const conciliado = await conciliarPagosPasarela(
      asistente.asistenteId,
      volvioDeMp ? 0 : 20_000,
    );
    if (conciliado.reciencerrado) {
      asistente = (await obtenerAsistentePorToken(token)) ?? asistente;
    }
  }

  const { evento, tipoEntrada, entrada, pagos } = asistente;
  const paleta = paletaDeTipo(tipoEntrada.tipoEntradaColor);

  // Precio congelado al reservar: si la etapa subio despues, no le afecta.
  const precio = asistente.asistentePrecio;
  const pagado = asistente.asistenteMontoPagado;
  const saldo = Math.max(0, precio - pagado);
  const pendientes = pagos.filter((p) => p.pagoEstado === 'pendiente');
  const estaPagada = pagado > 0;
  const pasarela = pasarelaActiva();
  const enLinea = pasarela !== null;
  const activa = asistente.asistenteEstado !== 'anulado' && evento.eventoEstado !== 'finalizado';

  // Una reserva sin pagar suelta el cupo a la hora. Se le dice a que hora, y
  // si ya paso se le dice eso en vez de dejarle un boton que va a fallar: un
  // boton que rebota parece una falla del sitio, no un plazo cumplido.
  const caducada = reservaVencida(asistente);
  const vence =
    asistente.asistenteEstado === 'pendiente' && !caducada
      ? hora(new Date(asistente.createdAt.getTime() + VIGENCIA_RESERVA_MS))
      : null;

  // Lo que dice el backend del ultimo intento con Mercado Pago. El aviso de
  // regreso sale de aca y no de los parametros que Mercado Pago pone en la URL:
  // esos los puede escribir cualquiera.
  const ultimoMp = pagos.find((p) => p.pagoProveedor === 'mercadopago') ?? null;
  const mpEnCurso =
    ultimoMp?.pagoEstado === 'pendiente' &&
    ['pending', 'in_process', 'authorized', 'in_mediation'].includes(ultimoMp.pagoExternoEstado ?? '');
  const mpRechazado =
    ultimoMp?.pagoEstado === 'rechazado' ||
    (ultimoMp?.pagoEstado === 'pendiente' && ultimoMp.pagoExternoEstado === 'rejected');

  return (
    <>
      <Encabezado />

      <main className="contenedor py-12">
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          {/* ------------------------------------------- Retorno del pago */}
          {parametros.pago === 'ok' && saldo > 0 && (
            <div className="flex items-start gap-3 rounded-[14px] border border-[rgba(0,240,255,0.3)] bg-[rgba(0,240,255,0.06)] px-5 py-4">
              <Loader2 size={18} className="girando mt-0.5 shrink-0 text-cyan" />
              <div>
                <p className="font-medium">Estamos confirmando tu pago</p>
                <p className="mt-1 text-sm leading-relaxed text-dim">
                  Tu banco ya nos avisó. Puede tardar unos segundos en aparecer acá — recarga la
                  página en un momento y tu entrada debería estar lista.
                </p>
              </div>
            </div>
          )}

          {volvioDeMp && saldo > 0 && (
            <>
              {!mpRechazado && <EsperandoConfirmacion token={asistente.asistenteToken} />}
              {mpRechazado ? (
                <div className="flex items-start gap-3 rounded-[14px] border border-[rgba(255,77,109,0.3)] bg-[rgba(255,77,109,0.06)] px-5 py-4">
                  <XCircle size={18} className="mt-0.5 shrink-0 text-error" />
                  <div>
                    <p className="font-medium">Mercado Pago rechazó el pago</p>
                    <p className="mt-1 text-sm leading-relaxed text-dim">
                      {mensajeDeRechazoMp(ultimoMp?.pagoExternoDetalle)} Tu entrada sigue
                      reservada: puedes intentarlo de nuevo.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-[14px] border border-[rgba(0,240,255,0.3)] bg-[rgba(0,240,255,0.06)] px-5 py-4">
                  <Loader2 size={18} className="girando mt-0.5 shrink-0 text-cyan" />
                  <div>
                    <p className="font-medium">
                      {mpEnCurso ? 'Tu pago está en proceso' : 'Estamos confirmando tu pago'}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-dim">
                      {mpEnCurso
                        ? 'Mercado Pago todavía lo está revisando. Apenas se apruebe te llega la entrada por correo y aparece acá.'
                        : 'Le estamos preguntando a Mercado Pago. Si pagaste, tu entrada aparece acá en unos segundos. Si no completaste el pago, puedes intentarlo de nuevo.'}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {parametros.pago === 'cancelado' && (
            <div className="flex items-start gap-3 rounded-[14px] border border-[rgba(255,197,61,0.3)] bg-[rgba(255,197,61,0.06)] px-5 py-4">
              <Info size={18} className="mt-0.5 shrink-0 text-alerta" />
              <div>
                <p className="font-medium">No completaste el pago</p>
                <p className="mt-1 text-sm leading-relaxed text-dim">
                  Tu entrada sigue reservada. Puedes intentarlo de nuevo cuando quieras.
                </p>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------- Estado */}
          <header className="tarjeta p-7 sm:p-9">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{evento.eventoNombre}</p>
                <h1 className="titulo-display mt-2.5 text-3xl sm:text-4xl">
                  Hola, {asistente.asistenteNombre.split(' ')[0]}
                </h1>
              </div>

              <span
                className="dato rounded-full border px-3 py-1.5 text-[0.7rem] tracking-[0.16em] uppercase"
                style={{ color: paleta.texto, borderColor: paleta.borde, background: paleta.fondo }}
              >
                {tipoEntrada.tipoEntradaNombre}
              </span>
            </div>

            <div className="regla my-7" />

            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <div className="dato text-[0.65rem] tracking-[0.16em] text-faint uppercase">
                  Tu entrada
                </div>
                <div className="dato mt-1.5 text-2xl font-semibold">{pesos(precio)}</div>
              </div>
              <div>
                <div className="dato text-[0.65rem] tracking-[0.16em] text-faint uppercase">
                  {saldo > 0 ? 'Pagado' : 'Total pagado'}
                </div>
                <div
                  className={`dato mt-1.5 text-2xl font-semibold ${estaPagada ? 'text-ok' : 'text-dim'}`}
                >
                  {pesos(pagado)}
                </div>
              </div>
              <div>
                <div className="dato text-[0.65rem] tracking-[0.16em] text-faint uppercase">
                  Estado
                </div>
                <div className="mt-2">
                  {asistente.asistenteEstado === 'anulado' ? (
                    <span className="insignia insignia-error">
                      <XCircle size={13} /> Anulada
                    </span>
                  ) : estaPagada ? (
                    <span className="insignia insignia-ok">
                      <BadgeCheck size={13} /> Pagada
                    </span>
                  ) : pendientes.length > 0 ? (
                    <span className="insignia insignia-pendiente">
                      <Clock3 size={13} /> En revisión
                    </span>
                  ) : (
                    <span className="insignia insignia-neutral">Falta pagar</span>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* ------------------------------------------------------ Entrada */}
          {entrada && entrada.entradaEstado !== 'anulada' && (
            <section className="borde-neon tarjeta p-7 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[rgba(0,240,255,0.35)] bg-[rgba(0,240,255,0.08)] text-cyan">
                    <QrCode size={22} />
                  </div>
                  <div>
                    <h2 className="titulo-display text-xl">Tu entrada está lista</h2>
                    <p className="dato mt-1.5 text-sm tracking-[0.16em] text-cyan">
                      {entrada.entradaCodigo}
                    </p>
                    {entrada.entradaEstado === 'quemada' && (
                      <p className="mt-2 text-sm text-dim">
                        Ya fue usada en la puerta el {fechaHora(entrada.entradaFechaQuemada)}.
                      </p>
                    )}
                  </div>
                </div>

                <Link href={`/entrada/${entrada.entradaToken}`} className="btn btn-primario">
                  Ver mi QR
                  <ArrowRight size={17} />
                </Link>
              </div>
            </section>
          )}

          {/* ---------------------------------------------------- Ubicacion */}
          {/* Solo con la entrada emitida. Mientras el pago no se confirme, el
              lugar sigue siendo secreto: es lo unico que sostiene que la
              direccion no circule antes de tiempo. */}
          {entrada && entrada.entradaEstado !== 'anulada' && (
            <UbicacionRevelada
              venue={evento.eventoVenue}
              direccion={evento.eventoDireccion}
              ciudad={evento.eventoCiudad}
              mapaUrl={evento.eventoMapaUrl}
              latitud={evento.eventoLatitud}
              longitud={evento.eventoLongitud}
            />
          )}

          {activa && saldo > 0 && caducada && (
            <section className="tarjeta p-7 sm:p-9">
              <div className="flex items-center gap-3">
                <Clock3 size={19} className="text-naranja" />
                <h2 className="titulo-display text-xl">Tu reserva venció</h2>
              </div>
              <p className="mt-3 leading-relaxed text-dim">
                Las reservas sin pagar duran una hora, así que este cupo volvió a quedar
                disponible. Puedes comprar de nuevo con el mismo número: tu lugar en la lista de
                invitados sigue intacto. El precio será el que esté vigente ahora.
              </p>
              <Link href="/comprar" className="btn btn-primario mt-6">
                Comprar de nuevo
                <ArrowRight size={18} />
              </Link>
            </section>
          )}

          {/* --------------------------------------------------- Pago en línea */}
          {activa && saldo > 0 && enLinea && !caducada && (
            <section className="borde-neon tarjeta p-7 sm:p-9">
              <div className="flex items-center gap-3">
                <Zap size={19} className="text-cyan" />
                <h2 className="titulo-display text-xl">Paga al tiro</h2>
              </div>

              <p className="mt-3 mb-6 leading-relaxed text-dim">
                {pasarela === 'fintoc'
                  ? 'Transferencia directa desde tu banco, sin salir de esta página. Tu entrada se emite sola, sin que nadie tenga que revisar nada.'
                  : pasarela === 'flow'
                    ? 'Paga con tarjeta, débito o transferencia a través de Flow. Tu entrada se emite sola, sin que nadie tenga que revisar nada.'
                    : 'Paga con tarjeta de crédito, débito u otros medios en Mercado Pago. Tu entrada se emite sola, sin que nadie tenga que revisar nada.'}
              </p>

              {vence && (
                <p className="mb-6 flex items-start gap-2.5 rounded-[12px] border border-[rgba(255,163,26,0.28)] bg-[rgba(255,163,26,0.06)] px-4 py-3.5 text-sm leading-relaxed text-dim">
                  <Clock3 size={15} className="mt-0.5 shrink-0 text-naranja" />
                  <span>
                    Tu reserva vence a las <strong className="text-ink">{vence}</strong>. Después de
                    esa hora el cupo se libera, pero puedes volver a comprar en el sitio.
                  </span>
                </p>
              )}

              {pasarela === 'fintoc' ? (
                <BotonPagarEnLinea
                  token={asistente.asistenteToken}
                  monto={saldo}
                  clavePublica={clavePublicaFintoc()}
                />
              ) : pasarela === 'flow' ? (
                <BotonPagarFlow token={asistente.asistenteToken} monto={saldo} />
              ) : (
                <BotonPagarMercadoPago token={asistente.asistenteToken} monto={saldo} />
              )}

              <p className="mt-5 flex items-start gap-2.5 text-xs leading-relaxed text-faint">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-ok" />
                {pasarela === 'flow' || pasarela === 'mercadopago'
                  ? `El pago ocurre en ${pasarela === 'flow' ? 'Flow' : 'Mercado Pago'}. Nosotros nunca vemos los datos de tu tarjeta ni las claves de tu banco.`
                  : 'Te conectas con tu propio banco. Nosotros nunca vemos tus claves ni los datos de tu cuenta.'}
              </p>
            </section>
          )}

          {/* ------------------------------------------- Ya pagada (Mercado Pago) */}
          {activa && saldo <= 0 && estaPagada && pasarela === 'mercadopago' && (
            <section className="tarjeta p-7 sm:p-9">
              <BotonPagarMercadoPago token={asistente.asistenteToken} monto={0} pagado />
            </section>
          )}

          {/* -------------------------------------- Sin pasarela: no hay como pagar */}
          {/* Ya no existe el camino de transferir a mano: se paga por la pasarela y
              la entrada se emite sola. Si la pasarela esta caida o sin configurar,
              se dice derecho, en vez de dejar la pagina sin ninguna forma de pagar. */}
          {activa && saldo > 0 && !enLinea && (
            <section className="tarjeta p-7 sm:p-9">
              <div className="flex items-start gap-3">
                <AlertTriangle size={19} className="mt-0.5 shrink-0 text-alerta" />
                <div>
                  <h2 className="titulo-display text-xl">El pago está fuera por ahora</h2>
                  <p className="mt-3 leading-relaxed text-dim">
                    No podemos cobrarte en línea en este momento. Tu entrada sigue reservada:
                    guarda este link y vuelve en un rato. Si se demora, escríbenos
                    {evento.eventoInstagram ? ` a @${evento.eventoInstagram}` : ' por Instagram'} y
                    lo resolvemos contigo.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ---------------------------------------------------- Historial */}
          {pagos.length > 0 && (
            <section className="tarjeta p-7 sm:p-9">
              <h2 className="titulo-display text-xl">Tus pagos</h2>

              <ul className="mt-6 flex flex-col divide-y divide-[var(--color-line)]">
                {pagos.map((pago) => (
                  <li key={pago.pagoId} className="flex flex-wrap items-center gap-4 py-4">
                    <div className="dato min-w-24 text-lg font-semibold">
                      {pesos(pago.pagoMonto)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-dim">
                        {ETIQUETAS_METODO[pago.pagoMetodo as MetodoPago] ?? pago.pagoMetodo}
                        {' · '}
                        {fechaHora(pago.pagoFechaDeclarado)}
                      </div>
                      {['rechazado', 'cancelado', 'reembolsado'].includes(pago.pagoEstado) &&
                        pago.pagoMotivoRechazo && (
                        <p className="mt-1 text-sm text-error">{pago.pagoMotivoRechazo}</p>
                      )}
                    </div>

                    {pago.pagoEstado === 'confirmado' ? (
                      <span className="insignia insignia-ok">Confirmado</span>
                    ) : pago.pagoEstado === 'rechazado' ? (
                      <span className="insignia insignia-error">Rechazado</span>
                    ) : pago.pagoEstado === 'cancelado' ? (
                      <span className="insignia insignia-neutral">Cancelado</span>
                    ) : pago.pagoEstado === 'reembolsado' ? (
                      <span className="insignia insignia-neutral">Devuelto</span>
                    ) : (
                      <span className="insignia insignia-pendiente">
                        {pago.pagoProveedor === 'fintoc'
                          ? 'Esperando el banco'
                          : pago.pagoProveedor === 'mercadopago' && !pago.pagoExternoEstado
                            ? 'Sin completar'
                            : 'En revisión'}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-center text-sm text-dim">
            Guarda este link: es tu página privada.{' '}
            <Link href="/" className="text-cyan underline-offset-4 hover:underline">
              Volver al inicio
            </Link>
          </p>
        </div>
      </main>

      <PiePagina instagram={evento.eventoInstagram} ciudad={evento.eventoCiudad} />
    </>
  );
}
