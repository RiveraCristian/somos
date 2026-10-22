-- ===========================================================================
-- 0016 — Sin entrada en puerta
--
-- Sale la etapa "En puerta" ($30.000). El dia del evento ya no hay un precio
-- aparte: sigue mandando la tanda que corresponda segun cuanto se lleva
-- vendido, igual que cualquier otro dia.
--
-- La etapa se desactiva, no se borra: `listarEtapas` solo lee las activas, y
-- si hay que volver a ponerla basta con prenderla de nuevo. Las entradas que
-- se hubieran vendido a ese precio no cambian; su precio quedo congelado en
-- `asistente_precio`.
-- ===========================================================================

UPDATE "etapas_venta"
SET "etapa_activa" = FALSE,
    "modified_by" = 1
WHERE "etapa_en_puerta" = TRUE
  AND "etapa_activa" = TRUE;

-- ---------------------------------------------------------------------------
-- El FAQ decia cuanto costaba en la puerta. Se corrige solo si nadie la
-- reescribio desde el panel (`modified_by IS NULL`), igual que en la 0014.
-- ---------------------------------------------------------------------------
UPDATE "preguntas_frecuentes" p
SET "pregunta_respuesta" = v."respuesta"
FROM (VALUES
  ('¿Cuánto cuesta y por qué sube el precio?',
   'El precio sube por tandas, según cuántas entradas se hayan vendido: las primeras 50 valen $15.000, las 150 siguientes $20.000, las 50 que vienen después $25.000, y de ahí en adelante $30.000. No hay tope de entradas, pero mientras antes compres, menos pagas.')
) AS v("texto", "respuesta")
WHERE p."pregunta_texto" = v."texto"
  AND p."modified_by" IS NULL;
