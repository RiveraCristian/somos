'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Building2, ExternalLink, Loader2 } from 'lucide-react';

import { pesos } from '@/lib/formato';

import { iniciarPagoEnLinea, verificarPagoEnLinea, type EstadoCobro } from './acciones';

type Props = {
  token: string;
  monto: number;
  clavePublica: string;
};

type Widget = { open: () => void; close: () => void; destroy: () => void };

/** Nombre del producto del widget. Aislado acá para poder cambiarlo de un lugar. */
const PRODUCTO = 'payments';

export function BotonPagarEnLinea({ token, monto, clavePublica }: Props) {
  const router = useRouter();
  const [estado, accion, pendiente] = useActionState<EstadoCobro, FormData>(
    iniciarPagoEnLinea,
    {},
  );

  const [confirmando, setConfirmando] = useState(false);
  const [seDemora, setSeDemora] = useState(false);
  const [falloWidget, setFalloWidget] = useState(false);
  const refWidget = useRef<Widget | null>(null);

  /**
   * Tras pagar, se le pregunta al servidor por el estado real del cobro.
   *
   * No basta con refrescar: el webhook puede tardar o directamente no llegar
   * (en desarrollo local Fintoc no tiene una URL publica a la que pegarle). La
   * verificacion consulta a Fintoc y emite la entrada apenas confirma el cobro,
   * asi que el flujo se cierra con o sin webhook.
   */
  const esperarConfirmacion = useCallback(() => {
    setConfirmando(true);
    let vueltas = 0;

    const revisar = async () => {
      vueltas += 1;
      try {
        const estado = await verificarPagoEnLinea(token);
        if (estado.pagado) {
          clearInterval(reloj);
          router.refresh();
          return;
        }
      } catch {
        // Reintenta en la proxima vuelta.
      }
      router.refresh();
      if (vueltas >= 20) {
        clearInterval(reloj);
        setSeDemora(true);
      }
    };

    const reloj = setInterval(revisar, 3000);
    void revisar();
  }, [router, token]);

  // Cada intento trae una sesión nueva: ahí se abre el widget.
  useEffect(() => {
    if (!estado.sesionToken || !clavePublica) return;

    let cancelado = false;
    setFalloWidget(false);

    (async () => {
      try {
        const { getFintoc } = await import('@fintoc/fintoc-js');
        const Fintoc = await getFintoc();
        if (!Fintoc) throw new Error('El script de Fintoc no cargó.');
        if (cancelado) return;

        const widget = Fintoc.create({
          publicKey: clavePublica,
          product: PRODUCTO,
          sessionToken: estado.sesionToken,
          // El callback NO confirma el cobro: solo mueve la interfaz. La
          // confirmación real llega por webhook.
          onSuccess: () => esperarConfirmacion(),
          onExit: () => {},
          onEvent: (nombre: string) => {
            if (nombre === 'on_error') {
              console.error('[fintoc] el widget reportó un error');
            }
          },
        }) as Widget;

        refWidget.current = widget;
        widget.open();
      } catch (e) {
        console.error('[fintoc] no se pudo montar el widget:', e);
        if (!cancelado) setFalloWidget(true);
      }
    })();

    return () => {
      cancelado = true;
      refWidget.current?.destroy();
      refWidget.current = null;
    };
  }, [estado.sesionToken, estado.intento, clavePublica, esperarConfirmacion]);

  if (confirmando) {
    return (
      <div
        className={`flex items-start gap-3 rounded-[12px] border px-5 py-4 ${
          seDemora
            ? 'border-[rgba(255,197,61,0.3)] bg-[rgba(255,197,61,0.06)]'
            : 'border-[rgba(0,240,255,0.3)] bg-[rgba(0,240,255,0.06)]'
        }`}
      >
        {seDemora ? (
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-alerta" />
        ) : (
          <Loader2 size={18} className="girando mt-0.5 shrink-0 text-cyan" />
        )}
        <div>
          <p className="font-medium">
            {seDemora ? 'Se está demorando más de lo normal' : 'Confirmando tu pago…'}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-dim">
            {seDemora
              ? 'Si ya pagaste, tu entrada va a aparecer apenas se confirme. Recarga en un rato o escríbenos si no llega.'
              : 'Tu banco ya respondió. En cuanto se confirme, tu entrada aparece acá mismo sin que tengas que hacer nada.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form action={accion}>
        <input type="hidden" name="token" value={token} />
        <button type="submit" className="btn btn-primario w-full" disabled={pendiente}>
          {pendiente ? (
            <>
              <Loader2 size={18} className="girando" />
              Preparando el pago…
            </>
          ) : (
            <>
              <Building2 size={18} />
              Pagar {pesos(monto)} con mi banco
            </>
          )}
        </button>
      </form>

      {estado.error && (
        <p className="flex items-start gap-2.5 rounded-[10px] border border-[rgba(255,77,109,0.3)] bg-[rgba(255,77,109,0.08)] px-4 py-3 text-sm text-error">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {estado.error}
        </p>
      )}

      {/* Plan B. Con ui_mode embedded Fintoc no devuelve link alojado, asi que
          en la practica cae al mensaje de mas abajo: transferir por cuenta propia. */}
      {falloWidget && estado.urlRespaldo && (
        <a
          href={estado.urlRespaldo}
          className="btn btn-borde w-full"
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={16} />
          Abrir el pago en una pestaña nueva
        </a>
      )}

      {falloWidget && !estado.urlRespaldo && (
        <p className="text-sm text-alerta">
          No pudimos abrir el pago acá. Transfiere a la cuenta de más abajo y sube el comprobante.
        </p>
      )}
    </div>
  );
}
