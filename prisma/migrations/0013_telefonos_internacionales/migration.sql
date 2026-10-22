-- ===========================================================================
-- 0013 — Telefonos internacionales en la lista de invitados
--
-- La restriccion original exigia que todo invitado fuera un celular chileno
-- (+56 y nueve digitos). Es lo que corresponde para la enorme mayoria, pero
-- deja afuera a los invitados que viven fuera de Chile: su numero no se puede
-- cargar, y sin estar en la lista no pueden comprar.
--
-- Se pasa a E.164, que es el formato internacional: un "+", un codigo de pais
-- que no parte en cero, y entre 8 y 15 digitos en total. Los chilenos siguen
-- cumpliendo exactamente igual, asi que ninguna fila existente se toca.
--
-- Lo que la restriccion sigue impidiendo, que es lo importante: que el mismo
-- numero entre escrito de dos formas distintas. El telefono es la credencial
-- de la invitacion y el limite es una entrada por numero; si "+56967331258" y
-- "967331258" pudieran convivir, la misma persona tendria dos cupos.
-- ===========================================================================

ALTER TABLE "invitados" DROP CONSTRAINT IF EXISTS "chk_invitado_telefono_formato";

ALTER TABLE "invitados" ADD CONSTRAINT "chk_invitado_telefono_formato"
  CHECK ("invitado_telefono" ~ '^\+[1-9][0-9]{7,14}$');
