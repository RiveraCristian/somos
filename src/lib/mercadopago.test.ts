import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  asistenteDeReferencia,
  evaluarIntento,
  nuevaReferenciaMp,
  validarFirmaWebhookMp,
  type PagoMp,
} from './mercadopago';

/**
 * Pruebas de las reglas que deciden cuando alguien queda pagado.
 * Corren sin red ni base: `npm test`.
 */

const REF = 'asistente-42-0123456789ab';
const esperado = { referencia: REF, monto: 20_000, vencido: false };

function cobro(parcial: Partial<PagoMp>): PagoMp {
  return {
    id: '1001',
    status: 'approved',
    status_detail: 'accredited',
    transaction_amount: 20_000,
    transaction_amount_refunded: 0,
    currency_id: 'CLP',
    external_reference: REF,
    ...parcial,
  };
}

describe('referencia externa', () => {
  it('lleva el id del asistente y se puede leer de vuelta', () => {
    const ref = nuevaReferenciaMp(42);
    assert.match(ref, /^asistente-42-[a-f0-9]{12}$/);
    assert.equal(asistenteDeReferencia(ref), 42);
  });

  it('cada intento tiene una referencia distinta', () => {
    assert.notEqual(nuevaReferenciaMp(7), nuevaReferenciaMp(7));
  });

  it('una referencia ajena no se le atribuye a nadie', () => {
    assert.equal(asistenteDeReferencia('pedido-99'), null);
    assert.equal(asistenteDeReferencia('asistente-42'), null);
    assert.equal(asistenteDeReferencia(null), null);
  });
});

describe('evaluarIntento', () => {
  it('confirma un cobro aprobado con monto, moneda y referencia exactos', () => {
    const r = evaluarIntento([cobro({})], esperado);
    assert.equal(r.estado, 'confirmado');
    assert.equal(r.principal?.id, '1001');
    assert.deepEqual(r.anomalias, []);
  });

  it('no confirma si el monto no calza, y lo deja como anomalia', () => {
    const r = evaluarIntento([cobro({ transaction_amount: 1_000 })], esperado);
    assert.notEqual(r.estado, 'confirmado');
    assert.equal(r.anomalias[0]?.tipo, 'monto_no_coincide');
  });

  it('no confirma si la moneda no es CLP', () => {
    const r = evaluarIntento([cobro({ currency_id: 'USD' })], esperado);
    assert.notEqual(r.estado, 'confirmado');
    assert.equal(r.anomalias[0]?.tipo, 'moneda_no_coincide');
  });

  it('ignora cobros de otra referencia aunque esten aprobados', () => {
    const r = evaluarIntento([cobro({ external_reference: 'asistente-7-ffffffffffff' })], esperado);
    assert.equal(r.estado, 'pendiente');
    assert.equal(r.principal, null);
  });

  it('dos aprobados en el mismo intento: confirma uno y reporta el otro', () => {
    const r = evaluarIntento([cobro({ id: '1' }), cobro({ id: '2' })], esperado);
    assert.equal(r.estado, 'confirmado');
    assert.equal(r.principal?.id, '1');
    assert.equal(r.anomalias.length, 1);
    assert.equal(r.anomalias[0].tipo, 'pago_duplicado');
    assert.equal(r.anomalias[0].pago.id, '2');
  });

  it('un rechazo seguido de un aprobado termina confirmado', () => {
    const r = evaluarIntento(
      [cobro({ id: '1', status: 'rejected', status_detail: 'cc_rejected_high_risk' }), cobro({ id: '2' })],
      esperado,
    );
    assert.equal(r.estado, 'confirmado');
    assert.equal(r.principal?.id, '2');
  });

  it('un rechazo con la preferencia viva deja el intento abierto', () => {
    const r = evaluarIntento([cobro({ status: 'rejected' })], esperado);
    assert.equal(r.estado, 'pendiente');
    assert.equal(r.principal?.status, 'rejected');
  });

  it('un rechazo con la preferencia vencida cierra el intento', () => {
    const r = evaluarIntento([cobro({ status: 'rejected' })], { ...esperado, vencido: true });
    assert.equal(r.estado, 'rechazado');
  });

  it('sin cobros y vencido queda cancelado', () => {
    assert.equal(evaluarIntento([], { ...esperado, vencido: true }).estado, 'cancelado');
    assert.equal(evaluarIntento([], esperado).estado, 'pendiente');
  });

  it('un cobro en proceso deja el intento pendiente con ese cobro', () => {
    const r = evaluarIntento([cobro({ status: 'in_process' })], { ...esperado, vencido: true });
    assert.equal(r.estado, 'pendiente');
    assert.equal(r.principal?.status, 'in_process');
  });

  it('un cobro devuelto queda reembolsado', () => {
    const r = evaluarIntento([cobro({ status: 'refunded' })], esperado);
    assert.equal(r.estado, 'reembolsado');
  });

  it('un contracargo queda reembolsado y se reporta', () => {
    const r = evaluarIntento([cobro({ status: 'charged_back' })], esperado);
    assert.equal(r.estado, 'reembolsado');
    assert.equal(r.anomalias[0]?.tipo, 'contracargo');
  });

  it('si se devolvio el doble pero queda uno aprobado, sigue confirmado', () => {
    const r = evaluarIntento([cobro({ id: '1' }), cobro({ id: '2', status: 'refunded' })], esperado);
    assert.equal(r.estado, 'confirmado');
    assert.equal(r.principal?.id, '1');
  });

  it('una devolucion parcial se reporta sin desconfirmar', () => {
    const r = evaluarIntento([cobro({ transaction_amount_refunded: 5_000 })], esperado);
    assert.equal(r.estado, 'confirmado');
    assert.equal(r.anomalias[0]?.tipo, 'reembolso_parcial');
  });
});

describe('firma del webhook', () => {
  const secreto = 'secreto-de-prueba';

  function firmar(id: string, requestId: string, ts: string) {
    const hmac = createHmac('sha256', secreto)
      .update(`id:${id};request-id:${requestId};ts:${ts};`)
      .digest('hex');
    return `ts=${ts},v1=${hmac}`;
  }

  it('acepta una firma correcta y rechaza las alteradas', () => {
    const previo = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secreto;
    try {
      const cabeceraFirma = firmar('123456', 'req-1', '1704908010');
      assert.equal(
        validarFirmaWebhookMp({ idRecurso: '123456', cabeceraFirma, cabeceraRequestId: 'req-1' }),
        true,
      );
      // Otro recurso con la misma firma: alguien quiere hacer pasar un pago por otro.
      assert.equal(
        validarFirmaWebhookMp({ idRecurso: '999999', cabeceraFirma, cabeceraRequestId: 'req-1' }),
        false,
      );
      assert.equal(
        validarFirmaWebhookMp({ idRecurso: '123456', cabeceraFirma, cabeceraRequestId: 'otro' }),
        false,
      );
      assert.equal(
        validarFirmaWebhookMp({ idRecurso: '123456', cabeceraFirma: null, cabeceraRequestId: 'req-1' }),
        false,
      );
    } finally {
      process.env.MERCADOPAGO_WEBHOOK_SECRET = previo;
    }
  });

  it('sin secreto configurado rechaza todo', () => {
    const previo = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    try {
      assert.equal(
        validarFirmaWebhookMp({
          idRecurso: '123456',
          cabeceraFirma: firmar('123456', 'req-1', '1704908010'),
          cabeceraRequestId: 'req-1',
        }),
        false,
      );
    } finally {
      if (previo !== undefined) process.env.MERCADOPAGO_WEBHOOK_SECRET = previo;
    }
  });
});
