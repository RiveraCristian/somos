/**
 * Recorta el fondo del logo oficial y genera los archivos que usa el sitio.
 *
 *   npm run logo
 *
 * Lee `logo_somos.png` de la raiz (trazo blanco sobre negro puro) y escribe:
 *   public/logo.png        blanco con transparencia real, recortado
 *   public/logo-negro.png  para fondos claros e impresion
 *   src/app/icon.png       favicon 512x512
 *
 * La luminancia del original sirve directamente como canal alfa: el recorte es
 * exacto y conserva el antialias del borde, sin umbrales que dejen dientes de
 * sierra. Corre sobre el canvas de un Edge headless para no sumar dependencias
 * nativas de procesamiento de imagenes al proyecto.
 *
 * Si algun dia cambia el logo, reemplaza `logo_somos.png` y vuelve a correrlo.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PUERTO = 9341;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const origen = await readFile('logo_somos.png');
const dataUrl = `data:image/png;base64,${origen.toString('base64')}`;

const navegador = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--no-first-run',
  `--remote-debugging-port=${PUERTO}`,
  `--user-data-dir=${process.env.TEMP}\\somos-logo-${Date.now()}`,
  'about:blank',
]);
navegador.stderr.on('data', () => {});

let lista = null;
for (let i = 0; i < 40; i += 1) {
  try {
    lista = await fetch(`http://127.0.0.1:${PUERTO}/json/list`).then((r) => r.json());
    if (lista.find((t) => t.type === 'page')) break;
  } catch {
    await esperar(500);
  }
}

const socket = new WebSocket(lista.find((t) => t.type === 'page').webSocketDebuggerUrl);
let id = 0;
const pendientes = new Map();
socket.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (pendientes.has(m.id)) {
    pendientes.get(m.id)(m);
    pendientes.delete(m.id);
  }
};
await new Promise((ok) => (socket.onopen = ok));

const enviar = (metodo, params = {}) =>
  new Promise((ok) => {
    id += 1;
    pendientes.set(id, ok);
    socket.send(JSON.stringify({ id, method: metodo, params }));
  });

await enviar('Runtime.enable');

async function evaluar(expresion) {
  const respuesta = await enviar('Runtime.evaluate', {
    expression: expresion,
    returnByValue: true,
    awaitPromise: true,
  });
  const detalle = respuesta.result?.exceptionDetails;
  if (detalle) throw new Error(detalle.exception?.description ?? JSON.stringify(detalle));
  return respuesta.result.result.value;
}

const guion = `
(async () => {
  const imagen = new Image();
  imagen.src = ${JSON.stringify(dataUrl)};
  await imagen.decode();

  const ancho = imagen.naturalWidth;
  const alto = imagen.naturalHeight;

  const base = document.createElement('canvas');
  base.width = ancho;
  base.height = alto;
  const ctx = base.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imagen, 0, 0);

  const datos = ctx.getImageData(0, 0, ancho, alto);
  const p = datos.data;

  // --- Luminancia -> alfa, color -> blanco ------------------------------
  // Sobre fondo negro el resultado es identico al original; sobre cualquier
  // otro fondo, el logo queda limpio y sin caja.
  let minX = ancho, minY = alto, maxX = -1, maxY = -1;

  for (let y = 0; y < alto; y += 1) {
    for (let x = 0; x < ancho; x += 1) {
      const i = (y * ancho + x) * 4;
      const luz = 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
      const alfa = Math.round(Math.min(255, luz));
      p[i] = 255; p[i + 1] = 255; p[i + 2] = 255; p[i + 3] = alfa;

      if (alfa > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  ctx.putImageData(datos, 0, 0);

  // --- Recorte de margenes transparentes --------------------------------
  const margen = 4;
  minX = Math.max(0, minX - margen);
  minY = Math.max(0, minY - margen);
  maxX = Math.min(ancho - 1, maxX + margen);
  maxY = Math.min(alto - 1, maxY + margen);

  const anchoRec = maxX - minX + 1;
  const altoRec = maxY - minY + 1;

  function lienzoDe(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // --- 1. Logo blanco, recortado y escalado a 1200 de ancho -------------
  const anchoFinal = Math.min(1200, anchoRec);
  const altoFinal = Math.round((altoRec / anchoRec) * anchoFinal);
  const blanco = lienzoDe(anchoFinal, altoFinal);
  const bctx = blanco.getContext('2d');
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(base, minX, minY, anchoRec, altoRec, 0, 0, anchoFinal, altoFinal);

  // --- 2. Version negra, para fondos claros e impresion -----------------
  const negro = lienzoDe(anchoFinal, altoFinal);
  const nctx = negro.getContext('2d');
  nctx.drawImage(blanco, 0, 0);
  nctx.globalCompositeOperation = 'source-in';
  nctx.fillStyle = '#05060A';
  nctx.fillRect(0, 0, anchoFinal, altoFinal);

  // --- 3. Favicon: cuadrado oscuro con esquinas redondeadas -------------
  const lado = 512;
  const icono = lienzoDe(lado, lado);
  const ictx = icono.getContext('2d');
  const radio = 112;
  ictx.beginPath();
  ictx.moveTo(radio, 0);
  ictx.arcTo(lado, 0, lado, lado, radio);
  ictx.arcTo(lado, lado, 0, lado, radio);
  ictx.arcTo(0, lado, 0, 0, radio);
  ictx.arcTo(0, 0, lado, 0, radio);
  ictx.closePath();
  ictx.fillStyle = '#05060A';
  ictx.fill();

  const anchoIcono = Math.round(lado * 0.82);
  const altoIcono = Math.round((altoFinal / anchoFinal) * anchoIcono);
  ictx.imageSmoothingQuality = 'high';
  ictx.drawImage(blanco, (lado - anchoIcono) / 2, (lado - altoIcono) / 2, anchoIcono, altoIcono);

  return {
    recorte: { minX, minY, anchoRec, altoRec },
    salida: { ancho: anchoFinal, alto: altoFinal },
    blanco: blanco.toDataURL('image/png'),
    negro: negro.toDataURL('image/png'),
    icono: icono.toDataURL('image/png'),
  };
})()
`;

const r = await evaluar(guion);

function guardar(ruta, dataUrl) {
  const base64 = dataUrl.split(',')[1];
  return writeFile(ruta, Buffer.from(base64, 'base64'));
}

await guardar('public/logo.png', r.blanco);
await guardar('public/logo-negro.png', r.negro);
await guardar('src/app/icon.png', r.icono);

console.log(`Contenido util: ${r.recorte.anchoRec}x${r.recorte.altoRec} (recortado del original)`);
console.log(`Logo generado:  ${r.salida.ancho}x${r.salida.alto}`);
console.log('  public/logo.png       (blanco, transparente)');
console.log('  public/logo-negro.png (para fondos claros e impresion)');
console.log('  src/app/icon.png      (favicon 512x512)');

socket.close();
navegador.kill();
