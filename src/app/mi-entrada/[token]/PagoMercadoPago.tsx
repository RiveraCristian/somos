'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

import { cobrarConBrick, verificarPagoEnLinea, type ResultadoBrick } from './acciones';

type Props = {
  token: string;
  monto: number;
  clavePublica: string;
  correo: string;
};

export function PagoMercadoPago({ token, monto, clavePublica, correo }: Props) {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [Brick, setBrick] = useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const [resultado, setResultado] = useState<ResultadoBrick | null>(null);
  const [esperando, setEsperando] = useState(false);

  // El SDK toca `window`, asi que se carga solo en el navegador.
  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const sdk = await import('@mercadopago/sdk-react');
        if (cancelado) return;
        sdk.initMercadoPago(clavePublica, { locale: 'es-CL' });
        setBrick(() => sdk.Payment as unknown as React.ComponentType<Record<string, unknown>>);
      } catch (e) {
        console.error('[mercadopago] no se pudo cargar el SDK:', e);
        setResultado({
          estado: 'error',
          mensaje: 'No pudimos cargar el formulario de pago. Transfiere a la cuenta de más abajo.',
        });
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [clavePublica]);

  /** Un pago "en proceso" se resuelve despues: se consulta hasta que cierre. */
  const esperarResolucion = useCallback(() => {
    setEsperando(true);
    let vueltas = 0;

    const revisar = async () => {
      vueltas += 1;
      try {
        const estado = await verificarPagoEnLinea(token);
        if (estado.pagado) {
          clearInterval(reloj);
          setEsperando(false);
          router.refresh();
          return;
        }
      } catch {
        // Reintenta en la proxima vuelta.
      }
      if (vueltas >= 15) {
        clearInterval(reloj);
        setEsperando(false);
      }
    };

    const reloj = setInterval(revisar, 3000);
  }, [router, token]);

  const alEnviar = useCallback(
    async ({ formData }: { formData: Record<string, unknown> }) => {
      const respuesta = await cobrarConBrick(token, formData);
      setResultado(respuesta);

      if (respuesta.estado === 'aprobado') {
        router.refresh();
      } else if (respuesta.estado === 'en_proceso') {
        esperarResolucion();
      }

      // El Brick espera una promesa resuelta para cerrar su propio spinner.
      return Promise.resolve();
    },
    [token, router, esperarResolucion],
  );

  if (resultado?.estado === 'aprobado') {
    return (
      <div className="flex items-start gap-3 rounded-[12px] border border-[rgba(53,240,160,0.3)] bg-[rgba(53,240,160,0.07)] px-5 py-4">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ok" />
        <div>
          <p className="font-medium">{resultado.mensaje}</p>
          <p className="mt-1 text-sm text-dim">Tu entrada aparece acá abajo en un segundo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Acá `resultado` ya no puede ser 'aprobado': ese caso salió arriba. */}
      {resultado && (
        <p
          className={`flex items-start gap-2.5 rounded-[10px] border px-4 py-3 text-sm ${
            resultado.estado === 'en_proceso'
              ? 'border-[rgba(255,197,61,0.3)] bg-[rgba(255,197,61,0.08)] text-alerta'
              : 'border-[rgba(255,77,109,0.3)] bg-[rgba(255,77,109,0.08)] text-error'
          }`}
        >
          {resultado.estado === 'en_proceso' && esperando ? (
            <Loader2 size={16} className="girando mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
          )}
          {resultado.mensaje}
        </p>
      )}

      {!Brick && !resultado && (
        <div className="flex items-center justify-center gap-3 rounded-[12px] border border-line bg-white/[0.02] px-5 py-10 text-sm text-dim">
          <Loader2 size={18} className="girando text-cyan" />
          Cargando el formulario de pago…
        </div>
      )}

      {Brick && (
        <div className={listo ? '' : 'min-h-32'}>
          <Brick
            initialization={{ amount: monto, payer: { email: correo } }}
            customization={{
              paymentMethods: { creditCard: 'all', debitCard: 'all' },
              visual: { style: { theme: 'dark' } },
            }}
            onReady={() => setListo(true)}
            onSubmit={alEnviar}
            onError={(error: unknown) => {
              console.error('[mercadopago] error del brick:', error);
            }}
          />
        </div>
      )}
    </div>
  );
}
