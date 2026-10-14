import { leerFoto } from '@/lib/archivos';

export const dynamic = 'force-dynamic';

/**
 * Sirve una foto de la galeria.
 *
 * Publica, como los logos: estas fotos estan para que las vea cualquiera que
 * entre al sitio. Se sirven desde acá y no desde /public porque las carga el
 * organizador desde el panel y tienen que aparecer sin un despliegue de por
 * medio.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ archivo: string }> },
) {
  const { archivo } = await params;
  const foto = await leerFoto(archivo);

  if (!foto) {
    return new Response('No encontrada', { status: 404 });
  }

  return new Response(new Uint8Array(foto.contenido), {
    headers: {
      'Content-Type': foto.mime,
      // El nombre es aleatorio y no se reutiliza: cambiar la foto genera un
      // nombre nuevo, asi que se puede cachear sin miedo.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
