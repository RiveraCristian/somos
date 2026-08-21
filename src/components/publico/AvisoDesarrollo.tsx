import { Hammer } from 'lucide-react';

/**
 * Franja de "en construccion".
 *
 * El sitio se esta mostrando antes de estar terminado, y sin este aviso alguien
 * puede intentar comprar de verdad y quedarse esperando una entrada que no va a
 * llegar. Es una barra fija arriba, no un modal: tiene que verse siempre, sin
 * estorbar ni pedir que la cierren.
 *
 * Se apaga poniendo AVISO_DESARROLLO="off" en el entorno.
 */
export function AvisoDesarrollo({ forzado = false }: { forzado?: boolean }) {
  const apagado = process.env.AVISO_DESARROLLO === 'off';
  if (apagado && !forzado) return null;

  return (
    <div className="relative z-50 border-b border-[rgba(255,197,61,0.28)] bg-[rgba(255,197,61,0.09)]">
      <p className="contenedor flex items-center justify-center gap-2.5 py-2.5 text-center text-xs leading-relaxed text-alerta sm:text-sm">
        <Hammer size={15} className="shrink-0" />
        <span>
          <strong className="font-semibold">Sitio en desarrollo.</strong>{' '}
          <span className="text-dim">
            Estás viendo una versión de prueba: los datos, precios y fechas pueden cambiar.
          </span>
        </span>
      </p>
    </div>
  );
}
