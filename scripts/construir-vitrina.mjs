/**
 * Arma la version estatica de la portada para publicarla en GitHub Pages.
 *
 *   npm run vitrina
 *
 * El sitio real necesita servidor y base de datos: hay Server Actions, cobros y
 * un panel. Nada de eso se puede exportar como HTML plano. Pero la portada si,
 * y es lo unico que hace falta para que la gente vea como va quedando.
 *
 * Como funciona:
 *   1. Se arma una mini-aplicacion Next en `.vitrina/`, con SOLO la portada.
 *   2. Esa portada es el mismo `src/app/page.tsx` del sitio real — no hay una
 *      copia del diseño que se pueda quedar atras. Solo se le quita el
 *      `force-dynamic`, que es incompatible con la exportacion estatica.
 *   3. Se compila con `output: 'export'` y MODO_VITRINA=1, asi las funciones de
 *      datos devuelven contenido de muestra en vez de consultar Postgres.
 *
 * El resultado queda en `.vitrina/out`, listo para subir a Pages.
 */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const destino = path.join(raiz, '.vitrina');

// La URL de GitHub Pages de un repositorio de proyecto cuelga del nombre del
// repo (usuario.github.io/somos), asi que todas las rutas necesitan ese prefijo.
const basePath = process.env.VITRINA_BASE_PATH ?? '/somos';

console.log('· limpiando .vitrina');
await rm(destino, { recursive: true, force: true });
await mkdir(path.join(destino, 'src', 'app'), { recursive: true });

// --- lo que se copia tal cual -----------------------------------------------
console.log('· copiando componentes y librerias');
await cp(path.join(raiz, 'src', 'components'), path.join(destino, 'src', 'components'), {
  recursive: true,
});
await cp(path.join(raiz, 'src', 'lib'), path.join(destino, 'src', 'lib'), { recursive: true });
await cp(path.join(raiz, 'public'), path.join(destino, 'public'), { recursive: true });

for (const archivo of ['globals.css', 'icon.png']) {
  await cp(path.join(raiz, 'src', 'app', archivo), path.join(destino, 'src', 'app', archivo));
}

// --- layout: mismo del sitio, con el aviso de desarrollo siempre encendido ---
console.log('· preparando layout');
let layout = await readFile(path.join(raiz, 'src', 'app', 'layout.tsx'), 'utf8');
layout = layout.replace('<AvisoDesarrollo />', '<AvisoDesarrollo forzado />');
await writeFile(path.join(destino, 'src', 'app', 'layout.tsx'), layout, 'utf8');

// --- portada: la misma, sin force-dynamic ------------------------------------
console.log('· preparando portada');
let portada = await readFile(path.join(raiz, 'src', 'app', 'page.tsx'), 'utf8');
const antes = portada;
portada = portada.replace(/^export const dynamic = .+;\s*$/m, '');
if (portada === antes) {
  console.warn('  aviso: no encontre el force-dynamic en page.tsx; revisa si cambio de forma');
}
await writeFile(path.join(destino, 'src', 'app', 'page.tsx'), portada, 'utf8');

// --- 404: cualquier link a /comprar, /admin, etc. cae aca --------------------
// La demo no tiene esas rutas. Sin esto la gente veria un 404 crudo de GitHub y
// pensaria que el sitio esta roto.
await writeFile(
  path.join(destino, 'src', 'app', 'not-found.tsx'),
  `import Link from 'next/link';

export default function NoEncontrado() {
  return (
    <main className="contenedor flex min-h-[70vh] flex-col items-center justify-center gap-5 py-24 text-center">
      <p className="eyebrow">Demo</p>
      <h1 className="titulo-display text-4xl sm:text-5xl">Esta parte todavía no</h1>
      <p className="max-w-md leading-relaxed text-dim">
        Estás viendo una muestra estática de SOMOS: solo la portada. La compra de
        entradas, el pago y el control de acceso funcionan en el sitio completo, que
        todavía está en desarrollo.
      </p>
      <Link href="/" className="btn btn-borde">
        Volver a la portada
      </Link>
    </main>
  );
}
`,
  'utf8',
);

// --- configuracion -----------------------------------------------------------
console.log('· escribiendo configuracion');
await writeFile(
  path.join(destino, 'next.config.mjs'),
  `/** Configuracion de la vitrina. La genera scripts/construir-vitrina.mjs. */
const nextConfig = {
  output: 'export',
  basePath: ${JSON.stringify(basePath)},
  // El optimizador de imagenes necesita servidor; en un sitio estatico no corre.
  images: { unoptimized: true },
  // GitHub Pages sirve /ruta/ como /ruta/index.html.
  trailingSlash: true,
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
`,
  'utf8',
);

const tsconfig = JSON.parse(await readFile(path.join(raiz, 'tsconfig.json'), 'utf8'));
await writeFile(
  path.join(destino, 'tsconfig.json'),
  JSON.stringify(tsconfig, null, 2) + '\n',
  'utf8',
);
await cp(path.join(raiz, 'postcss.config.mjs'), path.join(destino, 'postcss.config.mjs'));

// `.vitrina` cuelga del proyecto, asi que Next resuelve node_modules hacia
// arriba. Solo hace falta un package.json para que lo trate como app propia.
await writeFile(
  path.join(destino, 'package.json'),
  JSON.stringify({ name: 'somos-vitrina', private: true, type: 'module' }, null, 2) + '\n',
  'utf8',
);

// --- compilar ----------------------------------------------------------------
console.log('· compilando (next build --output export)');
const codigo = await new Promise((resolver) => {
  const hijo = spawn('npx next build', {
    cwd: destino,
    stdio: 'inherit',
    // shell: true — en Windows, Node ya no deja lanzar un .cmd directamente.
    shell: true,
    env: {
      ...process.env,
      MODO_VITRINA: '1',
      // Para que las rutas de public/ (el logo) salgan con el prefijo del repo.
      NEXT_PUBLIC_BASE_PATH: basePath,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });
  hijo.on('close', resolver);
});

if (codigo !== 0) {
  console.error('\nLa compilacion de la vitrina fallo.');
  process.exit(codigo ?? 1);
}

// GitHub Pages corre Jekyll por defecto y se salta las carpetas que empiezan
// con guion bajo — justo donde Next deja todo (_next). Este archivo lo apaga.
await writeFile(path.join(destino, 'out', '.nojekyll'), '', 'utf8');

console.log(`\nListo. La portada estatica quedo en .vitrina/out (basePath ${basePath}).`);
