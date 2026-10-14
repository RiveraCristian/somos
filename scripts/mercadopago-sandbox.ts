/**
 * Prueba de Mercado Pago contra el sandbox, sin tocar la base de datos.
 *
 *   npm run mp:sandbox                     verifica credenciales y crea una
 *                                          preferencia de prueba de $1.000
 *   npm run mp:sandbox -- pago <id>        consulta un pago y muestra como lo
 *                                          evaluaria el sitio
 *   npm run mp:sandbox -- webhook <id>     manda al webhook local una
 *                                          notificacion firmada con tu secreto
 *
 * Usa las variables del .env. Con credenciales de produccion se niega a crear
 * nada: este script es para probar, no para cobrar.
 */
import { createHmac, randomUUID } from 'node:crypto';

import {
  buscarPagosMp,
  crearPreferenciaMp,
  evaluarIntento,
  obtenerPagoMp,
  verificarCredencialesMp,
} from '../src/lib/mercadopago';

const base = (process.env.APP_URL ?? 'http://localhost:3100').replace(/\/+$/, '');

async function credenciales() {
  const check = await verificarCredencialesMp();
  if (!check.ok) {
    console.error(`✗ ${check.problema}`);
    process.exit(1);
  }
  console.log(`✓ Conectado a ${check.cuenta} · credenciales de ${check.modo}`);
  return check;
}

async function preferencia() {
  const check = await credenciales();
  if (check.modo !== 'prueba') {
    console.error('✗ Esas credenciales son de PRODUCCION. Usa las de una cuenta de prueba.');
    process.exit(1);
  }

  const referencia = `prueba-${randomUUID().slice(0, 8)}`;
  const pref = await crearPreferenciaMp({
    referencia,
    monto: 1000,
    titulo: 'Prueba de integración SOMOS',
    correo: 'comprador@testuser.com',
    nombre: 'Comprador de Prueba',
    urlRetorno: `${base}/`,
  });

  console.log(`✓ Preferencia ${pref.id} (referencia ${referencia})`);
  console.log(`\n  Abre esto en una ventana de incógnito y paga con una tarjeta de prueba:\n  ${pref.urlCheckout}\n`);
  console.log(`  Despues: npm run mp:sandbox -- pago <id del pago>`);
}

async function pago(id: string) {
  await credenciales();
  const cobro = await obtenerPagoMp(id);
  if (!cobro) {
    console.error(`✗ Mercado Pago no conoce el pago ${id} con estas credenciales.`);
    process.exit(1);
  }
  console.log(cobro);

  if (cobro.external_reference) {
    const todos = await buscarPagosMp(cobro.external_reference);
    const evaluacion = evaluarIntento(todos.length ? todos : [cobro], {
      referencia: cobro.external_reference,
      monto: cobro.transaction_amount ?? 0,
      vencido: false,
    });
    console.log(`\n  ${todos.length} cobro(s) con esa referencia → el sitio lo dejaria en "${evaluacion.estado}"`);
    for (const a of evaluacion.anomalias) console.log(`  ! ${a.tipo}: ${a.detalle}`);
  }
}

async function webhook(id: string) {
  const secreto = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secreto) {
    console.error('✗ Falta MERCADOPAGO_WEBHOOK_SECRET.');
    process.exit(1);
  }

  const ts = String(Math.floor(Date.now() / 1000));
  const requestId = randomUUID();
  const firma = createHmac('sha256', secreto)
    .update(`id:${id};request-id:${requestId};ts:${ts};`)
    .digest('hex');

  const respuesta = await fetch(`${base}/api/webhooks/mercadopago?data.id=${id}&type=payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature': `ts=${ts},v1=${firma}`,
      'x-request-id': requestId,
    },
    body: JSON.stringify({ id: `prueba-${requestId}`, type: 'payment', action: 'payment.updated', data: { id } }),
  });

  console.log(`→ ${respuesta.status} ${await respuesta.text()}`);
}

const [comando, argumento] = process.argv.slice(2);

const tarea =
  comando === 'pago' && argumento
    ? pago(argumento)
    : comando === 'webhook' && argumento
      ? webhook(argumento)
      : preferencia();

tarea.catch((e) => {
  console.error('✗', e instanceof Error ? e.message : e);
  process.exit(1);
});
