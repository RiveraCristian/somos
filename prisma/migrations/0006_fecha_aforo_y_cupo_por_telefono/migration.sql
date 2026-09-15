-- ===========================================================================
-- 0006 — Fecha nueva, sin tope de aforo, una entrada por telefono
--
-- Cuatro correcciones de contenido que llegaron juntas:
--   1. El evento se corre al sabado 21 de noviembre de 2026, desde las 21:00.
--   2. Se elimina el tope de 200 cupos: no hay limite de entradas.
--   3. Cada numero invitado compra UNA entrada, no dos.
--   4. El Instagram pasa a ser @somos.vol3.
--
-- Las etapas de precio NO se tocan: seguian existiendo por precio, no por
-- aforo. Las primeras 100 entradas valen $20.000 y despues sube; eso es una
-- escalera de precios, no un limite de asistentes.
--
-- Todo lo de aqui es editable despues desde /admin.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1, 2 y 4. Evento
--
-- La conversion horaria la hace Postgres con el nombre de la zona: en
-- noviembre Chile esta en horario de verano y escribir el desfase a mano es
-- la clase de detalle que se equivoca en silencio.
--
-- El termino se fija a las 05:00 del domingo: son los cuatro bloques de dos
-- horas del line-up corridos junto con la hora de inicio.
-- ---------------------------------------------------------------------------
UPDATE "eventos"
SET "evento_fecha_inicio" =
      (TIMESTAMP '2026-11-21 21:00:00' AT TIME ZONE 'America/Santiago') AT TIME ZONE 'UTC',
    "evento_fecha_termino" =
      (TIMESTAMP '2026-11-22 05:00:00' AT TIME ZONE 'America/Santiago') AT TIME ZONE 'UTC',
    -- NULL = sin tope. La portada deja de anunciar un aforo.
    "evento_capacidad"  = NULL,
    "evento_instagram"  = 'somos.vol3'
WHERE "is_deleted" = FALSE;

-- Sin tope por tipo de entrada tampoco: con un cupo puesto, la vitrina
-- muestra "quedan N" y la compra corta al llegar al numero.
UPDATE "tipos_entrada" SET "tipo_entrada_cupo" = NULL;

-- ---------------------------------------------------------------------------
-- 3. Una entrada por telefono
--
-- El cupo vive en cada fila de la lista de invitados, asi que hay que bajar
-- las que ya estan ademas de cambiar el valor por defecto para las proximas.
-- Si alguien ya tiene mas de una entrada tomada con su numero, esto no se la
-- quita: solo impide sacar otra.
-- ---------------------------------------------------------------------------
ALTER TABLE "invitados" ALTER COLUMN "invitado_cupo" SET DEFAULT 1;

UPDATE "invitados" SET "invitado_cupo" = 1 WHERE "invitado_cupo" <> 1;

-- ---------------------------------------------------------------------------
-- Horarios del line-up, corridos una hora junto con el inicio
--
-- Solo los bloques que nadie edito a mano.
-- ---------------------------------------------------------------------------
UPDATE "artistas" a
SET "artista_hora_inicio"  = (v."inicio"  AT TIME ZONE 'America/Santiago') AT TIME ZONE 'UTC',
    "artista_hora_termino" = (v."termino" AT TIME ZONE 'America/Santiago') AT TIME ZONE 'UTC'
FROM (VALUES
  ('Deep house', TIMESTAMP '2026-11-21 21:00:00', TIMESTAMP '2026-11-21 23:00:00'),
  ('House',      TIMESTAMP '2026-11-21 23:00:00', TIMESTAMP '2026-11-22 01:00:00'),
  ('Tech house', TIMESTAMP '2026-11-22 01:00:00', TIMESTAMP '2026-11-22 03:00:00'),
  ('Reggaetón',  TIMESTAMP '2026-11-22 03:00:00', TIMESTAMP '2026-11-22 05:00:00')
) AS v("genero", "inicio", "termino")
WHERE a."artista_genero" = v."genero"
  AND a."modified_by" IS NULL;

-- ---------------------------------------------------------------------------
-- Preguntas frecuentes que quedaron desactualizadas
--
-- Se actualizan por texto de la pregunta y solo si nadie las edito: si alguien
-- reescribio una respuesta desde el panel, manda la suya.
-- ---------------------------------------------------------------------------
UPDATE "preguntas_frecuentes" p
SET "pregunta_respuesta" = v."respuesta"
FROM (VALUES
  ('¿Cualquiera puede comprar una entrada?',
   'No. SOMOS es estrictamente privada: solo compra quien está en la lista de invitados. Al comprar verificamos tu número de teléfono, y cada número habilitado da derecho a una entrada.'),

  ('¿Cuánto cuesta y por qué sube el precio?',
   'El precio sube por etapas: las primeras 100 entradas valen $20.000, desde la 101 valen $25.000, y el mismo día del evento cuestan $30.000 en la puerta. No hay tope de entradas, pero mientras antes compres, menos pagas.'),

  ('¿Cuándo y a qué hora es?',
   'Sábado 21 de noviembre de 2026. Las puertas abren a las 21:00 y la fiesta va hasta las 05:00.'),

  ('¿Puedo comprar en la puerta?',
   'Sí, si estás en la lista de invitados. En la puerta la entrada cuesta $30.000. No hay tope de entradas, pero comprar antes sale más barato.'),

  ('¿Quién responde por accidentes o cosas perdidas?',
   'SOMOS es una reunión privada, autogestionada y sin fines de lucro: lo que se recauda cubre producción y técnica. Cada asistente asume su propia seguridad, su consumo y sus pertenencias. La organización no se hace responsable por lesiones o accidentes derivados de la imprudencia propia o de terceros, ni por la pérdida, robo o daño de objetos personales, vehículos o vestuario. Al comprar tu entrada aceptas estas condiciones; están completas en la página de términos.')
) AS v("texto", "respuesta")
WHERE p."pregunta_texto" = v."texto"
  AND p."modified_by" IS NULL;
