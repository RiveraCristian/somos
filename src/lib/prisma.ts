import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma unico.
 * En desarrollo Next recarga los modulos en cada cambio, asi que se guarda en
 * globalThis para no abrir una conexion nueva por cada hot reload.
 */
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalParaPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalParaPrisma.prisma = prisma;
}
