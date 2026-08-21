import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Clock3,
  Info,
  Loader2,
  QrCode,
  ShieldCheck,
  Smartphone,
  XCircle,
  Zap,
} from 'lucide-react';

import { DatoCopiable } from '@/components/publico/DatoCopiable';
import { Encabezado } from '@/components/publico/Encabezado';
import { PiePagina } from '@/components/publico/PiePagina';
import { conciliarPagosPasarela } from '@/lib/conciliacion';
import { ETIQUETAS_METODO, type MetodoPago, paletaDeTipo } from '@/lib/constantes';
import { obtenerAsistentePorToken } from '@/lib/datos';
import { clavePublicaFintoc } from '@/lib/fintoc';
import { fechaHora, pesos } from '@/lib/formato';
import { clavePublicaMercadoPago } from '@/lib/mercadopago';
import { pasarelaActiva } from '@/lib/pasarela';

import { BotonPagarEnLinea } from './BotonPagarEnLinea';
import { FormularioPago } from './FormularioPago';
import { PagoMercadoPago } from './PagoMercadoPago';

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

  if (hayCobroColgado) {
    const conciliado = await conciliarPagosPasarela(asistente.asistenteId, 20_000);
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

  const datosTenpo = [
    { etiqueta: 'Titular', valor: evento.eventoTenpoNombre },
    { etiqueta: 'RUT', valor: evento.eventoTenpoRut },
    { etiqueta: 'Banco', valor: evento.eventoTenpoBanco },
    { etiqueta: 'Tipo de cuenta', valor: evento.eventoTenpoTipoCuenta },
    { etiqueta: 'N° de cuenta', valor: evento.eventoTenpoCuenta },
    { etiqueta: 'Correo', valor: evento.eventoTenpoCorreo },
  ].filter((d): d is { etiqueta: string; valor: string } => Boolean(d.valor));

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

          {/* --------------------------------------------------- Pago en línea */}
          {activa && saldo > 0 && enLinea && (
            <section className="borde-neon tarjeta p-7 sm:p-9">
              <div className="flex items-center gap-3">
                <Zap size={19} className="text-cyan" />
                <h2 className="titulo-display text-xl">Paga al tiro</h2>
              </div>

              <p className="mt-3 mb-6 leading-relaxed text-dim">
                {pasarela === 'fintoc'
                  ? 'Transferencia directa desde tu banco, sin salir de esta página. Tu entrada se emite sola, sin que nadie tenga que revisar nada.'
                  : 'Paga con tu tarjeta acá mismo. Tu entrada se emite sola, sin que nadie tenga que revisar nada.'}
              </p>

              {pasarela === 'fintoc' ? (
                <BotonPagarEnLinea
                  token={asistente.asistenteToken}
                  monto={saldo}
                  clavePublica={clavePublicaFintoc()}
                />
              ) : (
                <PagoMercadoPago
                  token={asistente.asistenteToken}
                  monto={saldo}
                  clavePublica={clavePublicaMercadoPago()}
                  correo={asistente.asistenteCorreo}
                />
              )}

              <p className="mt-5 flex items-start gap-2.5 text-xs leading-relaxed text-faint">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-ok" />
                Te conectas con tu propio banco. Nosotros nunca vemos tus claves ni los datos de
                tu cuenta.
              </p>
            </section>
          )}

          {/* ------------------------------------------------- Transferencia manual */}
          {activa && saldo > 0 && (
            <section className="tarjeta p-7 sm:p-9">
              {enLinea ? (
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <span className="flex items-center gap-3">
                      <Smartphone size={19} className="text-violeta" />
                      <span className="titulo-display text-xl">Prefiero transferir por Tenpo</span>
                    </span>
                    <ChevronDown
                      size={18}
                      className="shrink-0 text-dim transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div className="pt-6">
                    <TransferenciaManual
                      datos={datosTenpo}
                      qr={evento.eventoTenpoQrUrl}
                      saldo={saldo}
                    />
                    <div className="regla my-8" />
                    <FormularioPago
                      token={asistente.asistenteToken}
                      precio={precio}
                      saldoPendiente={saldo}
                    />
                  </div>
                </details>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Smartphone size={19} className="text-violeta" />
                    <h2 className="titulo-display text-xl">Paga por Tenpo</h2>
                  </div>
                  <div className="pt-6">
                    <TransferenciaManual
                      datos={datosTenpo}
                      qr={evento.eventoTenpoQrUrl}
                      saldo={saldo}
                    />
                    <div className="regla my-8" />
                    <FormularioPago
                      token={asistente.asistenteToken}
                      precio={precio}
                      saldoPendiente={saldo}
                    />
                  </div>
                </>
              )}
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
                      {pago.pagoEstado === 'rechazado' && pago.pagoMotivoRechazo && (
                        <p className="mt-1 text-sm text-error">{pago.pagoMotivoRechazo}</p>
                      )}
                    </div>

                    {pago.pagoEstado === 'confirmado' ? (
                      <span className="insignia insignia-ok">Confirmado</span>
                    ) : pago.pagoEstado === 'rechazado' ? (
                      <span className="insignia insignia-error">Rechazado</span>
                    ) : (
                      <span className="insignia insignia-pendiente">
                        {pago.pagoProveedor === 'fintoc' ? 'Esperando el banco' : 'En revisión'}
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

function TransferenciaManual({
  datos,
  qr,
  saldo,
}: {
  datos: { etiqueta: string; valor: string }[];
  qr: string | null;
  saldo: number;
}) {
  return (
    <>
      <p className="mb-6 leading-relaxed text-dim">
        Transfiere <b className="dato text-ink">{pesos(saldo)}</b> a estos datos y sube la captura.
      </p>

      <div className="grid gap-7 lg:grid-cols-[1fr_auto]">
        <div className="rounded-[12px] border border-line bg-white/[0.02] px-5">
          {datos.length > 0 ? (
            datos.map((d) => <DatoCopiable key={d.etiqueta} etiqueta={d.etiqueta} valor={d.valor} />)
          ) : (
            <p className="py-6 text-sm text-dim">
              Todavía no cargamos los datos de transferencia. Escríbenos por Instagram.
            </p>
          )}
        </div>

        {qr && (
          <figure className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt="QR de cobro de Tenpo"
              className="h-44 w-44 rounded-[12px] border border-line bg-white object-contain p-2"
            />
            <figcaption className="dato text-[0.65rem] tracking-[0.14em] text-faint uppercase">
              Escanéalo desde Tenpo
            </figcaption>
          </figure>
        )}
      </div>

      <p className="mt-6 flex items-start gap-2.5 rounded-[10px] border border-line bg-white/[0.02] px-4 py-3 text-sm leading-relaxed text-dim">
        <Info size={15} className="mt-0.5 shrink-0 text-cyan" />
        Tenpo no nos avisa automáticamente cuando llega una transferencia, así que revisamos cada
        comprobante a mano. Por eso te pedimos la captura.
      </p>
    </>
  );
}
