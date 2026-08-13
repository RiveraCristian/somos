import { leerComprobante } from '@/lib/archivos';
import { obtenerUsuarioActual } from '@/lib/auth';
import { ROLES_ADMIN } from '@/lib/constantes';

export const dynamic = 'force-dynamic';

/**
 * Sirve un comprobante de transferencia.
 * Los comprobantes son datos sensibles de terceros: nunca se exponen en
 * /public, solo pasan por acá y solo para el equipo de administración.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ archivo: string }> },
) {
  const usuario = await obtenerUsuarioActual();

  if (!usuario || !ROLES_ADMIN.includes(usuario.usuarioRol)) {
    return new Response('No autorizado', { status: 401 });
  }

  const { archivo } = await params;
  const documento = await leerComprobante(archivo);

  if (!documento) {
    return new Response('No encontrado', { status: 404 });
  }

  return new Response(new Uint8Array(documento.contenido), {
    headers: {
      'Content-Type': documento.mime,
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
