'use server';

import { revalidatePath } from 'next/cache';

import { guardarComprobante } from '@/lib/archivos';
import { USUARIO_SISTEMA_ID } from '@/lib/constantes';
import { prisma } from '@/lib/prisma';
import { esquemaPago, primerError } from '@/lib/validaciones';

export type EstadoPago = { error?: string; ok?: string };

export async function declararPago(
  _previo: EstadoPago,
  formulario: FormData,
): Promise<EstadoPago> {
  const token = String(formulario.get('token') ?? '');

  const asistente = await prisma.asistente.findFirst({
    where: { asistenteToken: token, isDeleted: false },
    include: { evento: true },
  });

  if (!asistente) {
    return { error: 'No encontramos tu entrada. Revisa el link que te mandamos.' };
  }

  if (asistente.asistenteEstado === 'anulado') {
    return { error: 'Tu entrada está anulada. Escríbenos si crees que es un error.' };
  }

  if (asistente.evento.eventoEstado === 'finalizado') {
    return { error: 'Este evento ya terminó.' };
  }

  const analisis = esquemaPago.safeParse({
    monto: formulario.get('monto'),
    metodo: formulario.get('metodo'),
    referencia: formulario.get('referencia'),
    mensaje: formulario.get('mensaje'),
  });

  if (!analisis.success) {
    return { error: primerError(analisis.error) };
  }

  const datos = analisis.data;
  const archivo = formulario.get('comprobante');
  const hayArchivo = archivo instanceof File && archivo.size > 0;

  // Para transferencias el comprobante es obligatorio: es lo único que nos
  // permite verificar que la plata llegó.
  if (!hayArchivo && datos.metodo !== 'efectivo') {
    return { error: 'Adjunta la captura de la transferencia para poder confirmarla.' };
  }

  // Evita el doble envío por doble clic o por reintento del navegador.
  const duplicado = await prisma.pago.findFirst({
    where: {
      pagoAsistenteId: asistente.asistenteId,
      pagoMonto: datos.monto,
      pagoEstado: 'pendiente',
      isDeleted: false,
      pagoFechaDeclarado: { gte: new Date(Date.now() - 60_000) },
    },
  });

  if (duplicado) {
    return { error: 'Ya registramos ese pago hace un momento. Está en revisión.' };
  }

  let guardado = null;
  if (hayArchivo) {
    try {
      guardado = await guardarComprobante(archivo as File);
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'No pudimos guardar el comprobante.' };
    }
  }

  await prisma.pago.create({
    data: {
      pagoAsistenteId: asistente.asistenteId,
      pagoMonto: datos.monto,
      pagoMetodo: datos.metodo,
      pagoEstado: 'pendiente',
      pagoReferencia: datos.referencia || null,
      pagoMensaje: datos.mensaje || null,
      pagoComprobanteArchivo: guardado?.archivo ?? null,
      pagoComprobanteNombre: guardado?.nombreOriginal ?? null,
      pagoComprobanteMime: guardado?.mime ?? null,
      pagoComprobanteTamano: guardado?.tamano ?? null,
      createdBy: USUARIO_SISTEMA_ID,
    },
  });

  revalidatePath(`/mi-entrada/${token}`);

  return {
    ok: 'Recibimos tu comprobante. Lo revisamos a mano y te mandamos tu entrada por correo apenas quede confirmado.',
  };
}
