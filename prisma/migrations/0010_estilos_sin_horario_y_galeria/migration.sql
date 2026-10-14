-- ===========================================================================
-- 0010 — Los estilos cruzan toda la noche, y galeria de fotos
--
-- Dos cambios que llegaron juntos:
--   1. El line-up deja de ser una parrilla con horarios. Los cuatro estilos
--      suenan durante toda la noche, sin orden ni tramos.
--   2. Una galeria de fotos de eventos anteriores, para la seccion de
--      Instagram de la portada.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Estilos sin horario
--
-- Se limpian las horas, las descripciones y el destacado de los bloques que
-- siguen sin artista: todas decian o implicaban una secuencia ("Apertura",
-- "Cierre", 21:00—23:00) que ya no existe. Solo los que nadie edito a mano.
-- ---------------------------------------------------------------------------
UPDATE "artistas"
SET "artista_hora_inicio"  = NULL,
    "artista_hora_termino" = NULL,
    "artista_descripcion"  = NULL,
    "artista_destacado"    = FALSE
WHERE "created_by" = 1
  AND "modified_by" IS NULL
  AND "artista_nombre" = 'Por confirmar';

-- ---------------------------------------------------------------------------
-- 2. Galeria
--
-- Las fotos no se versionan en /public: las sube el organizador desde el panel
-- y se guardan en el volumen de datos, junto a los logos. Agregar una foto no
-- deberia costar un despliegue.
--
-- En la tabla va el nombre del archivo y no una URL: una URL libre dejaria que
-- la portada muestre una imagen de cualquier lado, que es inyeccion de
-- contenido con otro nombre.
-- ---------------------------------------------------------------------------
CREATE TABLE "fotos" (
    "foto_id" SERIAL NOT NULL,
    "foto_evento_id" INTEGER NOT NULL,
    "foto_archivo" VARCHAR(200) NOT NULL,
    -- Texto alternativo: sin esto la galeria no existe para un lector de pantalla.
    "foto_alt" VARCHAR(200),
    "foto_orden" INTEGER NOT NULL DEFAULT 0,
    "foto_activa" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_by" INTEGER,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_pkey" PRIMARY KEY ("foto_id")
);

CREATE INDEX "fotos_foto_evento_id_idx" ON "fotos"("foto_evento_id");

-- La misma foto dos veces en la grilla es un error de carga, no una decision.
CREATE UNIQUE INDEX "fotos_evento_archivo_key"
  ON "fotos"("foto_evento_id", "foto_archivo");

ALTER TABLE "fotos" ADD CONSTRAINT "fotos_foto_evento_id_fkey"
  FOREIGN KEY ("foto_evento_id") REFERENCES "eventos"("evento_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fotos" ADD CONSTRAINT "fotos_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "usuarios"("usuario_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fotos" ADD CONSTRAINT "fotos_modified_by_fkey"
  FOREIGN KEY ("modified_by") REFERENCES "usuarios"("usuario_id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TRIGGER trg_set_modified_at_fotos
BEFORE UPDATE ON "fotos"
FOR EACH ROW EXECUTE FUNCTION set_modified_at();

-- Mismo formato de nombre que genera el guardado de archivos. Si entra otra
-- cosa, el servidor la rechaza al leerla y la foto sale rota sin ninguna pista.
ALTER TABLE "fotos" ADD CONSTRAINT "chk_foto_archivo_formato"
  CHECK ("foto_archivo" ~ '^[a-z0-9]+-[a-f0-9]{16}\.(png|jpg|webp)$');

ALTER TABLE "fotos" ADD CONSTRAINT "chk_foto_orden_no_negativo"
  CHECK ("foto_orden" >= 0);
