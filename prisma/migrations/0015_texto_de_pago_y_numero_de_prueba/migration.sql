-- ===========================================================================
-- 0015 — El sitio explica el medio de pago que de verdad se usa
--
-- Dos textos publicos quedaron hablando de otra pasarela:
--
--   · La descripcion del evento decia "la pagas por transferencia".
--   · El FAQ decia "te llevamos a Flow para pagar".
--
-- Hoy se cobra con Mercado Pago (Checkout Pro). Quien lee eso antes de
-- comprar espera una cosa y se encuentra con otra justo en el momento de
-- pagar, que es donde mas caro sale perder la confianza.
--
-- Las dos van condicionadas al texto exacto que tenian: si alguien ya las
-- reescribio desde el panel, manda lo que escribio esa persona.
-- ===========================================================================

UPDATE "eventos"
SET "evento_descripcion" =
  'Compras tu entrada acá mismo y la pagas con tarjeta de crédito o débito. Apenas se confirma el pago te llega tu entrada con un QR único a tu correo. En la puerta lo escaneamos y listo.'
WHERE "evento_descripcion" =
  'Compras tu entrada acá mismo y la pagas por transferencia. Apenas se confirma el pago te llega tu entrada con un QR único a tu correo. En la puerta lo escaneamos y listo.';

UPDATE "preguntas_frecuentes" p
SET "pregunta_respuesta" = v."respuesta"
FROM (VALUES
  ('¿Cómo pago?',
   'Eliges tu entrada, dejas tu nombre y correo, y te la reservamos al tiro. Después te llevamos a Mercado Pago para pagar con tarjeta de crédito o débito; no necesitas tener cuenta. Apenas se confirma el pago vuelves al sitio, tu entrada con QR aparece en pantalla y te llega al correo.')
) AS v("texto", "respuesta")
WHERE p."pregunta_texto" = v."texto"
  AND p."modified_by" IS NULL;

-- ---------------------------------------------------------------------------
-- El numero de prueba del seed sale de la lista.
--
-- Lo puso el seed para que se pudiera probar la compra antes de tener
-- invitados de verdad. Ya estan los reales, y un numero que nadie controla
-- habilitado para comprar es un cupo regalado.
--
-- Se borra logico, como cualquier invitado: nunca DELETE fisico.
--
-- Solo si hay otros invitados cargados. En una instalacion nueva, donde ese
-- numero es lo unico que permite probar, se queda.
-- ---------------------------------------------------------------------------
UPDATE "invitados"
SET "is_deleted" = TRUE,
    "deleted_at" = NOW(),
    "deleted_by" = 1
WHERE "invitado_telefono" = '+56999999999'
  AND "is_deleted" = FALSE
  AND EXISTS (
    SELECT 1 FROM "invitados" otros
    WHERE otros."invitado_telefono" <> '+56999999999'
      AND otros."is_deleted" = FALSE
  );
