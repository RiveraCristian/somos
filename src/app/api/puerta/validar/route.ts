import { headers } from 'next/headers';

import { obtenerUsuarioActual } from '@/lib/auth';
import { esCodigoLegible, normalizarLectura } from '@/lib/codigos';
import { ROLES_PUERTA, type ResultadoEscaneo } from '@/lib/constantes';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Respuesta = {
  resultado: ResultadoEscaneo;
  titulo: string;
  detalle: string;
  persona?: string;
  tipoEntrada?: string;
  codigo?: string;
};

/**
 * Valida una entrada en la puerta y la quema en el mismo paso.
 *
 * La quema se hace con un UPDATE condicional (`entradaEstado: 'valida'`) en vez
 * de leer-y-después-escribir: si dos teléfonos escanean el mismo QR al mismo
 * tiempo, solo uno de los dos updates afecta una fila y el otro recibe
 * "ya fue usada". Sin eso, ambos pasarían.
 */
export async function POST(peticion: Request) {
  const usuario = await obtenerUsuarioActual();

  if (!usuario || !ROLES_PUERTA.includes(usuario.usuarioRol)) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  let cuerpo: { codigo?: string };
  try {
    cuerpo = await peticion.json();
  } catch {
    return Response.json({ error: 'Petición inválida' }, { status: 400 });
  }

  const lectura = normalizarLectura(String(cuerpo.codigo ?? ''));

  if (!lectura || lectura.length > 200) {
    return Response.json({ error: 'Código vacío' }, { status: 400 });
  }

  const cabeceras = await headers();
  const ip = (cabeceras.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
  const agente = cabeceras.get('user-agent')?.slice(0, 300) ?? null;

  async function registrar(resultado: ResultadoEscaneo, entradaId: number | null) {
    await prisma.escaneo.create({
      data: {
        escaneoEntradaId: entradaId,
        escaneoCodigo: lectura.slice(0, 120),
        escaneoResultado: resultado,
        escaneoUsuarioId: usuario!.usuarioId,
        escaneoIp: ip,
        escaneoUserAgent: agente,
      },
    });
  }

  // El QR trae el token; la puerta también acepta el código tipeado a mano.
  const entrada = await prisma.entrada.findFirst({
    where: {
      isDeleted: false,
      OR: [
        { entradaToken: lectura },
        ...(esCodigoLegible(lectura) ? [{ entradaCodigo: lectura.toUpperCase() }] : []),
      ],
    },
    include: { asistente: true, tipoEntrada: true },
  });

  if (!entrada) {
    await registrar('no_existe', null);
    return Response.json({
      resultado: 'no_existe',
      titulo: 'No existe',
      detalle: 'Ese código no corresponde a ninguna entrada.',
    } satisfies Respuesta);
  }

  if (entrada.entradaEstado === 'anulada') {
    await registrar('anulada', entrada.entradaId);
    return Response.json({
      resultado: 'anulada',
      titulo: 'Entrada anulada',
      detalle: 'Esta entrada fue anulada por producción.',
      persona: entrada.asistente.asistenteNombre,
      tipoEntrada: entrada.tipoEntrada.tipoEntradaNombre,
      codigo: entrada.entradaCodigo,
    } satisfies Respuesta);
  }

  const quemadas = await prisma.entrada.updateMany({
    where: { entradaId: entrada.entradaId, entradaEstado: 'valida', isDeleted: false },
    data: {
      entradaEstado: 'quemada',
      entradaFechaQuemada: new Date(),
      entradaQuemadaPor: usuario.usuarioId,
      modifiedBy: usuario.usuarioId,
    },
  });

  if (quemadas.count === 0) {
    // Alguien más la quemó: puede ser el otro lector, o la misma persona
    // intentando entrar dos veces.
    const actual = await prisma.entrada.findUnique({
      where: { entradaId: entrada.entradaId },
      select: { entradaFechaQuemada: true },
    });

    await registrar('ya_usada', entrada.entradaId);

    return Response.json({
      resultado: 'ya_usada',
      titulo: 'Ya fue usada',
      detalle: actual?.entradaFechaQuemada
        ? `Esta entrada se quemó a las ${new Intl.DateTimeFormat('es-CL', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Santiago',
          }).format(actual.entradaFechaQuemada)}.`
        : 'Esta entrada ya había sido usada.',
      persona: entrada.asistente.asistenteNombre,
      tipoEntrada: entrada.tipoEntrada.tipoEntradaNombre,
      codigo: entrada.entradaCodigo,
    } satisfies Respuesta);
  }

  await registrar('autorizado', entrada.entradaId);

  return Response.json({
    resultado: 'autorizado',
    titulo: 'Adelante',
    detalle: 'Entrada válida, recién quemada.',
    persona: entrada.asistente.asistenteNombre,
    tipoEntrada: entrada.tipoEntrada.tipoEntradaNombre,
    codigo: entrada.entradaCodigo,
  } satisfies Respuesta);
}
