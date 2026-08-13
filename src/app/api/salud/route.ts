import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Chequeo de salud para Docker y para el balanceador. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ estado: 'ok', baseDatos: 'conectada' });
  } catch {
    return Response.json({ estado: 'degradado', baseDatos: 'sin conexion' }, { status: 503 });
  }
}
