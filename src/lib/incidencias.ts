import { USUARIO_SISTEMA_ID } from './constantes';
import { prisma } from './prisma';

/**
 * Incidencias de cobro: lo que el sistema detecta pero no debe resolver solo.
 *
 * Devolver plata, anular una entrada ya usada o decidir que hacer con un pago
 * que llego para una reserva anulada son decisiones de una persona. Aca solo se
 * dejan anotadas, con el id del cobro en la pasarela para ir directo a el.
 */

export const TIPOS_INCIDENCIA = [
  'pago_duplicado',
  'monto_no_coincide',
  'moneda_no_coincide',
  'reembolso_parcial',
  'reembolso',
  'reembolso_entrada_usada',
  'contracargo',
  'pago_en_reserva_anulada',
] as const;
export type TipoIncidencia = (typeof TIPOS_INCIDENCIA)[number];

export const ETIQUETAS_INCIDENCIA: Record<TipoIncidencia, string> = {
  pago_duplicado: 'Pago doble',
  monto_no_coincide: 'Monto distinto',
  moneda_no_coincide: 'Moneda distinta',
  reembolso_parcial: 'Devolución parcial',
  reembolso: 'Pago devuelto',
  reembolso_entrada_usada: 'Devuelto con entrada usada',
  contracargo: 'Contracargo',
  pago_en_reserva_anulada: 'Pago en reserva anulada',
};

/**
 * Anota una incidencia, una sola vez por hecho.
 *
 * El webhook puede llegar repetido y la conciliacion corre en cada visita a la
 * pagina privada: sin la llave unica, el mismo pago doble apareceria diez
 * veces. La llave es tipo + cobro (o tipo + intento si no hay cobro).
 */
export async function registrarIncidencia(datos: {
  tipo: TipoIncidencia;
  asistenteId: number;
  pagoId: number | null;
  externoPago: string | null;
  monto: number | null;
  detalle: string;
}): Promise<void> {
  const llave = `${datos.tipo}:${datos.externoPago ?? `pago-${datos.pagoId ?? 'sin'}`}`;

  try {
    await prisma.incidenciaPago.create({
      data: {
        incidenciaAsistenteId: datos.asistenteId,
        incidenciaPagoId: datos.pagoId,
        incidenciaTipo: datos.tipo,
        incidenciaExternoPago: datos.externoPago,
        incidenciaMonto: datos.monto === null ? null : Math.round(datos.monto),
        incidenciaDetalle: datos.detalle.slice(0, 500),
        incidenciaLlave: llave.slice(0, 200),
        createdBy: USUARIO_SISTEMA_ID,
      },
    });
    console.warn(`[incidencia] ${datos.tipo} · asistente ${datos.asistenteId} · ${datos.detalle}`);
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') return;
    throw e;
  }
}
