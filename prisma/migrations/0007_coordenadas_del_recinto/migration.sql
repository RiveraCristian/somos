-- ===========================================================================
-- 0007 — Coordenadas del recinto
--
-- El lugar es rural y no tiene una direccion postal que sirva para llegar.
-- Con el pin exacto, "Cómo llegar" abre el mapa en la puerta; con una
-- busqueda por texto puede caer a kilometros, de noche y en el campo.
--
-- Son datos de ubicacion: viajan por el mismo camino que la direccion, o sea
-- solo a quien ya tiene su entrada. La consulta del sitio publico los omite.
-- ===========================================================================

ALTER TABLE "eventos" ADD COLUMN "evento_latitud"  DOUBLE PRECISION;
ALTER TABLE "eventos" ADD COLUMN "evento_longitud" DOUBLE PRECISION;

-- Un cero por error en cualquiera de las dos manda a la gente al Golfo de
-- Guinea. Se exige que vengan juntas y dentro de rango.
ALTER TABLE "eventos" ADD CONSTRAINT "chk_evento_coordenadas_completas"
  CHECK (
    ("evento_latitud" IS NULL AND "evento_longitud" IS NULL)
    OR ("evento_latitud" IS NOT NULL AND "evento_longitud" IS NOT NULL)
  );

ALTER TABLE "eventos" ADD CONSTRAINT "chk_evento_latitud_rango"
  CHECK ("evento_latitud" IS NULL OR ("evento_latitud" BETWEEN -90 AND 90));

ALTER TABLE "eventos" ADD CONSTRAINT "chk_evento_longitud_rango"
  CHECK ("evento_longitud" IS NULL OR ("evento_longitud" BETWEEN -180 AND 180));

-- Ubicacion de SOMOS: a unos 5 km del centro de Talca.
UPDATE "eventos"
SET "evento_latitud"  = -35.438877,
    "evento_longitud" = -71.602657
WHERE "is_deleted" = FALSE
  AND "evento_latitud" IS NULL;
