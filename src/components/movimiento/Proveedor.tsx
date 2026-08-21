'use client';

import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion';

/**
 * Habilita las animaciones para todo el arbol.
 *
 * LazyMotion con `domAnimation` carga solo el subconjunto que anima el DOM
 * (~15kb) en lugar de la libreria completa (~34kb). El modo `strict` obliga a
 * usar `m.*` y falla si alguien mete un `motion.*`, que reintroduciria el
 * paquete entero sin que se note.
 *
 * `reducedMotion="user"` es el que respeta la preferencia del sistema, y lo
 * hace dentro de Motion. Es a proposito que no lo resuelva cada componente con
 * `useReducedMotion()` + un return anticipado: ese hook vale `false` en el
 * servidor y `true` en el cliente, asi que el arbol cambiaba de forma entre
 * ambos, la hidratacion fallaba y las secciones quedaban congeladas en
 * `opacity: 0`, es decir invisibles justo para quien pidio menos movimiento.
 *
 * Los hijos siguen siendo Server Components: viajan como prop.
 */
export function ProveedorMovimiento({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
