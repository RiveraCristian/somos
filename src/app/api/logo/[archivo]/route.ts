import { leerLogo } from '@/lib/archivos';

export const dynamic = 'force-dynamic';

/**
 * Sirve el logo de un auspiciador.
 *
 * A diferencia de los comprobantes, esto es publico: el logo se muestra en la
 * portada. Aun asi se sirve desde acá y no desde /public, porque los logos los
 * carga el organizador desde el panel y tienen que aparecer sin un despliegue
 * de por medio.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ archivo: string }> },
) {
  const { archivo } = await params;
  const logo = await leerLogo(archivo);

  if (!logo) {
    return new Response('No encontrado', { status: 404 });
  }

  return new Response(new Uint8Array(logo.contenido), {
    headers: {
      'Content-Type': logo.mime,
      // El nombre del archivo es aleatorio y no se reutiliza: cambiar el logo
      // genera un nombre nuevo, asi que se puede cachear sin miedo.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // Aunque solo se aceptan mapas de bits, el archivo lo sube una persona:
      // si alguna vez entra algo que el navegador quiera interpretar, que no
      // tenga con que.
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
