'use server';

import { redirect } from 'next/navigation';

import { generarToken } from '@/lib/codigos';
import { USUARIO_SISTEMA_ID } from '@/lib/constantes';
import { enviarCorreo, plantillaRegistro } from '@/lib/correo';
import { etapaVigente } from '@/lib/etapas';
import { verificarInvitacion } from '@/lib/invitados';
import { prisma } from '@/lib/prisma';
import { esquemaRegistro, primerError } from '@/lib/validaciones';

export type EstadoCompra = { error?: string; aviso?: string };

function urlPrivada(token: string): string {
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/mi-entrada/${token}`;
}

/**
 * Reserva una entrada a nombre de quien compra.
 * Todavía no está pagada: eso ocurre cuando sube el comprobante y producción
 * lo confirma.
 */
export async function reservarEntrada(
  _previo: EstadoCompra,
  formulario: FormData,
): Promise<EstadoCompra> {
  const analisis = esquemaRegistro.safeParse({
    nombre: formulario.get('nombre'),
    correo: formulario.get('correo'),
    telefono: formulario.get('telefono'),
    instagram: formulario.get('instagram'),
    mensaje: formulario.get('mensaje'),
    tipoEntradaId: formulario.get('tipoEntradaId'),
  });

  if (!analisis.success) {
    return { error: primerError(analisis.error) };
  }

  const datos = analisis.data;

  const evento = await prisma.evento.findFirst({
    where: { isDeleted: false, eventoEstado: 'publicado' },
    orderBy: { createdAt: 'desc' },
  });

  if (!evento) {
    return { error: 'Las entradas todavía no están a la venta.' };
  }

  const tipo = await prisma.tipoEntrada.findFirst({
    where: {
      tipoEntradaId: datos.tipoEntradaId,
      tipoEntradaEventoId: evento.eventoId,
      tipoEntradaActivo: true,
    },
  });

  if (!tipo) {
    return { error: 'Esa entrada ya no está disponible. Elige otra.' };
  }

  // ---------------------------------------------------------------------
  // Puerta de entrada: la lista de invitados.
  //
  // Se revisa antes que nada porque es la regla que define el producto: SOMOS
  // es privada. El telefono ya viene normalizado desde el esquema.
  // ---------------------------------------------------------------------
  const invitacion = await verificarInvitacion(evento.eventoId, datos.telefono);

  if (!invitacion.permitido) {
    return { error: invitacion.motivo };
  }

  // ¿Ya había comprado con ese correo?
  const existente = await prisma.asistente.findFirst({
    where: {
      asistenteEventoId: evento.eventoId,
      asistenteCorreo: datos.correo,
      isDeleted: false,
    },
    include: { tipoEntrada: true },
  });

  if (existente) {
    // No se devuelve el link en pantalla: se manda al correo, que es de quien
    // dice ser el dueño. Así nadie llega a la página privada de otro tanteando
    // correos.
    await enviarCorreo({
      para: existente.asistenteCorreo,
      asunto: `Tu entrada para ${evento.eventoNombre}`,
      html: plantillaRegistro({
        nombre: existente.asistenteNombre,
        evento: evento.eventoNombre,
        tipoEntrada: existente.tipoEntrada.tipoEntradaNombre,
        precio: existente.asistentePrecio,
        url: urlPrivada(existente.asistenteToken),
      }),
    });

    return {
      aviso: 'Ese correo ya tiene una entrada. Te reenviamos el link privado — revisa tu bandeja.',
    };
  }

  // Control de cupo del tipo elegido.
  if (tipo.tipoEntradaCupo !== null) {
    const tomadas = await prisma.asistente.count({
      where: {
        asistenteTipoEntradaId: tipo.tipoEntradaId,
        isDeleted: false,
        asistenteEstado: { not: 'anulado' },
      },
    });

    if (tomadas >= tipo.tipoEntradaCupo) {
      return { error: `Se agotaron las entradas ${tipo.tipoEntradaNombre}. Prueba con otra.` };
    }
  }

  // El precio sale de la etapa vigente y se congela en el asistente: si mañana
  // sube la etapa, esta persona sigue debiendo lo que se le cobro hoy.
  const etapa = await etapaVigente(evento.eventoId, evento.eventoFechaInicio);

  if (!etapa) {
    return { error: 'Las entradas todavía no tienen precio configurado. Escríbenos por Instagram.' };
  }

  const token = generarToken(24);

  await prisma.asistente.create({
    data: {
      asistenteEventoId: evento.eventoId,
      asistenteTipoEntradaId: tipo.tipoEntradaId,
      asistenteNombre: datos.nombre,
      asistenteCorreo: datos.correo,
      asistenteTelefono: datos.telefono,
      asistenteInstagram: datos.instagram || null,
      asistenteMensaje: datos.mensaje || null,
      asistenteToken: token,
      asistentePrecio: etapa.precio,
      asistenteEtapaId: etapa.etapaId,
      createdBy: USUARIO_SISTEMA_ID,
    },
  });

  await enviarCorreo({
    para: datos.correo,
    asunto: `Tu entrada para ${evento.eventoNombre}`,
    html: plantillaRegistro({
      nombre: datos.nombre,
      evento: evento.eventoNombre,
      tipoEntrada: tipo.tipoEntradaNombre,
      precio: etapa.precio,
      url: urlPrivada(token),
    }),
  });

  // Fuera de cualquier try/catch: redirect() funciona lanzando una excepción
  // que Next intercepta.
  redirect(`/mi-entrada/${token}`);
}

/** Reenvía el link privado al correo indicado, sin confirmar si existe o no. */
export async function reenviarLink(
  _previo: { aviso?: string; error?: string },
  formulario: FormData,
): Promise<{ aviso?: string; error?: string }> {
  const correo = String(formulario.get('correo') ?? '')
    .trim()
    .toLowerCase();

  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return { error: 'Escribe un correo válido.' };
  }

  const asistente = await prisma.asistente.findFirst({
    where: { asistenteCorreo: correo, isDeleted: false },
    include: { evento: true, tipoEntrada: true },
  });

  if (asistente) {
    await enviarCorreo({
      para: asistente.asistenteCorreo,
      asunto: `Tu entrada para ${asistente.evento.eventoNombre}`,
      html: plantillaRegistro({
        nombre: asistente.asistenteNombre,
        evento: asistente.evento.eventoNombre,
        tipoEntrada: asistente.tipoEntrada.tipoEntradaNombre,
        precio: asistente.asistentePrecio,
        url: urlPrivada(asistente.asistenteToken),
      }),
    });
  }

  // Misma respuesta exista o no: así el formulario no sirve para averiguar
  // quién compró.
  return {
    aviso: 'Si ese correo tiene una entrada, te acabamos de mandar el link privado.',
  };
}
