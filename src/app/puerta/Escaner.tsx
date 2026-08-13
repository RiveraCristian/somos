'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Camera,
  CameraOff,
  CheckCircle2,
  Keyboard,
  Loader2,
  ScanLine,
  XCircle,
} from 'lucide-react';

type Resultado = {
  resultado: 'autorizado' | 'ya_usada' | 'no_existe' | 'anulada';
  titulo: string;
  detalle: string;
  persona?: string;
  tipoEntrada?: string;
  codigo?: string;
};

type Registro = Resultado & { hora: string; id: number };

const ESTILOS = {
  autorizado: { borde: 'rgba(53,240,160,0.5)', fondo: 'rgba(53,240,160,0.07)', color: '#35F0A0' },
  ya_usada: { borde: 'rgba(255,46,154,0.5)', fondo: 'rgba(255,46,154,0.07)', color: '#FF2E9A' },
  no_existe: { borde: 'rgba(255,77,109,0.5)', fondo: 'rgba(255,77,109,0.07)', color: '#FF4D6D' },
  anulada: { borde: 'rgba(255,197,61,0.5)', fondo: 'rgba(255,197,61,0.07)', color: '#FFC53D' },
} as const;

const ICONOS = {
  autorizado: CheckCircle2,
  ya_usada: AlertTriangle,
  no_existe: XCircle,
  anulada: Ban,
} as const;

/** Pitido corto: en la puerta casi nunca se alcanza a mirar la pantalla. */
function pitar(exito: boolean) {
  try {
    const Contexto =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Contexto) return;

    const contexto = new Contexto();
    const oscilador = contexto.createOscillator();
    const ganancia = contexto.createGain();

    oscilador.connect(ganancia);
    ganancia.connect(contexto.destination);
    oscilador.type = 'sine';
    oscilador.frequency.value = exito ? 880 : 220;
    ganancia.gain.setValueAtTime(0.12, contexto.currentTime);
    ganancia.gain.exponentialRampToValueAtTime(0.001, contexto.currentTime + 0.22);

    oscilador.start();
    oscilador.stop(contexto.currentTime + 0.24);
    setTimeout(() => contexto.close(), 400);
  } catch {
    // Sin audio disponible: no pasa nada, el resultado igual se ve.
  }
}

export function Escaner() {
  const refVideo = useRef<HTMLVideoElement>(null);
  const refControles = useRef<{ stop: () => void } | null>(null);
  const refUltima = useRef<{ codigo: string; momento: number }>({ codigo: '', momento: 0 });
  const refContador = useRef(0);

  const [camara, setCamara] = useState<'apagada' | 'iniciando' | 'activa' | 'error'>('apagada');
  const [errorCamara, setErrorCamara] = useState('');
  const [validando, setValidando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [bitacora, setBitacora] = useState<Registro[]>([]);
  const [manual, setManual] = useState('');

  const validar = useCallback(async (codigo: string) => {
    const limpio = codigo.trim();
    if (!limpio) return;

    // Un QR frente a la cámara se decodifica muchas veces por segundo.
    const ahora = Date.now();
    if (refUltima.current.codigo === limpio && ahora - refUltima.current.momento < 3500) return;
    refUltima.current = { codigo: limpio, momento: ahora };

    setValidando(true);
    try {
      const respuesta = await fetch('/api/puerta/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: limpio }),
      });

      if (!respuesta.ok) {
        const datos = (await respuesta.json().catch(() => ({}))) as { error?: string };
        setResultado({
          resultado: 'no_existe',
          titulo: 'Error',
          detalle: datos.error ?? 'No se pudo validar. Revisa la conexión.',
        });
        pitar(false);
        return;
      }

      const datos = (await respuesta.json()) as Resultado;
      setResultado(datos);
      pitar(datos.resultado === 'autorizado');

      if (navigator.vibrate) {
        navigator.vibrate(datos.resultado === 'autorizado' ? 60 : [50, 60, 50]);
      }

      refContador.current += 1;
      setBitacora((previa) =>
        [
          {
            ...datos,
            id: refContador.current,
            hora: new Intl.DateTimeFormat('es-CL', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }).format(new Date()),
          },
          ...previa,
        ].slice(0, 40),
      );
    } catch {
      setResultado({
        resultado: 'no_existe',
        titulo: 'Sin conexión',
        detalle: 'No se pudo contactar al servidor. Reintenta.',
      });
      pitar(false);
    } finally {
      setValidando(false);
    }
  }, []);

  const encender = useCallback(async () => {
    setCamara('iniciando');
    setErrorCamara('');

    try {
      // Carga diferida: la librería de decodificación solo se descarga si de
      // verdad se va a usar la cámara.
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const lector = new BrowserMultiFormatReader();

      const controles = await lector.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        refVideo.current!,
        (resultadoLectura) => {
          if (resultadoLectura) void validar(resultadoLectura.getText());
        },
      );

      refControles.current = controles;
      setCamara('activa');
    } catch (e) {
      setCamara('error');
      setErrorCamara(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Diste permiso denegado a la cámara. Habilítala en el navegador y reintenta.'
          : 'No se pudo abrir la cámara. Usa el ingreso manual.',
      );
    }
  }, [validar]);

  function apagar() {
    refControles.current?.stop();
    refControles.current = null;
    setCamara('apagada');
  }

  useEffect(() => {
    return () => refControles.current?.stop();
  }, []);

  const estilo = resultado ? ESTILOS[resultado.resultado] : null;
  const Icono = resultado ? ICONOS[resultado.resultado] : ScanLine;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-5">
        {/* -------------------------------------------------------- Cámara */}
        <div className="tarjeta relative aspect-[4/3] overflow-hidden sm:aspect-video">
          <video
            ref={refVideo}
            className={`h-full w-full object-cover ${camara === 'activa' ? '' : 'hidden'}`}
            playsInline
            muted
          />

          {camara === 'activa' && (
            <>
              {/* Marco de mira */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-56 w-56 sm:h-64 sm:w-64">
                  {[
                    'top-0 left-0 border-t-2 border-l-2 rounded-tl-lg',
                    'top-0 right-0 border-t-2 border-r-2 rounded-tr-lg',
                    'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg',
                    'bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg',
                  ].map((clases) => (
                    <span
                      key={clases}
                      className={`absolute h-8 w-8 border-cyan ${clases}`}
                    />
                  ))}
                  <div className="laser-escaner top-1/2" />
                </div>
              </div>

              <button
                type="button"
                onClick={apagar}
                className="btn btn-borde btn-sm absolute top-3 right-3 !bg-void/70"
              >
                <CameraOff size={15} />
                Apagar
              </button>
            </>
          )}

          {camara !== 'activa' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
              {camara === 'iniciando' ? (
                <>
                  <Loader2 size={30} className="girando text-cyan" />
                  <p className="text-sm text-dim">Pidiendo permiso de cámara…</p>
                </>
              ) : (
                <>
                  <ScanLine size={34} className="text-faint" />
                  <div>
                    <p className="titulo-display text-xl">Escáner de puerta</p>
                    <p className="mt-2 max-w-xs text-sm text-dim">
                      Apunta la cámara al QR de la entrada. Se valida y se quema al instante.
                    </p>
                  </div>

                  {errorCamara && (
                    <p className="max-w-xs text-sm text-alerta">{errorCamara}</p>
                  )}

                  <button type="button" onClick={encender} className="btn btn-primario">
                    <Camera size={18} />
                    Encender cámara
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------ Resultado */}
        <div
          className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-[16px] border px-6 py-8 text-center transition-colors"
          style={
            estilo
              ? { borderColor: estilo.borde, background: estilo.fondo }
              : { borderColor: 'var(--color-line)' }
          }
          aria-live="polite"
        >
          {validando ? (
            <Loader2 size={26} className="girando text-cyan" />
          ) : resultado ? (
            <>
              <Icono size={30} style={{ color: estilo?.color }} />
              <p className="titulo-display text-2xl" style={{ color: estilo?.color }}>
                {resultado.titulo}
              </p>
              {resultado.persona && (
                <p className="text-lg font-medium">
                  {resultado.persona}
                  {resultado.tipoEntrada && (
                    <span className="ml-2 text-sm text-dim">· {resultado.tipoEntrada}</span>
                  )}
                </p>
              )}
              <p className="text-sm text-dim">{resultado.detalle}</p>
              {resultado.codigo && (
                <p className="dato text-xs tracking-[0.2em] text-faint">{resultado.codigo}</p>
              )}
            </>
          ) : (
            <p className="dato text-sm tracking-[0.16em] text-faint uppercase">
              Esperando lectura
            </p>
          )}
        </div>

        {/* --------------------------------------------------------- Manual */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void validar(manual);
            setManual('');
          }}
          className="flex gap-2.5"
        >
          <div className="relative flex-1">
            <Keyboard
              size={16}
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint"
            />
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value.toUpperCase())}
              placeholder="SOMOS-7K4M2P"
              maxLength={200}
              autoCapitalize="characters"
              autoComplete="off"
              className="campo-input dato !pl-11 tracking-[0.15em]"
            />
          </div>
          <button type="submit" className="btn btn-borde" disabled={validando || !manual.trim()}>
            Validar
          </button>
        </form>
      </div>

      {/* --------------------------------------------------------- Bitácora */}
      <aside className="tarjeta flex max-h-[38rem] flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="dato text-[0.65rem] tracking-[0.18em] text-faint uppercase">
            Esta sesión
          </h2>
          <span className="dato text-sm font-semibold">{bitacora.length}</span>
        </header>

        {bitacora.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-dim">Todavía no escaneas nada.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] overflow-y-auto">
            {bitacora.map((registro) => {
              const paleta = ESTILOS[registro.resultado];
              return (
                <li key={registro.id} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: paleta.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{registro.persona ?? registro.titulo}</p>
                    <p className="dato truncate text-xs text-faint">
                      {registro.hora} · {registro.codigo ?? registro.titulo}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}
