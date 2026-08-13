import type { LucideIcon } from 'lucide-react';

type Acento = 'cyan' | 'magenta' | 'violeta' | 'lima' | 'ok' | 'alerta' | 'neutral';

const ACENTOS: Record<Acento, { color: string; borde: string; fondo: string }> = {
  cyan: { color: '#00F0FF', borde: 'rgba(0,240,255,0.3)', fondo: 'rgba(0,240,255,0.08)' },
  magenta: { color: '#FF2E9A', borde: 'rgba(255,46,154,0.3)', fondo: 'rgba(255,46,154,0.08)' },
  violeta: { color: '#9E86FF', borde: 'rgba(123,92,255,0.3)', fondo: 'rgba(123,92,255,0.1)' },
  lima: { color: '#B6FF3C', borde: 'rgba(182,255,60,0.3)', fondo: 'rgba(182,255,60,0.08)' },
  ok: { color: '#35F0A0', borde: 'rgba(53,240,160,0.3)', fondo: 'rgba(53,240,160,0.08)' },
  alerta: { color: '#FFC53D', borde: 'rgba(255,197,61,0.3)', fondo: 'rgba(255,197,61,0.08)' },
  neutral: { color: '#808DA8', borde: 'rgba(234,240,255,0.12)', fondo: 'rgba(234,240,255,0.04)' },
};

type Props = {
  etiqueta: string;
  valor: string;
  detalle?: string;
  icono: LucideIcon;
  acento?: Acento;
};

export function TarjetaCifra({ etiqueta, valor, detalle, icono: Icono, acento = 'neutral' }: Props) {
  const paleta = ACENTOS[acento];

  return (
    <div className="tarjeta flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="dato text-[0.65rem] tracking-[0.16em] text-faint uppercase">
          {etiqueta}
        </span>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full border"
          style={{ borderColor: paleta.borde, background: paleta.fondo, color: paleta.color }}
        >
          <Icono size={15} />
        </span>
      </div>

      <div>
        <div className="dato text-3xl font-semibold">{valor}</div>
        {detalle && <div className="mt-1 text-xs text-dim">{detalle}</div>}
      </div>
    </div>
  );
}
