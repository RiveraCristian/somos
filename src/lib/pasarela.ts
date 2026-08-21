import { fintocHabilitado, verificarCredencialesFintoc } from './fintoc';
import { mercadoPagoHabilitado, verificarCredencialesMp } from './mercadopago';

export const PASARELAS = ['fintoc', 'mercadopago'] as const;
export type Pasarela = (typeof PASARELAS)[number];

export const ETIQUETAS_PASARELA: Record<Pasarela, string> = {
  fintoc: 'Fintoc',
  mercadopago: 'Mercado Pago',
};

/**
 * Cual de las dos pasarelas esta activa.
 *
 * La elige la variable PASARELA del entorno. Si no esta puesta, o la elegida no
 * tiene sus credenciales cargadas, devuelve null y el sitio se queda con el
 * flujo manual de transferencia + comprobante, que siempre funciona.
 *
 * Se evita "la primera que tenga credenciales" a proposito: dejar que el cobro
 * dependa de que variables quedaron cargadas es una forma facil de cobrar por
 * donde no correspondia.
 */
export function pasarelaActiva(): Pasarela | null {
  const elegida = (process.env.PASARELA ?? '').trim().toLowerCase();

  if (elegida === 'fintoc') {
    return fintocHabilitado() ? 'fintoc' : null;
  }

  if (elegida === 'mercadopago') {
    return mercadoPagoHabilitado() ? 'mercadopago' : null;
  }

  return null;
}

/** Diagnostico para el panel: que falta para que el cobro en linea funcione. */
export function estadoPasarela(): {
  elegida: string | null;
  activa: Pasarela | null;
  problema: string | null;
} {
  const elegida = (process.env.PASARELA ?? '').trim().toLowerCase() || null;
  const activa = pasarelaActiva();

  if (!elegida) {
    return {
      elegida: null,
      activa: null,
      problema: 'No hay pasarela elegida. Define PASARELA en el .env.',
    };
  }

  if (!PASARELAS.includes(elegida as Pasarela)) {
    return {
      elegida,
      activa: null,
      problema: `"${elegida}" no es una pasarela valida. Usa fintoc o mercadopago.`,
    };
  }

  if (!activa) {
    return {
      elegida,
      activa: null,
      problema:
        elegida === 'fintoc'
          ? 'Faltan FINTOC_SECRET_KEY o FINTOC_PUBLIC_KEY.'
          : 'Faltan MERCADOPAGO_ACCESS_TOKEN o MERCADOPAGO_PUBLIC_KEY.',
    };
  }

  return { elegida, activa, problema: null };
}

/**
 * Diagnostico con verificacion real contra la pasarela.
 *
 * A diferencia de `estadoPasarela`, este sale a la red: sirve para el panel,
 * donde lo util no es saber que hay variables cargadas sino si el cobro
 * realmente va a funcionar.
 */
export async function diagnosticoPasarela(): Promise<{
  elegida: string | null;
  activa: Pasarela | null;
  problema: string | null;
  detalle: string | null;
}> {
  const base = estadoPasarela();

  if (!base.activa) {
    return { ...base, detalle: null };
  }

  if (base.activa === 'mercadopago') {
    const check = await verificarCredencialesMp();
    return check.ok
      ? {
          ...base,
          problema: null,
          detalle: `Conectado a ${check.cuenta} · credenciales de ${check.modo}`,
        }
      : { ...base, activa: null, problema: check.problema, detalle: null };
  }

  const check = verificarCredencialesFintoc();
  return check.ok
    ? {
        ...base,
        problema: null,
        detalle: `Credenciales de ${check.modo}. Se comprueban contra Fintoc al primer cobro.`,
      }
    : { ...base, activa: null, problema: check.problema, detalle: null };
}
