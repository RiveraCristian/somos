import { prisma } from './prisma';

/**
 * Lista de invitados.
 *
 * SOMOS no se vende al publico: compra quien esta en la lista. La llave es el
 * telefono, ya normalizado (ver `telefono.ts`), y cada numero trae su propio
 * cupo de entradas — dos por defecto.
 *
 * El cupo se cuenta sobre asistentes, no sobre entradas emitidas: una reserva
 * sin pagar tambien ocupa lugar, si no cualquiera podria reservar sin limite.
 */

export type Invitacion =
  | {
      permitido: true;
      invitadoId: number;
      nombre: string | null;
      cupo: number;
      usadas: number;
      restantes: number;
    }
  | { permitido: false; motivo: string };

/** Mensaje unico para quien no esta en la lista. */
const FUERA_DE_LISTA =
  'Ese número no está en la lista de invitados. SOMOS es una fiesta privada: ' +
  'si crees que debería estar, escríbenos por Instagram.';

/**
 * ¿Este numero puede sacar una entrada mas?
 *
 * `telefono` tiene que venir ya normalizado a +56XXXXXXXXX. Se pasa normalizado
 * a proposito: si esta funcion normalizara por su cuenta, seria facil llamarla
 * con un formato y guardar el asistente con otro, y el conteo dejaria de calzar.
 */
export async function verificarInvitacion(
  eventoId: number,
  telefono: string,
): Promise<Invitacion> {
  const invitado = await prisma.invitado.findFirst({
    where: {
      invitadoEventoId: eventoId,
      invitadoTelefono: telefono,
      invitadoActivo: true,
      isDeleted: false,
    },
  });

  if (!invitado) {
    return { permitido: false, motivo: FUERA_DE_LISTA };
  }

  const usadas = await contarEntradasDelNumero(eventoId, telefono);

  if (usadas >= invitado.invitadoCupo) {
    return {
      permitido: false,
      motivo:
        invitado.invitadoCupo === 1
          ? 'Ese número ya tiene su entrada. Es una por persona.'
          : `Ese número ya usó sus ${invitado.invitadoCupo} entradas. ` +
            'Si necesitas una más, escríbenos por Instagram.',
    };
  }

  return {
    permitido: true,
    invitadoId: invitado.invitadoId,
    nombre: invitado.invitadoNombre,
    cupo: invitado.invitadoCupo,
    usadas,
    restantes: invitado.invitadoCupo - usadas,
  };
}

/** Cuantas entradas lleva tomadas un numero en este evento. */
export async function contarEntradasDelNumero(
  eventoId: number,
  telefono: string,
): Promise<number> {
  return prisma.asistente.count({
    where: {
      asistenteEventoId: eventoId,
      asistenteTelefono: telefono,
      isDeleted: false,
      asistenteEstado: { not: 'anulado' },
    },
  });
}
