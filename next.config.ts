import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Un solo servicio: el build standalone empaqueta el servidor Node completo.
  output: 'standalone',
  // Sin esto, Next busca la raiz del workspace hacia arriba y puede tomar un
  // lockfile ajeno (por ejemplo el del home del usuario) al trazar archivos.
  outputFileTracingRoot: import.meta.dirname,
  experimental: {
    serverActions: {
      // Los comprobantes de transferencia son capturas de pantalla de celular.
      bodySizeLimit: '8mb',
    },
  },
};

export default nextConfig;
