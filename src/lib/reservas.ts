import type { Prisma } from '@prisma/client';

/**
 * Cuanto vive una reserva sin pagar.
 *
 * Reservar no es comprar: deja el cupo tomado sin que haya entrado un peso.
 * Como el precio sube por tandas segun cuantas entradas se llevan tomadas, una
 * reserva abandonada se come un cupo barato para siempre y empuja el precio
 * hacia arriba sin que nadie haya pagado. Lo mismo con el cupo por telefono:
 * la persona queda bloqueada para volver a intentarlo.
 *
 * Pasada esta hora la reserva deja de ocupar lugar. Nada se borra: la fila
 * sigue ahi y el panel la ve. Lo que cambia es que ya no cuenta.
 *
 * Una hora y no mas, porque es exactamente lo que dura el link de pago de
 * Mercado Pago (VIGENCIA_PREFERENCIA_MS). Los dos plazos corren juntos desde
 * que se reserva, asi que cuando la reserva suelta el cupo, el link con el que
 * podria haberse pagado ya estaba muerto. No hay una ventana donde alguien
 * pague algo que el sitio ya le dio a otro.
 */
export const VIGENCIA_RESERVA_MS = 60 * 60 * 1000;

/** Reservas creadas despues de este instante siguen vivas. */
export function limiteDeReserva(ahora: Date = new Date()): Date {
  return new Date(ahora.getTime() - VIGENCIA_RESERVA_MS);
}

/**
 * La condicion de "esta reserva todavia ocupa un cupo".
 *
 * Vive en un solo lugar a proposito. El cupo se cuenta en varios puntos —la
 * tanda vigente, el tope por telefono, el cupo del tipo de entrada— y si cada
 * uno llevara su propia version de la regla, bastaria con olvidar uno para
 * que el sitio dijera que quedan cupos en una pantalla y que no en la otra.
 *
 * Solo caduca lo que esta `pendiente`. Una entrada confirmada ocupa su lugar
 * para siempre, que para eso se pago.
 */
export function reservaOcupaCupo(ahora: Date = new Date()): Prisma.AsistenteWhereInput {
  return {
    isDeleted: false,
    asistenteEstado: { not: 'anulado' },
    OR: [
      { asistenteEstado: { not: 'pendiente' } },
      { createdAt: { gt: limiteDeReserva(ahora) } },
    ],
  };
}

/**
 * ¿Esta reserva ya solto el cupo?
 *
 * Para decidirlo con una fila que ya se leyo, sin volver a la base.
 */
export function reservaVencida(
  asistente: { asistenteEstado: string; createdAt: Date },
  ahora: Date = new Date(),
): boolean {
  if (asistente.asistenteEstado !== 'pendiente') return false;
  return asistente.createdAt.getTime() <= limiteDeReserva(ahora).getTime();
}
