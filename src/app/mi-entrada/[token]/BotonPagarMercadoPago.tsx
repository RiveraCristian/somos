'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, BadgeCheck, CreditCard, Loader2 } from 'lucide-react';

import { pesos } from '@/lib/formato';

import { iniciarPagoMercadoPago, type EstadoCobroMp } from './acciones';

type Props = {
  token: string;
  monto: number;
  /** La entrada ya esta pagada: el boton queda deshabilitado. */
  pagado?: boolean;
};

/**
 * Pagar con Mercado Pago (Checkout Pro).
 *
 * Igual que Flow, no hay formulario en esta pagina: el boton crea la
 * preferencia en el servidor y recien entonces navega a mercadopago.cl, porque
 * la URL del checkout solo existe despues de que Mercado Pago la acepta.
 *
 * La navegacion va por `window.location` y no por el router de Next: el
 * destino es otro dominio, y el router solo sabe moverse dentro de este.
 */
export function BotonPagarMercadoPago({ token, monto, pagado = false }: Props) {
  const router = useRouter();
  const [estado, accion, pendiente] = useActionState<EstadoCobroMp, FormData>(
    iniciarPagoMercadoPago,
    {},
  );

  useEffect(() => {
    if (estado.url) window.location.href = estado.url;
  }, [estado.url]);

  // El servidor descubrio que ya estaba pagado (volvio por otra pestaña, o el
  // webhook llego antes): se recarga la pagina para mostrar la entrada.
  useEffect(() => {
    if (estado.pagado) router.refresh();
  }, [estado.pagado, router]);

  if (pagado || estado.pagado) {
    return (
      <button type="button" className="btn btn-primario w-full" disabled>
        <BadgeCheck size={18} />
        Tu aporte ya fue recibido
      </button>
    );
  }

  // Entre que Mercado Pago responde y que el navegador cambia de pagina pasa
  // un instante. Sin esto, el boton vuelve a habilitarse justo cuando ya no debe.
  const yendo = Boolean(estado.url);

  return (
    <div className="flex flex-col gap-3">
      <form action={accion}>
        <input type="hidden" name="token" value={token} />
        <button type="submit" className="btn btn-primario w-full" disabled={pendiente || yendo}>
          {pendiente || yendo ? (
            <>
              <Loader2 size={18} className="girando" />
              {yendo ? 'Llevándote a Mercado Pago…' : 'Preparando el pago…'}
            </>
          ) : (
            <>
              <CreditCard size={18} />
              Pagar con Mercado Pago · {pesos(monto)}
            </>
          )}
        </button>
      </form>

      <p className="text-center text-xs leading-relaxed text-faint">
        Te llevamos a Mercado Pago para pagar y vuelves solo. No necesitas cuenta de Mercado
        Pago para pagar con tarjeta.
      </p>

      {estado.error && (
        <p className="flex items-start gap-2.5 rounded-[10px] border border-[rgba(255,77,109,0.3)] bg-[rgba(255,77,109,0.08)] px-4 py-3 text-sm text-error">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {estado.error}
        </p>
      )}
    </div>
  );
}
