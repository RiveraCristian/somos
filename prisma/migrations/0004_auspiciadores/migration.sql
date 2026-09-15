-- ===========================================================================
-- 0004 — Auspiciadores
--
-- El logo no se versiona en /public: lo sube el organizador desde el panel y
-- se guarda junto a los comprobantes, en el volumen que sobrevive a los
-- redeploys. En la tabla va solo el nombre del archivo; la ruta publica la
-- arma el servidor. Guardar una URL completa dejaria que un auspicio apunte a
-- cualquier lado, y eso es una inyeccion de contenido en la portada.
-- ===========================================================================

CREATE TABLE "auspiciadores" (
    "auspiciador_id" SERIAL NOT NULL,
    "auspiciador_evento_id" INTEGER NOT NULL,
    "auspiciador_nombre" VARCHAR(120) NOT NULL,
    "auspiciador_logo" VARCHAR(200) NOT NULL,
    "auspiciador_sitio" VARCHAR(300),
    "auspiciador_orden" INTEGER NOT NULL DEFAULT 0,
    "auspiciador_activo" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_by" INTEGER,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auspiciadores_pkey" PRIMARY KEY ("auspiciador_id")
);

CREATE INDEX "auspiciadores_auspiciador_evento_id_idx"
  ON "auspiciadores"("auspiciador_evento_id");

-- Dos veces el mismo auspicio en la misma fila de logos es un error de carga,
-- no una decision de diseno.
CREATE UNIQUE INDEX "auspiciadores_evento_nombre_key"
  ON "auspiciadores"("auspiciador_evento_id", "auspiciador_nombre");

ALTER TABLE "auspiciadores" ADD CONSTRAINT "auspiciadores_auspiciador_evento_id_fkey"
  FOREIGN KEY ("auspiciador_evento_id") REFERENCES "eventos"("evento_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "auspiciadores" ADD CONSTRAINT "auspiciadores_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "usuarios"("usuario_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "auspiciadores" ADD CONSTRAINT "auspiciadores_modified_by_fkey"
  FOREIGN KEY ("modified_by") REFERENCES "usuarios"("usuario_id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TRIGGER trg_set_modified_at_auspiciadores
BEFORE UPDATE ON "auspiciadores"
FOR EACH ROW EXECUTE FUNCTION set_modified_at();

-- ---------------------------------------------------------------------------
-- Reglas de integridad
-- ---------------------------------------------------------------------------

-- Mismo formato de nombre que genera el guardado de archivos. Si entra
-- cualquier otra cosa, el servidor la rechazaria al leerla y el logo saldria
-- roto en la portada sin ninguna pista de por que.
--
-- Sin SVG a proposito: un SVG puede traer scripts y este archivo se sirve a
-- todo el publico. La ganancia visual de un logo vectorial a 40px de alto no
-- paga ese riesgo.
ALTER TABLE "auspiciadores" ADD CONSTRAINT "chk_auspiciador_logo_formato"
  CHECK ("auspiciador_logo" ~ '^[a-z0-9]+-[a-f0-9]{16}\.(png|jpg|webp)$');

-- El sitio del auspiciador se muestra como enlace en la portada: si acepta
-- cualquier texto, un "javascript:" queda a un descuido de distancia.
ALTER TABLE "auspiciadores" ADD CONSTRAINT "chk_auspiciador_sitio_formato"
  CHECK ("auspiciador_sitio" IS NULL OR "auspiciador_sitio" ~* '^https?://');

ALTER TABLE "auspiciadores" ADD CONSTRAINT "chk_auspiciador_orden_no_negativo"
  CHECK ("auspiciador_orden" >= 0);
