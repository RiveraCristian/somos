import { z } from 'zod';

import { METODOS_DECLARABLES } from './constantes';
import { normalizarTelefono } from './telefono';

const textoLimpio = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `No puede superar los ${max} caracteres.`);

export const esquemaRegistro = z.object({
  nombre: textoLimpio(200).min(3, 'Escribe tu nombre completo.'),
  correo: textoLimpio(255)
    .email('Ese correo no se ve válido.')
    .transform((v) => v.toLowerCase()),
  // Obligatorio: el telefono es la credencial de invitacion, no un dato de
  // contacto. Se guarda normalizado para que el tope por numero sea confiable.
  telefono: textoLimpio(30)
    .min(1, 'Necesitamos tu teléfono: es lo que usamos para verificar tu invitación.')
    .transform((v, ctx) => {
      const normalizado = normalizarTelefono(v);
      if (!normalizado) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Ese teléfono no se ve válido. Escríbelo como +56 9 1234 5678.',
        });
        return z.NEVER;
      }
      return normalizado;
    }),
  instagram: textoLimpio(80)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v.replace(/^@/, '') : v)),
  mensaje: textoLimpio(500).optional().or(z.literal('')),
  tipoEntradaId: z.coerce.number().int().positive('Elige con qué entrada vas.'),
});

export type DatosRegistro = z.infer<typeof esquemaRegistro>;

export const esquemaPago = z.object({
  monto: z.coerce
    .number({ invalid_type_error: 'Escribe el monto en números.' })
    .int('El monto debe ser un número entero.')
    .positive('El monto tiene que ser mayor que cero.')
    .max(9_999_999, 'Ese monto es demasiado alto.'),
  metodo: z.enum(METODOS_DECLARABLES),
  referencia: textoLimpio(120).optional().or(z.literal('')),
  mensaje: textoLimpio(500).optional().or(z.literal('')),
});

export const esquemaIngreso = z.object({
  correo: textoLimpio(255)
    .email('Ese correo no se ve válido.')
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1, 'Escribe tu contraseña.').max(200),
});

export const esquemaEvento = z.object({
  nombre: textoLimpio(200).min(2, 'El evento necesita un nombre.'),
  lema: textoLimpio(300).optional().or(z.literal('')),
  descripcion: textoLimpio(4000).optional().or(z.literal('')),
  fechaInicio: z.string().optional().or(z.literal('')),
  venue: textoLimpio(200).optional().or(z.literal('')),
  direccion: textoLimpio(300).optional().or(z.literal('')),
  ciudad: textoLimpio(120).min(2, 'Falta la ciudad.'),
  region: textoLimpio(120).optional().or(z.literal('')),
  mapaUrl: textoLimpio(500).optional().or(z.literal('')),
  capacidad: z.coerce.number().int().min(0).max(100_000).optional(),
  estado: z.enum(['borrador', 'publicado', 'cerrado', 'finalizado']),
  instagram: textoLimpio(120).optional().or(z.literal('')),
  tenpoNombre: textoLimpio(200).optional().or(z.literal('')),
  tenpoRut: textoLimpio(20).optional().or(z.literal('')),
  tenpoCorreo: textoLimpio(255).optional().or(z.literal('')),
  tenpoBanco: textoLimpio(120).optional().or(z.literal('')),
  tenpoTipoCuenta: textoLimpio(60).optional().or(z.literal('')),
  tenpoCuenta: textoLimpio(50).optional().or(z.literal('')),
  tenpoQrUrl: textoLimpio(500).optional().or(z.literal('')),
});

/** Devuelve el primer mensaje de error legible de un ZodError. */
export function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Revisa los datos del formulario.';
}
