'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

const SCRIPT = 'https://www.instagram.com/embed.js';

type Props = { permalinks: string[] };

/**
 * Posts de Instagram embebidos.
 *
 * Instagram convierte cada `blockquote.instagram-media` en el post real cuando
 * corre su script. No hace falta token ni app: alcanza con que el post sea
 * publico.
 *
 * El script se carga una sola vez y recien cuando la seccion entra en pantalla.
 * Cada embed es un iframe contra Instagram, asi que traerlos todos al abrir la
 * portada seria cobrarle medio mega a alguien que quizas nunca baja hasta aca
 * —y la mayoria llega por el celular, con datos.
 */
export function EmbedsInstagram({ permalinks }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo || visible) return;

    // Sin IntersectionObserver (navegadores viejos) se cargan al tiro: mejor
    // pesado que vacio.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { rootMargin: '300px' },
    );

    observador.observe(nodo);
    return () => observador.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    // Si el script ya esta (otra seccion, una vuelta anterior del router), solo
    // se le pide que procese los blockquotes nuevos.
    if (window.instgrm) {
      window.instgrm.Embeds.process();
      return;
    }

    if (document.querySelector(`script[src="${SCRIPT}"]`)) return;

    const etiqueta = document.createElement('script');
    etiqueta.src = SCRIPT;
    etiqueta.async = true;
    etiqueta.onload = () => window.instgrm?.Embeds.process();
    document.body.appendChild(etiqueta);
  }, [visible, permalinks]);

  return (
    <div
      ref={contenedor}
      className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      // El script de Instagram reemplaza el contenido de cada blockquote por un
      // iframe. React no debe intentar reconciliarlo despues.
      suppressHydrationWarning
    >
      {permalinks.map((permalink) => (
        <div key={permalink} className="min-w-0">
          {visible ? (
            <blockquote
              className="instagram-media"
              data-instgrm-permalink={permalink}
              data-instgrm-version="14"
              style={{ margin: 0, width: '100%', minWidth: 0 }}
            />
          ) : (
            // Marca el lugar mientras no se cargan, para que la pagina no
            // pegue un salto cuando aparecen.
            <div className="aspect-square animate-pulse rounded-[14px] border border-line bg-white/[0.03]" />
          )}
        </div>
      ))}
    </div>
  );
}
