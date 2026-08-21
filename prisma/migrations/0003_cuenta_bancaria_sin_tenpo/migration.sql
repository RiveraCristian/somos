-- ===========================================================================
-- 0003 — Fuera Tenpo: cuenta bancaria comun
--
-- El cobro pasa a ser Fintoc, que deposita en la cuenta configurada en su
-- propio panel. Los datos que guarda la aplicacion son los del camino manual —
-- la cuenta a la que transfiere quien no puede usar el widget — y esa cuenta ya
-- no es de Tenpo, asi que las columnas dejan de llamarse por esa marca.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Renombre de columnas
--
-- RENAME conserva los datos: el titular, el RUT y la cuenta siguen siendo los
-- mismos, solo cambia como se llaman.
-- ---------------------------------------------------------------------------
ALTER TABLE "eventos" RENAME COLUMN "evento_tenpo_nombre"      TO "evento_cuenta_nombre";
ALTER TABLE "eventos" RENAME COLUMN "evento_tenpo_rut"         TO "evento_cuenta_rut";
ALTER TABLE "eventos" RENAME COLUMN "evento_tenpo_correo"      TO "evento_cuenta_correo";
ALTER TABLE "eventos" RENAME COLUMN "evento_tenpo_banco"       TO "evento_cuenta_banco";
ALTER TABLE "eventos" RENAME COLUMN "evento_tenpo_tipo_cuenta" TO "evento_cuenta_tipo";
ALTER TABLE "eventos" RENAME COLUMN "evento_tenpo_cuenta"      TO "evento_cuenta_numero";
ALTER TABLE "eventos" RENAME COLUMN "evento_tenpo_qr_url"      TO "evento_cuenta_qr_url";

-- El seed dejaba "Tenpo" como nombre del banco. Ahora es una cuenta bancaria
-- cualquiera, asi que ese valor pasa a ser dato equivocado y no un valor por
-- defecto: se limpia para que el panel lo pida de nuevo.
UPDATE "eventos" SET "evento_cuenta_banco" = NULL WHERE "evento_cuenta_banco" = 'Tenpo';

-- El QR era el de cobro de la app de Tenpo. Una cuenta bancaria comun no tiene
-- ese QR, asi que el que hubiera quedado ya no sirve.
UPDATE "eventos" SET "evento_cuenta_qr_url" = NULL WHERE "evento_cuenta_qr_url" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Metodo de pago: se va 'tenpo'
--
-- Los pagos que estuvieran marcados asi eran transferencias declaradas a mano.
-- Pasan a 'transferencia', que es lo que siempre fueron.
-- ---------------------------------------------------------------------------
ALTER TABLE "pagos" ALTER COLUMN "pago_metodo" DROP DEFAULT;

UPDATE "pagos" SET "pago_metodo" = 'transferencia' WHERE "pago_metodo" = 'tenpo';

ALTER TABLE "pagos" ALTER COLUMN "pago_metodo" SET DEFAULT 'transferencia';

ALTER TABLE "pagos" DROP CONSTRAINT "chk_pago_metodo";

ALTER TABLE "pagos" ADD CONSTRAINT "chk_pago_metodo"
  CHECK ("pago_metodo" IN ('transferencia', 'efectivo', 'fintoc', 'mercadopago', 'otro'));
