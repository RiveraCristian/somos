import { ZONA_HORARIA } from './constantes';

/**
 * Convierte lo que escribe el organizador en un <input type="datetime-local">
 * a un Date en UTC, interpretando el texto como hora de Chile.
 *
 * El servidor puede estar en cualquier zona (en Docker suele ser UTC), asi que
 * no se puede usar `new Date("2026-03-14T23:00")` a secas: eso lo leeria en la
 * zona del proceso y correria la hora del evento.
 */
export function desdeFechaLocal(texto: string | null | undefined): Date | null {
  if (!texto) return null;

  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(texto.trim());
  if (!coincidencia) return null;

  const [, anio, mes, dia, hora, minuto] = coincidencia.map(Number) as unknown as number[];

  // Primer intento: tratar los componentes como si fueran UTC.
  const tentativa = Date.UTC(anio, mes - 1, dia, hora, minuto);

  // Se mide cuanto se corre esa marca al leerla en Chile y se compensa.
  const formateador = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const partes = Object.fromEntries(
    formateador.formatToParts(new Date(tentativa)).map((p) => [p.type, p.value]),
  );

  const leidoEnChile = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    // Intl entrega "24" para la medianoche en algunos entornos.
    Number(partes.hour) % 24,
    Number(partes.minute),
    Number(partes.second),
  );

  const desfase = leidoEnChile - tentativa;
  const fecha = new Date(tentativa - desfase);

  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Formatea un Date para precargar un <input type="datetime-local"> en hora de Chile. */
export function aValorInputFecha(fecha: Date | null | undefined): string {
  if (!fecha) return '';

  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA_HORARIA,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(fecha)
      .map((p) => [p.type, p.value]),
  );

  const hora = String(Number(partes.hour) % 24).padStart(2, '0');
  return `${partes.year}-${partes.month}-${partes.day}T${hora}:${partes.minute}`;
}
