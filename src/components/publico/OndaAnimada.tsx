'use client';

import { useEffect, useRef } from 'react';

type Capa = {
  amplitud: number;
  frecuencia: number;
  velocidad: number;
  desfase: number;
  grosor: number;
  opacidad: number;
  brillo: number;
};

const CAPAS: Capa[] = [
  { amplitud: 0.16, frecuencia: 1.1, velocidad: 0.35, desfase: 0.0, grosor: 2.4, opacidad: 0.95, brillo: 26 },
  { amplitud: 0.11, frecuencia: 1.9, velocidad: -0.52, desfase: 1.7, grosor: 1.6, opacidad: 0.6, brillo: 18 },
  { amplitud: 0.24, frecuencia: 0.7, velocidad: 0.22, desfase: 3.4, grosor: 1.1, opacidad: 0.35, brillo: 12 },
  { amplitud: 0.07, frecuencia: 3.1, velocidad: -0.8, desfase: 5.1, grosor: 1, opacidad: 0.28, brillo: 10 },
];

/**
 * Fondo del hero: un oscilograma vivo.
 *
 * Es canvas 2D a proposito y no Three.js. La landing tiene que abrir rapido en
 * el celular de cualquiera, y estas curvas no justifican cargar un motor 3D
 * completo ni tomarse la GPU.
 */
export function OndaAnimada({ className }: { className?: string }) {
  const refCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = refCanvas.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let ancho = 0;
    let alto = 0;
    let animacion = 0;
    let tiempo = 0;
    let visible = true;
    let punteroX = 0.5;

    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

    function redimensionar() {
      if (!canvas) return;
      const caja = canvas.getBoundingClientRect();
      ancho = Math.max(1, caja.width);
      alto = Math.max(1, caja.height);
      canvas.width = Math.floor(ancho * dpr());
      canvas.height = Math.floor(alto * dpr());
      ctx!.setTransform(dpr(), 0, 0, dpr(), 0, 0);
    }

    function gradiente() {
      const g = ctx!.createLinearGradient(0, 0, ancho, 0);
      g.addColorStop(0, '#00F0FF');
      g.addColorStop(0.5, '#7B5CFF');
      g.addColorStop(1, '#FF2E9A');
      return g;
    }

    function dibujar() {
      ctx!.clearRect(0, 0, ancho, alto);

      const centro = alto * 0.52;
      const paso = ancho > 900 ? 7 : 5;
      // El puntero inclina las ondas apenas, para que el fondo reaccione.
      const inclinacion = (punteroX - 0.5) * alto * 0.06;
      const trazo = gradiente();

      for (const capa of CAPAS) {
        ctx!.beginPath();

        for (let x = 0; x <= ancho; x += paso) {
          const u = x / ancho;

          // Sobre de amplitud: las ondas nacen y mueren en los bordes.
          const sobre = Math.sin(u * Math.PI) ** 1.4;

          const y =
            centro +
            inclinacion * (u - 0.5) * 2 +
            sobre *
              alto *
              capa.amplitud *
              (Math.sin(u * Math.PI * 2 * capa.frecuencia + tiempo * capa.velocidad + capa.desfase) *
                0.7 +
                Math.sin(u * Math.PI * 2 * capa.frecuencia * 2.3 - tiempo * capa.velocidad * 1.4) *
                  0.3);

          if (x === 0) ctx!.moveTo(x, y);
          else ctx!.lineTo(x, y);
        }

        ctx!.strokeStyle = trazo;
        ctx!.lineWidth = capa.grosor;
        ctx!.globalAlpha = capa.opacidad;
        ctx!.shadowColor = '#7B5CFF';
        ctx!.shadowBlur = capa.brillo;
        ctx!.lineCap = 'round';
        ctx!.stroke();
      }

      ctx!.globalAlpha = 1;
      ctx!.shadowBlur = 0;
    }

    function cuadro() {
      if (visible) {
        tiempo += 0.016;
        dibujar();
      }
      animacion = requestAnimationFrame(cuadro);
    }

    function moverPuntero(e: PointerEvent) {
      punteroX = e.clientX / window.innerWidth;
    }

    redimensionar();
    dibujar();

    const observador = new ResizeObserver(() => {
      redimensionar();
      dibujar();
    });
    observador.observe(canvas);

    // No gastar cuadros cuando el hero quedo fuera de pantalla.
    const visibilidad = new IntersectionObserver(
      ([entrada]) => {
        visible = entrada.isIntersecting;
      },
      { threshold: 0 },
    );
    visibilidad.observe(canvas);

    if (!reducido) {
      window.addEventListener('pointermove', moverPuntero, { passive: true });
      animacion = requestAnimationFrame(cuadro);
    }

    return () => {
      cancelAnimationFrame(animacion);
      observador.disconnect();
      visibilidad.disconnect();
      window.removeEventListener('pointermove', moverPuntero);
    };
  }, []);

  return <canvas ref={refCanvas} className={className} aria-hidden="true" />;
}
