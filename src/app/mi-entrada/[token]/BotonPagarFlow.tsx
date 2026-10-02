'use client';

import { useActionState, useEffect } from 'react';
import { AlertCircle, CreditCard, Loader2 } from 'lucide-react';

import { pesos } from '@/lib/formato';

import { iniciarPagoFlow, type EstadoCobroFlow } from './acciones';

type Props = {
  token: string;
  monto: number;
};

/**
 * Pagar con Flow.
 *
 * Flow no tiene widget: hay que irse a flow.cl. El boton crea la orden en el
 * servidor y recien entonces navega, porque la URL de checkout solo existe
 * despues de que Flow acepta la orden.
 *
 * La navegacion se hace con `window.location` y no con el router de Next: el
 * destino es otro dominio, y el router solo sabe moverse dentro de este.
 */
export function BotonPagarFlow({ token, monto }: Props) {
  const [estado, accion, pendiente] = useActionState<EstadoCobroFlow, FormData>(
    iniciarPagoFlow,
    {},
  );

  useEffect(() => {
    if (estado.url) {
      window.location.href = estado.url;
    }
  }, [estado.url]);

  // Entre que Flow responde y que el navegador cambia de pagina pasa un
  // instante. Sin esto, el boton vuelve a habilitarse y queda clickeable
  // justo cuando ya no debe.
  const yendo = Boolean(estado.url);

  return (
    <div className="flex flex-col gap-3">
      <form action={accion}>
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="btn btn-primario w-full"
          disabled={pendiente || yendo}
        >
          {pendiente || yendo ? (
            <>
              <Loader2 size={18} className="girando" />
              {yendo ? 'Llevándote a Flow…' : 'Preparando el pago…'}
            </>
          ) : (
            <>
              <CreditCard size={18} />
              Pagar {pesos(monto)}
            </>
          )}
        </button>
      </form>

      <p className="text-center text-xs leading-relaxed text-faint">
        Te llevamos a Flow para pagar y vuelves solo. Tu entrada aparece acá apenas se
        confirme el pago.
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
