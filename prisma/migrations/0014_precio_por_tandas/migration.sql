-- ===========================================================================
-- 0014 — El precio sube en cuatro tandas
--
-- Antes eran dos tramos (100 a $20.000, el resto a $25.000) mas la puerta.
-- Ahora son cuatro, y la primera abre mas barata que antes:
--
--      1 a   50   $15.000
--     51 a  200   $20.000   (150 entradas)
--    201 a  250   $25.000   (50 entradas)
--    251 en adelante        $30.000   (sin tope)
--    el dia del evento, en puerta      $30.000
--
-- No hace falta tocar nada el dia que se agote una tanda: `resolverEtapa`
-- suma los cupos en orden y devuelve la que corresponde segun cuantas
-- entradas se llevan tomadas. Sube solo.
--
-- Lo que cuenta para avanzar son las entradas TOMADAS, no las pagadas: una
-- reserva pendiente ya ocupa su lugar en la tanda. Es a proposito, para que
-- dos personas no se lleven el mismo precio cuando queda uno.
--
-- El precio de quien ya compro no se recalcula: quedo congelado en
-- `asistente_precio` al reservar.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. La etapa de puerta se corre al final.
--
-- Va primero y sola: ocupa el orden 3, que es justo donde entra una tanda
-- nueva, y el par (evento, orden) es unico. Si no se mueve antes, el INSERT
-- de mas abajo choca.
-- ---------------------------------------------------------------------------
UPDATE "etapas_venta" SET "etapa_orden" = 5
WHERE "etapa_en_puerta" = TRUE AND "etapa_orden" <> 5;

-- ---------------------------------------------------------------------------
-- 2. Las dos tandas que ya existian cambian de precio y de cupo.
-- ---------------------------------------------------------------------------
UPDATE "etapas_venta"
SET "etapa_nombre" = 'Primera tanda', "etapa_precio" = 15000, "etapa_cupo" = 50
WHERE "etapa_en_puerta" = FALSE AND "etapa_orden" = 1;

UPDATE "etapas_venta"
SET "etapa_nombre" = 'Segunda tanda', "etapa_precio" = 20000, "etapa_cupo" = 150
WHERE "etapa_en_puerta" = FALSE AND "etapa_orden" = 2;

-- ---------------------------------------------------------------------------
-- 3. Las dos tandas nuevas.
--
-- La cuarta no lleva cupo: es la de relleno, la que atiende todo lo que venga
-- despues de la 250. Sin una etapa sin tope el sitio se quedaria sin precio
-- al agotarse la tercera.
-- ---------------------------------------------------------------------------
INSERT INTO "etapas_venta"
  ("etapa_evento_id", "etapa_nombre", "etapa_precio", "etapa_cupo", "etapa_orden", "etapa_en_puerta", "created_by")
SELECT e."evento_id", v."nombre", v."precio", v."cupo", v."orden", FALSE, 1
FROM "eventos" e
CROSS JOIN (VALUES
  ('Tercera tanda', 25000, 50,   3),
  ('Cuarta tanda',  30000, NULL, 4)
) AS v("nombre", "precio", "cupo", "orden")
WHERE e."is_deleted" = FALSE
ON CONFLICT ("etapa_evento_id", "etapa_orden") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. El precio del tipo de entrada es solo el respaldo que se muestra si no
--    hubiera ninguna etapa. Se deja en el de apertura para que no quede
--    contando una cifra vieja.
--
--    La condicion es que el precio siga siendo el sembrado: eso prueba que
--    nadie lo cambio a mano, y si alguien le puso otro, se respeta.
--
--    Mirar `modified_by` aqui no sirve: la fila se marca como modificada al
--    tocar cualquier cosa del tipo de entrada —la casilla "Visible", por
--    ejemplo— y eso no dice nada sobre el precio.
-- ---------------------------------------------------------------------------
UPDATE "tipos_entrada"
SET "tipo_entrada_precio" = 15000
WHERE "tipo_entrada_precio" = 20000;

-- ---------------------------------------------------------------------------
-- 5. El FAQ tiene los precios escritos a mano y hay que moverlos con ellos.
--    Si no, el sitio cobra una cosa y explica otra.
--
--    `modified_by IS NULL` respeta cualquier respuesta que se haya editado
--    desde el panel: ahi manda la persona, no la migracion.
-- ---------------------------------------------------------------------------
UPDATE "preguntas_frecuentes" p
SET "pregunta_respuesta" = v."respuesta"
FROM (VALUES
  ('¿Cuánto cuesta y por qué sube el precio?',
   'El precio sube por tandas, según cuántas entradas se hayan vendido: las primeras 50 valen $15.000, las 150 siguientes $20.000, las 50 que vienen después $25.000, y de ahí en adelante $30.000. El mismo día del evento, en la puerta, cuesta $30.000. No hay tope de entradas, pero mientras antes compres, menos pagas.')
) AS v("texto", "respuesta")
WHERE p."pregunta_texto" = v."texto"
  AND p."modified_by" IS NULL;
