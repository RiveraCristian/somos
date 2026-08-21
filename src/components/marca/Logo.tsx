import Image from 'next/image';

import { recurso } from '@/lib/rutas';

/** Proporción del archivo oficial ya recortado (1200 × 844). */
const RELACION = 1200 / 844;

type Props = {
  /** Alto en píxeles. El ancho se calcula solo. */
  alto?: number;
  /** Carga con prioridad. Solo para el logo grande del hero. */
  prioridad?: boolean;
  className?: string;
};

/**
 * Logo oficial de SOMOS.
 *
 * `public/logo.png` es el archivo original con el fondo recortado: el trazo
 * blanco quedó con transparencia real, así que apoya sobre cualquier fondo sin
 * caja. Para fondos claros o impresión existe `public/logo-negro.png`.
 */
export function Logo({ alto = 28, prioridad = false, className }: Props) {
  const ancho = Math.round(RELACION * alto);

  // width y height ya van en la proporcion correcta, asi que no se toca el
  // tamano por style: hacerlo a medias dispara el aviso de next/image.
  return (
    <Image
      src={recurso('/logo.png')}
      alt="SOMOS"
      width={ancho}
      height={alto}
      priority={prioridad}
      className={className}
    />
  );
}
