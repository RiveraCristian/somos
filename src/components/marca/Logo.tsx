type Props = {
  /** lockup = onda + palabra · marca = solo la onda · palabra = solo el texto */
  variante?: 'lockup' | 'marca' | 'palabra';
  /** Alto en pixeles. El ancho se calcula solo. */
  alto?: number;
  /** true = usa currentColor en vez del gradiente de marca. */
  mono?: boolean;
  className?: string;
};

const BARRAS = [
  { x: 5.5, y: 55, h: 18 },
  { x: 16.5, y: 46, h: 36 },
  { x: 27.5, y: 32, h: 64 },
  { x: 38.5, y: 16, h: 96 },
  { x: 49.5, y: 28, h: 72 },
  { x: 60.5, y: 8, h: 112 },
  { x: 71.5, y: 24, h: 80 },
  { x: 82.5, y: 14, h: 100 },
  { x: 93.5, y: 34, h: 60 },
  { x: 104.5, y: 47, h: 34 },
  { x: 115.5, y: 55, h: 18 },
];

/**
 * Wordmark geometrico: letras de trazo uniforme, anchas y de terminacion recta,
 * para que hable el mismo idioma que Unbounded sin depender de que la fuente
 * este cargada.
 */
const LETRAS = [
  'M 40 34 A 16 16 0 1 0 24 50 A 16 16 0 1 1 8 66',
  'M 158 82 L 158 18 L 181 56 L 204 18 L 204 82',
  'M 354 34 A 16 16 0 1 0 338 50 A 16 16 0 1 1 322 66',
];

const OES = [99, 263];

/**
 * Identidad de SOMOS: un oscilograma.
 * Las once barras son la onda; la palabra va en trazo monolineal geometrico.
 */
export function Logo({ variante = 'lockup', alto = 28, mono = false, className }: Props) {
  const idGradiente = `somos-grad-${variante}${mono ? '-mono' : ''}`;
  const pintura = mono ? 'currentColor' : `url(#${idGradiente})`;

  const anchoCaja = variante === 'lockup' ? 484 : variante === 'marca' ? 128 : 362;
  const altoCaja = variante === 'marca' ? 128 : 100;
  const ancho = (anchoCaja / altoCaja) * alto;

  const desplazamientoPalabra = variante === 'palabra' ? 0 : 122;

  return (
    <svg
      viewBox={`0 0 ${anchoCaja} ${altoCaja}`}
      width={ancho}
      height={alto}
      className={className}
      role="img"
      aria-label="SOMOS"
    >
      {!mono && (
        <defs>
          <linearGradient id={idGradiente} x1="0" y1="0" x2={anchoCaja} y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#00F0FF" />
            <stop offset="0.52" stopColor="#7B5CFF" />
            <stop offset="1" stopColor="#FF2E9A" />
          </linearGradient>
        </defs>
      )}

      {variante !== 'palabra' && (
        <g transform={variante === 'marca' ? undefined : 'translate(0 4) scale(0.71875)'}>
          <line x1="0" y1="64" x2="128" y2="64" stroke={pintura} strokeWidth="2" opacity="0.28" />
          <g fill={pintura}>
            {BARRAS.map((b) => (
              <rect key={b.x} x={b.x} y={b.y} width="7" height={b.h} rx="3.5" />
            ))}
          </g>
        </g>
      )}

      {variante !== 'marca' && (
        <g
          transform={`translate(${desplazamientoPalabra} 0)`}
          fill="none"
          stroke={pintura}
          strokeWidth="16"
          strokeLinecap="butt"
          strokeLinejoin="round"
        >
          {LETRAS.map((d) => (
            <path key={d} d={d} />
          ))}
          {OES.map((cx) => (
            <ellipse key={cx} cx={cx} cy="50" rx="27" ry="32" />
          ))}
        </g>
      )}
    </svg>
  );
}
