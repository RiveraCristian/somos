-- ===========================================================================
-- 0002 — Lista de invitados y etapas de venta
--
-- La fiesta deja de ser abierta: solo compra quien esta en la lista, y el
-- telefono es la credencial. Ademas el precio deja de vivir en el tipo de
-- entrada y pasa a depender de la etapa vigente.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Etapas de venta
-- ---------------------------------------------------------------------------
CREATE TABLE "etapas_venta" (
    "etapa_id" SERIAL NOT NULL,
    "etapa_evento_id" INTEGER NOT NULL,
    "etapa_nombre" VARCHAR(80) NOT NULL,
    "etapa_precio" INTEGER NOT NULL,
    "etapa_cupo" INTEGER,
    "etapa_orden" INTEGER NOT NULL,
    "etapa_en_puerta" BOOLEAN NOT NULL DEFAULT false,
    "etapa_activa" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_by" INTEGER,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etapas_venta_pkey" PRIMARY KEY ("etapa_id")
);

-- ---------------------------------------------------------------------------
-- Lista de invitados (entidad critica: soft delete)
-- ---------------------------------------------------------------------------
CREATE TABLE "invitados" (
    "invitado_id" SERIAL NOT NULL,
    "invitado_evento_id" INTEGER NOT NULL,
    "invitado_telefono" VARCHAR(20) NOT NULL,
    "invitado_nombre" VARCHAR(200),
    "invitado_cupo" INTEGER NOT NULL DEFAULT 2,
    "invitado_nota" VARCHAR(300),
    "invitado_activo" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_by" INTEGER,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" INTEGER,

    CONSTRAINT "invitados_pkey" PRIMARY KEY ("invitado_id")
);

-- ---------------------------------------------------------------------------
-- Precio congelado en el asistente
--
-- Se agrega en tres pasos: la columna nace nullable, se rellena con el precio
-- del tipo de entrada que ya tenia cada quien, y recien ahi se exige NOT NULL.
-- Asi la migracion no rompe con datos existentes.
-- ---------------------------------------------------------------------------
ALTER TABLE "asistentes" ADD COLUMN "asistente_etapa_id" INTEGER;
ALTER TABLE "asistentes" ADD COLUMN "asistente_precio" INTEGER;

UPDATE "asistentes" a
SET "asistente_precio" = t."tipo_entrada_precio"
FROM "tipos_entrada" t
WHERE t."tipo_entrada_id" = a."asistente_tipo_entrada_id"
  AND a."asistente_precio" IS NULL;

ALTER TABLE "asistentes" ALTER COLUMN "asistente_precio" SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Indices
-- ---------------------------------------------------------------------------
CREATE INDEX "etapas_venta_etapa_evento_id_idx" ON "etapas_venta"("etapa_evento_id");
CREATE UNIQUE INDEX "etapas_venta_etapa_evento_id_etapa_orden_key" ON "etapas_venta"("etapa_evento_id", "etapa_orden");
CREATE INDEX "invitados_invitado_evento_id_idx" ON "invitados"("invitado_evento_id");
CREATE UNIQUE INDEX "invitados_invitado_evento_id_invitado_telefono_key" ON "invitados"("invitado_evento_id", "invitado_telefono");
CREATE INDEX "asistentes_asistente_evento_id_asistente_telefono_idx" ON "asistentes"("asistente_evento_id", "asistente_telefono");

-- Una sola etapa de puerta por evento: si hubiera dos, cual manda seria un
-- empate silencioso resuelto por el orden de lectura.
CREATE UNIQUE INDEX "idx_etapa_puerta_unica"
  ON "etapas_venta" ("etapa_evento_id")
  WHERE "etapa_en_puerta" = TRUE;

-- ---------------------------------------------------------------------------
-- Llaves foraneas
-- ---------------------------------------------------------------------------
ALTER TABLE "asistentes" ADD CONSTRAINT "asistentes_asistente_etapa_id_fkey" FOREIGN KEY ("asistente_etapa_id") REFERENCES "etapas_venta"("etapa_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "etapas_venta" ADD CONSTRAINT "etapas_venta_etapa_evento_id_fkey" FOREIGN KEY ("etapa_evento_id") REFERENCES "eventos"("evento_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "etapas_venta" ADD CONSTRAINT "etapas_venta_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("usuario_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "etapas_venta" ADD CONSTRAINT "etapas_venta_modified_by_fkey" FOREIGN KEY ("modified_by") REFERENCES "usuarios"("usuario_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invitados" ADD CONSTRAINT "invitados_invitado_evento_id_fkey" FOREIGN KEY ("invitado_evento_id") REFERENCES "eventos"("evento_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invitados" ADD CONSTRAINT "invitados_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("usuario_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invitados" ADD CONSTRAINT "invitados_modified_by_fkey" FOREIGN KEY ("modified_by") REFERENCES "usuarios"("usuario_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invitados" ADD CONSTRAINT "invitados_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("usuario_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Triggers de modified_at
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_set_modified_at_etapas_venta
BEFORE UPDATE ON "etapas_venta"
FOR EACH ROW EXECUTE FUNCTION set_modified_at();

CREATE TRIGGER trg_set_modified_at_invitados
BEFORE UPDATE ON "invitados"
FOR EACH ROW EXECUTE FUNCTION set_modified_at();

-- ---------------------------------------------------------------------------
-- Reglas de integridad
-- ---------------------------------------------------------------------------
ALTER TABLE "etapas_venta" ADD CONSTRAINT "chk_etapa_precio_no_negativo"
  CHECK ("etapa_precio" >= 0);

ALTER TABLE "etapas_venta" ADD CONSTRAINT "chk_etapa_cupo_positivo"
  CHECK ("etapa_cupo" IS NULL OR "etapa_cupo" > 0);

ALTER TABLE "etapas_venta" ADD CONSTRAINT "chk_etapa_orden_positivo"
  CHECK ("etapa_orden" > 0);

-- La etapa de puerta se activa por fecha, no por cupo: un tope ahi seria una
-- regla muerta que confundiria al leer la tabla.
ALTER TABLE "etapas_venta" ADD CONSTRAINT "chk_etapa_puerta_sin_cupo"
  CHECK ("etapa_en_puerta" = FALSE OR "etapa_cupo" IS NULL);

ALTER TABLE "invitados" ADD CONSTRAINT "chk_invitado_cupo_positivo"
  CHECK ("invitado_cupo" > 0 AND "invitado_cupo" <= 10);

-- El telefono es la llave de la invitacion: si entra mal escrito, la persona
-- queda fuera sin explicacion. Se exige el formato normalizado.
ALTER TABLE "invitados" ADD CONSTRAINT "chk_invitado_telefono_formato"
  CHECK ("invitado_telefono" ~ '^\+56[0-9]{9}$');

ALTER TABLE "invitados" ADD CONSTRAINT "chk_invitado_borrado_coherente"
  CHECK ("is_deleted" = FALSE OR ("deleted_at" IS NOT NULL AND "deleted_by" IS NOT NULL));

ALTER TABLE "asistentes" ADD CONSTRAINT "chk_asistente_precio_no_negativo"
  CHECK ("asistente_precio" >= 0);

-- ---------------------------------------------------------------------------
-- Configuracion inicial de etapas
--
-- Va en la migracion y no en el seed porque sin etapas no hay precio, y sin
-- precio la compra no funciona: es configuracion que la aplicacion necesita
-- para operar, no datos de ejemplo. Es idempotente.
-- ---------------------------------------------------------------------------
INSERT INTO "etapas_venta"
  ("etapa_evento_id", "etapa_nombre", "etapa_precio", "etapa_cupo", "etapa_orden", "etapa_en_puerta", "created_by")
SELECT e."evento_id", v."nombre", v."precio", v."cupo", v."orden", v."en_puerta", 1
FROM "eventos" e
CROSS JOIN (VALUES
  ('Primera tanda', 20000, 100,  1, FALSE),
  ('Segunda tanda', 25000, NULL, 2, FALSE),
  ('En puerta',     30000, NULL, 3, TRUE)
) AS v("nombre", "precio", "cupo", "orden", "en_puerta")
WHERE e."is_deleted" = FALSE
ON CONFLICT ("etapa_evento_id", "etapa_orden") DO NOTHING;

-- Numero de prueba mientras llega la lista real de invitados.
INSERT INTO "invitados"
  ("invitado_evento_id", "invitado_telefono", "invitado_nombre", "invitado_cupo", "invitado_nota", "created_by")
SELECT e."evento_id", '+56999999999', 'Numero de prueba', 2,
       'Provisorio: reemplazar por la lista real de invitados.', 1
FROM "eventos" e
WHERE e."is_deleted" = FALSE
ON CONFLICT ("invitado_evento_id", "invitado_telefono") DO NOTHING;

-- Los asistentes que ya existian quedan atados a la primera etapa.
UPDATE "asistentes" a
SET "asistente_etapa_id" = (
  SELECT et."etapa_id" FROM "etapas_venta" et
  WHERE et."etapa_evento_id" = a."asistente_evento_id"
  ORDER BY et."etapa_orden" ASC LIMIT 1
)
WHERE a."asistente_etapa_id" IS NULL;
