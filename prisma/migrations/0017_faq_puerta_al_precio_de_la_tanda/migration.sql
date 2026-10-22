-- ===========================================================================
-- 0017 — En la puerta se paga la tanda vigente
--
-- La 0016 apago la etapa de puerta, asi que la noche del evento se cobra la
-- tanda que vaya segun lo vendido: puede ser $15.000, $20.000, $25.000 o
-- $30.000. El FAQ "¿Puedo comprar en la puerta?" seguia prometiendo $30.000.
--
-- Igual que en la 0014 y la 0016: solo si la respuesta es la que dejo la 0006
-- y nadie la reescribio desde el panel.
-- ===========================================================================

UPDATE "preguntas_frecuentes"
SET "pregunta_respuesta" =
  'Sí, si estás en la lista de invitados. En la puerta pagas lo mismo que en el sitio: el precio de la tanda que vaya en ese momento. No hay tope de entradas, pero el precio sube a medida que se venden, así que conviene comprar antes.'
WHERE "pregunta_texto" = '¿Puedo comprar en la puerta?'
  AND "pregunta_respuesta" = 'Sí, si estás en la lista de invitados. En la puerta la entrada cuesta $30.000. No hay tope de entradas, pero comprar antes sale más barato.'
  AND "modified_by" IS NULL;
