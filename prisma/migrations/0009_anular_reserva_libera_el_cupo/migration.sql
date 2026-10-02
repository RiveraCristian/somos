-- ===========================================================================
-- 0009 — Anular una reserva tiene que liberar el cupo de verdad
--
-- El problema: la reserva se crea ANTES de pagar y ya ocupa lugar. Con una
-- entrada por telefono, alguien que abandona el pago —cierra la pestana, le
-- rechazan la tarjeta— queda bloqueado: "Ese numero ya tiene su entrada".
--
-- El conteo por telefono ya ignora las anuladas, asi que anular liberaba el
-- cupo del numero. Pero el correo NO: este indice unico no distinguia estado,
-- y la persona seguia sin poder reservar de nuevo con su mismo correo. El
-- boton de anular habria parecido funcionar sin funcionar.
--
-- La solucion es que el indice solo cuente las reservas vivas. Es el mismo
-- patron que ya usa idx_etapa_puerta_unica: un unique parcial en SQL, que
-- Prisma no sabe expresar en el schema.
-- ===========================================================================

DROP INDEX "asistentes_asistente_evento_id_asistente_correo_key";

CREATE UNIQUE INDEX "idx_asistente_correo_vivo"
  ON "asistentes" ("asistente_evento_id", "asistente_correo")
  WHERE "is_deleted" = FALSE AND "asistente_estado" <> 'anulado';

-- El indice de arriba ya sirve para buscar por correo mientras la reserva este
-- viva, pero el panel busca tambien entre las anuladas. Sin esto, esa busqueda
-- recorre la tabla entera.
CREATE INDEX "asistentes_evento_correo_idx"
  ON "asistentes" ("asistente_evento_id", "asistente_correo");
