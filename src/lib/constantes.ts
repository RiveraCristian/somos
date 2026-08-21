/**
 * Dominios controlados de la base de datos.
 * Estos valores estan replicados como CHECK constraints en la migracion
 * 0001_init: si se agrega uno aca, hay que agregarlo tambien alla.
 */

/** Usuario tecnico autor de todo lo que nace en el sitio publico. */
export const USUARIO_SISTEMA_ID = 1;

export const ROLES = ['Admin', 'DataOwner', 'Steward', 'Analyst', 'Viewer'] as const;
export type Rol = (typeof ROLES)[number];

/** Roles que pueden entrar al panel de administracion. */
export const ROLES_ADMIN: Rol[] = ['Admin', 'DataOwner'];

/** Roles que pueden validar entradas en la puerta. */
export const ROLES_PUERTA: Rol[] = ['Admin', 'DataOwner', 'Steward'];

export const ESTADOS_EVENTO = ['borrador', 'publicado', 'cerrado', 'finalizado'] as const;
export type EstadoEvento = (typeof ESTADOS_EVENTO)[number];

export const ESTADOS_ASISTENTE = ['pendiente', 'confirmado', 'anulado'] as const;
export type EstadoAsistente = (typeof ESTADOS_ASISTENTE)[number];

export const ESTADOS_PAGO = ['pendiente', 'confirmado', 'rechazado'] as const;
export type EstadoPago = (typeof ESTADOS_PAGO)[number];

export const METODOS_PAGO = [
  'tenpo',
  'transferencia',
  'efectivo',
  'fintoc',
  'mercadopago',
  'otro',
] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

/** Los de pasarela no se ofrecen en el formulario manual: los pone el cobro en linea. */
export const METODOS_DECLARABLES = ['tenpo', 'transferencia', 'efectivo', 'otro'] as const;

export const ETIQUETAS_METODO: Record<MetodoPago, string> = {
  tenpo: 'Tenpo',
  transferencia: 'Transferencia bancaria',
  efectivo: 'Efectivo',
  fintoc: 'Transferencia en línea',
  mercadopago: 'Tarjeta (Mercado Pago)',
  otro: 'Otro',
};

/** Quien confirma el pago: una persona o el webhook de la pasarela. */
export const PROVEEDORES_PAGO = ['manual', 'fintoc', 'mercadopago'] as const;
export type ProveedorPago = (typeof PROVEEDORES_PAGO)[number];

export const ESTADOS_ENTRADA = ['valida', 'quemada', 'anulada'] as const;
export type EstadoEntrada = (typeof ESTADOS_ENTRADA)[number];

export const RESULTADOS_ESCANEO = ['autorizado', 'ya_usada', 'no_existe', 'anulada'] as const;
export type ResultadoEscaneo = (typeof RESULTADOS_ESCANEO)[number];

export const COLORES_TIPO = ['cyan', 'magenta', 'violeta', 'lima'] as const;
export type ColorTipo = (typeof COLORES_TIPO)[number];

/** Traduccion de cada color de tipo de entrada a valores concretos del tema. */
export const PALETA_TIPO: Record<ColorTipo, { hex: string; borde: string; fondo: string; texto: string }> = {
  cyan: {
    hex: '#00F0FF',
    borde: 'rgba(0, 240, 255, 0.45)',
    fondo: 'rgba(0, 240, 255, 0.07)',
    texto: '#00F0FF',
  },
  violeta: {
    hex: '#7B5CFF',
    borde: 'rgba(123, 92, 255, 0.45)',
    fondo: 'rgba(123, 92, 255, 0.08)',
    texto: '#9E86FF',
  },
  magenta: {
    hex: '#FF2E9A',
    borde: 'rgba(255, 46, 154, 0.45)',
    fondo: 'rgba(255, 46, 154, 0.07)',
    texto: '#FF2E9A',
  },
  lima: {
    hex: '#B6FF3C',
    borde: 'rgba(182, 255, 60, 0.45)',
    fondo: 'rgba(182, 255, 60, 0.07)',
    texto: '#B6FF3C',
  },
};

export function paletaDeTipo(color: string | null | undefined) {
  return PALETA_TIPO[(color ?? '') as ColorTipo] ?? PALETA_TIPO.cyan;
}

/** Tipos de archivo aceptados como comprobante de transferencia. */
export const MIMES_COMPROBANTE = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] as const;

export const ZONA_HORARIA = 'America/Santiago';
