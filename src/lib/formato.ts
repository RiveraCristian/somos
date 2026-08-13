import { ZONA_HORARIA } from './constantes';

/** 12000 → "$12.000" */
export function pesos(monto: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(monto ?? 0);
}

/** 12000 → "12.000" (sin simbolo) */
export function numero(valor: number): string {
  return new Intl.NumberFormat('es-CL').format(valor ?? 0);
}

/** "sábado 14 de marzo de 2026" */
export function fechaLarga(fecha: Date | null | undefined): string | null {
  if (!fecha) return null;
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: ZONA_HORARIA,
  }).format(fecha);
}

/** "14 mar 2026, 23:04" */
export function fechaHora(fecha: Date | null | undefined): string | null {
  if (!fecha) return null;
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ZONA_HORARIA,
  }).format(fecha);
}

/** "23:04" */
export function hora(fecha: Date | null | undefined): string | null {
  if (!fecha) return null;
  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ZONA_HORARIA,
  }).format(fecha);
}

/** "hace 4 minutos" */
export function hace(fecha: Date): string {
  const segundos = Math.floor((Date.now() - fecha.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('es-CL', { numeric: 'auto' });

  const tramos: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];

  for (const [unidad, factor] of tramos) {
    if (segundos >= factor) {
      return rtf.format(-Math.floor(segundos / factor), unidad);
    }
  }
  return 'recién';
}

/** Primera letra en mayuscula, respetando acentos. */
export function capitalizar(texto: string): string {
  if (!texto) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Iniciales para el avatar: "Vicente Muñoz" → "VM" */
export function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

/** Normaliza un texto libre a slug: "Zona VIP" → "zona-vip" */
export function aSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Tamano de archivo legible: 248321 → "243 KB" */
export function tamanoArchivo(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
