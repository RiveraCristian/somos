'use client';

import { m } from 'framer-motion';

type Props = {
  children: React.ReactNode;
  /** Retraso en segundos, para escalonar a mano. */
  demora?: number;
  /** Desde donde entra. */
  desde?: 'abajo' | 'izquierda' | 'derecha' | 'ninguno';
  className?: string;
};

const DESPLAZAMIENTO = {
  abajo: { y: 24, x: 0 },
  izquierda: { y: 0, x: -24 },
  derecha: { y: 0, x: 24 },
  ninguno: { y: 0, x: 0 },
};

/**
 * Aparece al entrar en pantalla.
 *
 * `once` evita que el bloque vuelva a animarse cada vez que se pasa por encima,
 * que es lo que hace que un sitio se sienta inquieto. El margen negativo lo
 * dispara un poco antes de que el borde toque el viewport, para que el
 * movimiento termine cuando el usuario ya lo esta mirando.
 *
 * Quien pidio menos movimiento igual ve el contenido: MotionConfig se salta el
 * desplazamiento pero deja pasar el fundido, asi que nada queda invisible.
 */
export function Aparecer({ children, demora = 0, desde = 'abajo', className }: Props) {
  const salto = DESPLAZAMIENTO[desde];

  return (
    <m.div
      className={className}
      initial={{ opacity: 0, ...salto }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: '0px 0px -80px 0px' }}
      transition={{ duration: 0.55, delay: demora, ease: [0.2, 0.7, 0.3, 1] }}
    >
      {children}
    </m.div>
  );
}
