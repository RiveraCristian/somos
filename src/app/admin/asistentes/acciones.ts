'use server';

import { revalidatePath } from 'next/cache';

import { guardarComprobante } from '@/lib/archivos';
import { requerirUsuario } from '@/lib/auth';
import { ROLES_ADMIN } from '@/lib/constantes';
import { confirmarPagoYEmitir } from '@/lib/emision';
import { prisma } from '@/lib/prisma';
import { esquemaPagoManual, primerError } from '@/lib/validaciones';

export type EstadoPagoManual = { error?: string; ok?: string };

/**
 * Registra a mano un pago que llego por fuera y emite la entrada.
 *
 * El sitio cobra solo con la pasarela: quien compra no tiene forma de declarar
 * una transferencia. Esta es la valvula de escape para los casos que se salen
 * del camino — pago en efectivo, un banco que la pasarela no cubre, alguien que
 * te transfirio directo. Sin esto no habria manera de darle su entrada a esa
 * persona salvo tocando la base de datos.
 *
 * Queda registrado como pago manual, con quien lo confirmo y cuando, para que
 * la caja siga cuadrando con lo que dice el panel.
 */
export async function registrarPagoManual(
  _previo: EstadoPagoManual,
  formulario: FormData,
): Promise<EstadoPagoManual> {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin/asistentes');

  const asistenteId = Number(formulario.get('asistenteId'));

  const asistente = await prisma.asistente.findFirst({
    where: { asistenteId, isDeleted: false },
    include: { evento: true, entrada: true },
  });

  if (!asistente) return { error: 'Ese asistente ya no existe.' };
  if (asistente.asistenteEstado === 'anulado') {
    return { error: 'Esa entrada está anulada. Reactívala antes de registrarle un pago.' };
  }
  if (asistente.entrada) {
    return { error: `${asistente.asistenteNombre} ya tiene su entrada emitida.` };
  }

  const analisis = esquemaPagoManual.safeParse({
    monto: formulario.get('monto'),
    metodo: formulario.get('metodo'),
    referencia: formulario.get('referencia'),
    mensaje: formulario.get('mensaje'),
  });

  if (!analisis.success) return { error: primerError(analisis.error) };

  const datos = analisis.data;

  // El comprobante es opcional: si te pagaron en efectivo no hay ninguno. Pero
  // cuando existe conviene guardarlo, porque es el respaldo de por que alguien
  // marco esto como pagado sin que pasara por la pasarela.
  const archivo = formulario.get('comprobante');
  let guardado = null;

  if (archivo instanceof File && archivo.size > 0) {
    try {
      guardado = await guardarComprobante(archivo);
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'No se pudo guardar el comprobante.' };
    }
  }

  const pago = await prisma.pago.create({
    data: {
      pagoAsistenteId: asistente.asistenteId,
      pagoMonto: datos.monto,
      pagoMetodo: datos.metodo,
      pagoProveedor: 'manual',
      pagoReferencia: datos.referencia || null,
      pagoMensaje: datos.mensaje || null,
      ...(guardado
        ? {
            pagoComprobanteArchivo: guardado.archivo,
            pagoComprobanteMime: guardado.mime,
            pagoComprobanteTamano: guardado.tamano,
          }
        : {}),
      createdBy: usuario.usuarioId,
    },
  });

  // Se confirma en el mismo acto: quien registra el pago a mano ya vio la plata.
  // Es la misma funcion que usan los webhooks, asi que la entrada se emite y se
  // manda por correo exactamente igual que en un cobro automatico.
  const resultado = await confirmarPagoYEmitir(pago.pagoId, usuario.usuarioId);

  revalidatePath('/admin/asistentes');
  revalidatePath('/admin/pagos');
  revalidatePath('/admin');

  return {
    ok: resultado.codigo
      ? `Pago registrado y entrada ${resultado.codigo} emitida.`
      : 'Pago registrado.',
  };
}
