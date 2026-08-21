'use client';

import { m } from 'framer-motion';

/**
 * Anima a sus hijos uno tras otro al entrar en pantalla.
 *
 * Se usa para grillas (entradas, line-up, pasos): que aparezcan en cascada deja
 * claro que son una serie, en vez de un bloque que se prende de golpe.
 */
export function Escalonado({
  children,
  intervalo = 0.09,
  className,
}: {
  children: React.ReactNode;
  intervalo?: number;
  className?: string;
}) {
  return (
    <m.div
      className={className}
      initial="oculto"
      whileInView="visible"
      viewport={{ once: true, margin: '0px 0px -60px 0px' }}
      variants={{ visible: { transition: { staggerChildren: intervalo } } }}
    >
      {children}
    </m.div>
  );
}

/** Cada hijo directo de `Escalonado` debe ir envuelto en esto. */
export function ItemEscalonado({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <m.div
      className={className}
      variants={{
        oculto: { opacity: 0, y: 22 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.5, ease: [0.2, 0.7, 0.3, 1] }}
    >
      {children}
    </m.div>
  );
}
