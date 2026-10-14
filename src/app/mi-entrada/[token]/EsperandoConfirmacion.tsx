'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { verificarPagoEnLinea } from './acciones';

/**
 * Al volver de Mercado Pago el webhook puede tardar unos segundos. Mientras
 * tanto se le pregunta al servidor —que le pregunta a Mercado Pago— cada pocos
 * segundos, y apenas el cobro se confirma se recarga la pagina.
 *
 * No muestra nada: el aviso lo pone la pagina, con el estado real del backend.
 */
export function EsperandoConfirmacion({ token }: { token: string }) {
  const router = useRouter();

  useEffect(() => {
    let vueltas = 0;

    const reloj = setInterval(async () => {
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
      // Un minuto alcanza para la gran mayoria. Despues se refresca una vez
      // para mostrar el estado que haya (rechazado, en proceso) y se deja.
      if (vueltas >= 20) {
        clearInterval(reloj);
        router.refresh();
      }
    }, 3000);

    return () => clearInterval(reloj);
  }, [router, token]);

  return null;
}
