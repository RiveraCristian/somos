-- ===========================================================================
-- 0011 — La galeria son posts de Instagram, no fotos subidas
--
-- La 0010 creo una galeria de archivos subidos a mano. No era lo pedido: la
-- idea es que se vea el Instagram de la fiesta, no una copia de sus fotos.
--
-- Por que no se lee el feed automaticamente: Meta apago la Instagram Basic
-- Display API en diciembre de 2024, y su reemplazo exige cuenta Profesional,
-- una app de Meta y un token que caduca cada 60 dias. Para un sitio que corre
-- una noche, eso es una pieza que se rompe sola justo cuando nadie mira.
--
-- Los embeds oficiales, en cambio, no piden token ni app y funcionan con
-- cualquier post publico. Se guarda el shortcode del post —la parte final de
-- instagram.com/p/<shortcode>/— y el servidor arma el permalink. Guardar la
-- URL completa dejaria que la portada embeba cualquier cosa.
-- ===========================================================================

-- La tabla de la 0010 nunca llego a tener fotos: se reemplaza entera.
DROP TABLE IF EXISTS "fotos";

CREATE TABLE "publicaciones_ig" (
    "publicacion_id" SERIAL NOT NULL,
    "publicacion_evento_id" INTEGER NOT NULL,
    "publicacion_codigo" VARCHAR(40) NOT NULL,
    -- p | reel | tv — define el permalink que arma el servidor.
    "publicacion_tipo" VARCHAR(10) NOT NULL DEFAULT 'p',
    "publicacion_nota" VARCHAR(200),
    "publicacion_orden" INTEGER NOT NULL DEFAULT 0,
    "publicacion_activa" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_by" INTEGER,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publicaciones_ig_pkey" PRIMARY KEY ("publicacion_id")
);

CREATE INDEX "publicaciones_ig_evento_idx"
  ON "publicaciones_ig"("publicacion_evento_id");

-- El mismo post dos veces en la grilla es un error de carga, no una decision.
CREATE UNIQUE INDEX "publicaciones_ig_evento_codigo_key"
  ON "publicaciones_ig"("publicacion_evento_id", "publicacion_codigo");

ALTER TABLE "publicaciones_ig" ADD CONSTRAINT "publicaciones_ig_evento_fkey"
  FOREIGN KEY ("publicacion_evento_id") REFERENCES "eventos"("evento_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "publicaciones_ig" ADD CONSTRAINT "publicaciones_ig_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "usuarios"("usuario_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "publicaciones_ig" ADD CONSTRAINT "publicaciones_ig_modified_by_fkey"
  FOREIGN KEY ("modified_by") REFERENCES "usuarios"("usuario_id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TRIGGER trg_set_modified_at_publicaciones_ig
BEFORE UPDATE ON "publicaciones_ig"
FOR EACH ROW EXECUTE FUNCTION set_modified_at();

-- ---------------------------------------------------------------------------
-- Reglas de integridad
-- ---------------------------------------------------------------------------

-- Formato real de un shortcode de Instagram. El codigo termina dentro de una
-- URL que el navegador va a cargar: si acepta cualquier texto, acepta tambien
-- lo que se le ocurra a quien escriba en el panel.
ALTER TABLE "publicaciones_ig" ADD CONSTRAINT "chk_publicacion_codigo_formato"
  CHECK ("publicacion_codigo" ~ '^[A-Za-z0-9_-]{5,30}$');

ALTER TABLE "publicaciones_ig" ADD CONSTRAINT "chk_publicacion_tipo"
  CHECK ("publicacion_tipo" IN ('p', 'reel', 'tv'));

ALTER TABLE "publicaciones_ig" ADD CONSTRAINT "chk_publicacion_orden_no_negativo"
  CHECK ("publicacion_orden" >= 0);
