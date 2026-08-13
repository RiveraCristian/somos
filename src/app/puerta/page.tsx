import type { Metadata } from 'next';

import { numero } from '@/lib/formato';
import { prisma } from '@/lib/prisma';

import { Escaner } from './Escaner';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Puerta',
  robots: { index: false, follow: false },
};

export default async function PaginaPuerta() {
  const [emitidas, quemadas, rechazadasHoy] = await Promise.all([
    prisma.entrada.count({ where: { isDeleted: false, entradaEstado: { not: 'anulada' } } }),
    prisma.entrada.count({ where: { isDeleted: false, entradaEstado: 'quemada' } }),
    prisma.escaneo.count({
      where: {
        escaneoResultado: { in: ['ya_usada', 'no_existe', 'anulada'] },
        escaneoFecha: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const dentro = quemadas;
  const porEntrar = Math.max(0, emitidas - quemadas);

  return (
    <>
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { etiqueta: 'Adentro', valor: dentro, color: '#35F0A0' },
          { etiqueta: 'Por entrar', valor: porEntrar, color: '#00F0FF' },
          { etiqueta: 'Rechazos 12h', valor: rechazadasHoy, color: '#FF2E9A' },
        ].map((cifra) => (
          <div key={cifra.etiqueta} className="tarjeta px-4 py-3.5 text-center">
            <div className="dato text-2xl font-semibold sm:text-3xl" style={{ color: cifra.color }}>
              {numero(cifra.valor)}
            </div>
            <div className="dato mt-1 text-[0.6rem] tracking-[0.16em] text-faint uppercase">
              {cifra.etiqueta}
            </div>
          </div>
        ))}
      </div>

      <Escaner />
    </>
  );
}
