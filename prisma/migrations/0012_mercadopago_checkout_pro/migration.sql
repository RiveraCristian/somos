-- ===========================================================================
-- 0012 — Mercado Pago con Checkout Pro
--
-- Con Checkout Pro el comprador se va a pagar a mercadopago.cl y puede
-- intentar varias veces dentro de la misma preferencia (una tarjeta rechazada,
-- despues otra aprobada). Por eso cada fila de `pagos` de Mercado Pago es un
-- INTENTO —una preferencia— y no un cobro: el cobro que manda es el que diga
-- la API, buscado por `external_reference`.
--
-- Esta migracion agrega lo que ese modelo necesita:
--   1. Los estados cancelado y reembolsado.
--   2. El estado crudo de la pasarela, para mostrar el motivo real.
--   3. Que la referencia externa sea unica por pasarela: es la llave con que
--      el webhook encuentra el intento, y si se repitiera, un cobro podria
--      terminar acreditado a otra persona.
--   4. La tabla de incidencias, donde queda lo que el sistema no debe
--      resolver solo: dos cobros aprobados para la misma persona, montos que
--      no calzan, reembolsos de entradas ya usadas.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Estados del pago
--
-- confirmado = APROBADO. Se mantiene el nombre porque ya lo usan el panel, los
-- pagos manuales y los reportes; cambiarlo seria tocar todo para nada.
-- ---------------------------------------------------------------------------
ALTER TABLE "pagos" DROP CONSTRAINT "chk_pago_estado";
ALTER TABLE "pagos" ADD CONSTRAINT "chk_pago_estado"
  CHECK ("pago_estado" IN ('pendiente', 'confirmado', 'rechazado', 'cancelado', 'reembolsado'));

-- ---------------------------------------------------------------------------
-- 2. Estado crudo en la pasarela
-- ---------------------------------------------------------------------------
ALTER TABLE "pagos" ADD COLUMN "pago_externo_estado" VARCHAR(40);
ALTER TABLE "pagos" ADD COLUMN "pago_externo_detalle" VARCHAR(80);

-- ---------------------------------------------------------------------------
-- 3. Referencia externa unica por pasarela
--
-- Parcial: los pagos manuales usan la misma columna para el numero de
-- operacion que escribe el admin, y ahi repetirse es legitimo.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "idx_pago_referencia_pasarela"
  ON "pagos" ("pago_proveedor", "pago_referencia")
  WHERE "pago_proveedor" <> 'manual' AND "pago_referencia" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Incidencias de cobro
-- ---------------------------------------------------------------------------
CREATE TABLE "incidencias_pago" (
    "incidencia_id" SERIAL NOT NULL,
    "incidencia_asistente_id" INTEGER NOT NULL,
    "incidencia_pago_id" INTEGER,
    "incidencia_tipo" VARCHAR(40) NOT NULL,
    -- Id del cobro en la pasarela, para ir a devolverlo sin buscar a mano.
    "incidencia_externo_pago" VARCHAR(120),
    "incidencia_monto" INTEGER,
    "incidencia_detalle" VARCHAR(500) NOT NULL,
    -- El webhook puede llegar varias veces por el mismo hecho. Esta llave
    -- hace que la incidencia se registre una sola vez.
    "incidencia_llave" VARCHAR(200) NOT NULL,
    "incidencia_estado" VARCHAR(20) NOT NULL DEFAULT 'abierta',
    "incidencia_resuelta_por" INTEGER,
    "incidencia_fecha_resuelta" TIMESTAMP(3),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_by" INTEGER,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidencias_pago_pkey" PRIMARY KEY ("incidencia_id")
);

CREATE UNIQUE INDEX "incidencias_pago_incidencia_llave_key"
  ON "incidencias_pago"("incidencia_llave");

CREATE INDEX "incidencias_pago_incidencia_estado_idx"
  ON "incidencias_pago"("incidencia_estado");

CREATE INDEX "incidencias_pago_incidencia_asistente_id_idx"
  ON "incidencias_pago"("incidencia_asistente_id");

ALTER TABLE "incidencias_pago" ADD CONSTRAINT "incidencias_pago_incidencia_asistente_id_fkey"
  FOREIGN KEY ("incidencia_asistente_id") REFERENCES "asistentes"("asistente_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "incidencias_pago" ADD CONSTRAINT "incidencias_pago_incidencia_pago_id_fkey"
  FOREIGN KEY ("incidencia_pago_id") REFERENCES "pagos"("pago_id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "incidencias_pago" ADD CONSTRAINT "incidencias_pago_incidencia_resuelta_por_fkey"
  FOREIGN KEY ("incidencia_resuelta_por") REFERENCES "usuarios"("usuario_id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "incidencias_pago" ADD CONSTRAINT "incidencias_pago_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "usuarios"("usuario_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "incidencias_pago" ADD CONSTRAINT "incidencias_pago_modified_by_fkey"
  FOREIGN KEY ("modified_by") REFERENCES "usuarios"("usuario_id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TRIGGER trg_set_modified_at_incidencias_pago
BEFORE UPDATE ON "incidencias_pago"
FOR EACH ROW EXECUTE FUNCTION set_modified_at();

ALTER TABLE "incidencias_pago" ADD CONSTRAINT "chk_incidencia_tipo"
  CHECK ("incidencia_tipo" IN (
    'pago_duplicado',
    'monto_no_coincide',
    'moneda_no_coincide',
    'reembolso_parcial',
    'reembolso',
    'reembolso_entrada_usada',
    'contracargo',
    'pago_en_reserva_anulada'
  ));

ALTER TABLE "incidencias_pago" ADD CONSTRAINT "chk_incidencia_estado"
  CHECK ("incidencia_estado" IN ('abierta', 'resuelta'));
