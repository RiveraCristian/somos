-- ===========================================================================
-- 0018 — Pausar la venta sin cerrar el sitio
--
-- Hace falta poder decir "por ahora no hay entradas" sin romper nada de lo
-- que ya esta vendido ni bajar la pagina.
--
-- Por que una columna propia y no algo que ya existia:
--
--   · `evento_estado = 'cerrado'` saca al evento de la consulta publica
--     (datos.ts solo trae 'publicado' y 'borrador'), asi que tumbaria la
--     portada entera, no solo la venta.
--
--   · `tipo_entrada_activo = FALSE` sirve, pero el sitio lo traduce a
--     "Entradas agotadas", que dice algo distinto —y falso— de lo que pasa.
--     Agotado es que no quedan; pausado es que todavia no se abren.
--
-- Lo que esta pausa NO toca, a proposito: quien ya pago conserva su entrada,
-- su QR, su pagina privada y su correo, y la puerta se la escanea igual. Se
-- cierra la venta, no el evento.
-- ===========================================================================

ALTER TABLE "eventos"
  ADD COLUMN IF NOT EXISTS "evento_ventas_abiertas" BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN "eventos"."evento_ventas_abiertas" IS
  'FALSE pausa la venta: el sitio avisa que no hay entradas habilitadas. No afecta a las ya vendidas.';

-- Se abre y se cierra desde /admin/evento. Queda cerrada ahora.
UPDATE "eventos"
SET "evento_ventas_abiertas" = FALSE
WHERE "is_deleted" = FALSE;
