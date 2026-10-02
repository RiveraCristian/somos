-- ===========================================================================
-- 0008 — Flow como pasarela de pago
--
-- Las columnas `pago_metodo` y `pago_proveedor` tienen CHECK con la lista de
-- valores permitidos. Esa lista es deliberada —evita que un typo meta un
-- proveedor inventado y que la contabilidad deje de cuadrar— asi que agregar
-- una pasarela pasa por aca.
-- ===========================================================================

ALTER TABLE "pagos" DROP CONSTRAINT "chk_pago_metodo";
ALTER TABLE "pagos" ADD CONSTRAINT "chk_pago_metodo"
  CHECK ("pago_metodo" IN ('transferencia', 'efectivo', 'fintoc', 'mercadopago', 'flow', 'otro'));

ALTER TABLE "pagos" DROP CONSTRAINT "chk_pago_proveedor";
ALTER TABLE "pagos" ADD CONSTRAINT "chk_pago_proveedor"
  CHECK ("pago_proveedor" IN ('manual', 'fintoc', 'mercadopago', 'flow'));

-- ---------------------------------------------------------------------------
-- El FAQ describia el cobro con Fintoc
--
-- La respuesta sobre como se paga ya esta sembrada en la base, asi que cambiar
-- el seed no alcanza: hay que corregir la fila. Solo si nadie la edito a mano.
-- ---------------------------------------------------------------------------
UPDATE "preguntas_frecuentes"
SET "pregunta_respuesta" = 'Eliges tu entrada, dejas tu nombre y correo, y te la reservamos al tiro. Después te llevamos a Flow para pagar: acepta tarjetas de crédito y débito y transferencia bancaria. Apenas se confirma el pago vuelves al sitio, tu entrada con QR aparece en pantalla y te llega al correo.'
WHERE "pregunta_texto" = '¿Cómo pago?'
  AND "modified_by" IS NULL;
