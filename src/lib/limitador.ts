/**
 * Limite de solicitudes por ventana de tiempo, en memoria.
 *
 * Sirve porque la app corre en un solo proceso (el droplet). Si algun dia
 * corre replicada, cada replica tendria su propio conteo y el limite real se
 * multiplicaria: ahi hay que moverlo a la base o a un Redis.
 */

const ventanas = new Map<string, number[]>();

/**
 * ¿Puede pasar una solicitud mas con esta clave? Si puede, la cuenta.
 *
 * Ventana deslizante: se guardan las marcas de tiempo de las ultimas
 * solicitudes y se descartan las que quedaron fuera.
 */
export function permitir(clave: string, maximo: number, ventanaMs: number): boolean {
  const ahora = Date.now();
  const recientes = (ventanas.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);

  if (recientes.length >= maximo) {
    ventanas.set(clave, recientes);
    return false;
  }

  recientes.push(ahora);
  ventanas.set(clave, recientes);

  // Poda ocasional para que el mapa no crezca sin fin con claves viejas.
  if (ventanas.size > 5_000) {
    for (const [k, marcas] of ventanas) {
      if (marcas.every((t) => ahora - t >= ventanaMs)) ventanas.delete(k);
    }
  }

  return true;
}

/**
 * IP del cliente detras de nginx.
 *
 * nginx agrega la IP real AL FINAL de X-Forwarded-For
 * (`$proxy_add_x_forwarded_for`). Lo que viene antes lo escribio el cliente y
 * se puede inventar, asi que para limitar se usa el ultimo valor.
 */
export function ipDelCliente(cabeceras: Headers): string {
  const cadena = (cabeceras.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim());
  return cadena.filter(Boolean).at(-1) ?? 'local';
}
