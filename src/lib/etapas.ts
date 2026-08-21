import { ZONA_HORARIA } from './constantes';
import { prisma } from './prisma';
import { ETAPAS_VITRINA, ETAPA_VIGENTE_VITRINA, MODO_VITRINA } from './vitrina';

/**
 * Etapas de venta: cuanto vale una entrada ahora.
 *
 * El precio no vive en el tipo de entrada sino en la etapa vigente. Las etapas
 * avanzan por cantidad vendida (las primeras 100 valen una cosa, el resto
 * otra), salvo la etapa de puerta, que se activa el mismo dia del evento sin
 * importar cuanto se vendio.
 *
 * Ojo: esto resuelve el precio VIGENTE, el que se le ofrece a quien todavia no
 * compra. Lo que cada asistente debe pagar ya quedo congelado en
 * `asistente_precio` al reservar y no se recalcula nunca.
 */

export type EtapaVigente = {
  etapaId: number;
  nombre: string;
  precio: number;
  /** Cuantas entradas cubre la etapa. null = es la etapa de relleno. */
  cupo: number | null;
  /** Cuantas quedan antes de que suba el precio. null si no tiene tope. */
  restantes: number | null;
  enPuerta: boolean;
  /** Entradas vendidas en el evento, contando todas las etapas. */
  vendidas: number;
};

export type Etapa = {
  etapaId: number;
  nombre: string;
  precio: number;
  cupo: number | null;
  orden: number;
  enPuerta: boolean;
};

/** Fecha civil (YYYY-MM-DD) en la zona del evento, para comparar dias. */
function diaEnChile(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: ZONA_HORARIA,
  }).format(fecha);
}

/** ¿Hoy es el dia del evento? Se compara el dia civil, no el instante. */
export function esDiaDelEvento(fechaEvento: Date | null | undefined, ahora = new Date()): boolean {
  if (!fechaEvento) return false;
  return diaEnChile(fechaEvento) === diaEnChile(ahora);
}

/** Cuantas entradas se han tomado en el evento (reservas incluidas). */
export async function entradasTomadas(eventoId: number): Promise<number> {
  return prisma.asistente.count({
    where: {
      asistenteEventoId: eventoId,
      isDeleted: false,
      asistenteEstado: { not: 'anulado' },
    },
  });
}

/** Todas las etapas activas del evento, en orden. */
export async function listarEtapas(eventoId: number): Promise<Etapa[]> {
  if (MODO_VITRINA) return ETAPAS_VITRINA;

  const filas = await prisma.etapaVenta.findMany({
    where: { etapaEventoId: eventoId, etapaActiva: true },
    orderBy: { etapaOrden: 'asc' },
  });

  return filas.map((e) => ({
    etapaId: e.etapaId,
    nombre: e.etapaNombre,
    precio: e.etapaPrecio,
    cupo: e.etapaCupo,
    orden: e.etapaOrden,
    enPuerta: e.etapaEnPuerta,
  }));
}

/**
 * Resuelve la etapa que corresponde a un estado dado, sin tocar la base.
 *
 * Se separa del acceso a datos para poder razonarla (y probarla) sola: es la
 * regla que decide cuanto paga la gente.
 */
export function resolverEtapa(
  etapas: Etapa[],
  vendidas: number,
  diaDelEvento: boolean,
): EtapaVigente | null {
  if (etapas.length === 0) return null;

  const puerta = etapas.find((e) => e.enPuerta);
  const previas = etapas.filter((e) => !e.enPuerta);

  // El dia del evento manda la etapa de puerta, se haya vendido lo que se haya
  // vendido.
  if (diaDelEvento && puerta) {
    return {
      etapaId: puerta.etapaId,
      nombre: puerta.nombre,
      precio: puerta.precio,
      cupo: null,
      restantes: null,
      enPuerta: true,
      vendidas,
    };
  }

  // Antes del dia del evento, la etapa la decide cuanto se lleva vendido.
  let acumulado = 0;
  for (const etapa of previas) {
    if (etapa.cupo === null) {
      return {
        etapaId: etapa.etapaId,
        nombre: etapa.nombre,
        precio: etapa.precio,
        cupo: null,
        restantes: null,
        enPuerta: false,
        vendidas,
      };
    }

    acumulado += etapa.cupo;
    if (vendidas < acumulado) {
      return {
        etapaId: etapa.etapaId,
        nombre: etapa.nombre,
        precio: etapa.precio,
        cupo: etapa.cupo,
        restantes: acumulado - vendidas,
        enPuerta: false,
        vendidas,
      };
    }
  }

  // Todas las etapas previas tenian tope y se agotaron. Se cae a la ultima
  // conocida antes que dejar el sitio sin precio.
  const ultima = previas[previas.length - 1] ?? puerta;
  if (!ultima) return null;

  return {
    etapaId: ultima.etapaId,
    nombre: ultima.nombre,
    precio: ultima.precio,
    cupo: ultima.cupo,
    restantes: 0,
    enPuerta: ultima.enPuerta,
    vendidas,
  };
}

/** La etapa vigente ahora mismo, consultando la base. */
export async function etapaVigente(
  eventoId: number,
  fechaEvento: Date | null | undefined,
): Promise<EtapaVigente | null> {
  if (MODO_VITRINA) return ETAPA_VIGENTE_VITRINA;

  const [etapas, vendidas] = await Promise.all([listarEtapas(eventoId), entradasTomadas(eventoId)]);
  return resolverEtapa(etapas, vendidas, esDiaDelEvento(fechaEvento));
}
