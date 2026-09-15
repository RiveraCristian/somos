-- ===========================================================================
-- 0005 — Fecha del evento, bloques de la noche y preguntas frecuentes
--
-- Va en una migracion y no en el seed porque el evento YA existe: los upsert
-- del seed llevan `update: {}` a proposito, para no pisar lo que se edite
-- desde el panel, asi que nunca aplicarian este contenido.
--
-- Una migracion corre exactamente una vez por base de datos, que es justo la
-- semantica que se necesita: aplicar esto ahora sin arriesgarse a repisarlo en
-- cada despliegue.
--
-- Todo lo de aqui es editable despues desde /admin.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Fecha y hora
--
-- Jueves 19 de noviembre de 2026, 20:00, hora de Chile.
--
-- La conversion la hace Postgres con el nombre de la zona y no a mano: en
-- noviembre Chile esta en horario de verano (UTC-3) y escribir el desfase
-- fijo es la clase de detalle que se equivoca en silencio. La columna es
-- TIMESTAMP sin zona y la aplicacion la interpreta como UTC.
--
-- Solo si seguia sin fecha: si alguien ya la cargo desde el panel, manda esa.
-- ---------------------------------------------------------------------------
UPDATE "eventos"
SET "evento_fecha_inicio" =
      (TIMESTAMP '2026-11-19 20:00:00' AT TIME ZONE 'America/Santiago') AT TIME ZONE 'UTC',
    "evento_fecha_termino" =
      (TIMESTAMP '2026-11-20 04:00:00' AT TIME ZONE 'America/Santiago') AT TIME ZONE 'UTC'
WHERE "is_deleted" = FALSE
  AND "evento_fecha_inicio" IS NULL;

-- ---------------------------------------------------------------------------
-- Bloques de la noche
--
-- Se borran solo los que dejo el seed y nadie toco (created_by = 1 es el
-- usuario "Sistema" y modified_by nulo significa que ninguna persona los
-- edito). Si alguien ya cargo el line-up de verdad, esto no lo roza.
--
-- La insercion se guarda fila por fila y no con un "si no hay ninguno": con
-- esa guarda, un solo registro editado a mano bastaba para que no entrara
-- NINGUNO de los nuevos, dejando la lista a medias despues del DELETE. Asi,
-- lo editado sobrevive y lo que falta se agrega.
-- ---------------------------------------------------------------------------
DELETE FROM "artistas"
WHERE "created_by" = 1
  AND "modified_by" IS NULL
  AND "artista_nombre" = 'Por confirmar';

INSERT INTO "artistas" (
  "artista_evento_id", "artista_nombre", "artista_genero", "artista_descripcion",
  "artista_hora_inicio", "artista_hora_termino", "artista_orden", "artista_destacado",
  "created_by"
)
SELECT
  e."evento_id", 'Por confirmar', v."genero", v."descripcion",
  (v."inicio" AT TIME ZONE 'America/Santiago') AT TIME ZONE 'UTC',
  (v."termino" AT TIME ZONE 'America/Santiago') AT TIME ZONE 'UTC',
  v."orden", v."destacado", 1
FROM "eventos" e
CROSS JOIN (VALUES
  ('Deep house',  'Apertura. La pista se llena de a poco.',
   TIMESTAMP '2026-11-19 20:00:00', TIMESTAMP '2026-11-19 22:00:00', 1, FALSE),
  ('House',       NULL,
   TIMESTAMP '2026-11-19 22:00:00', TIMESTAMP '2026-11-20 00:00:00', 2, FALSE),
  ('Tech house',  'El punto mas alto de la noche.',
   TIMESTAMP '2026-11-20 00:00:00', TIMESTAMP '2026-11-20 02:00:00', 3, FALSE),
  ('Reggaetón',   'Cierre.',
   TIMESTAMP '2026-11-20 02:00:00', TIMESTAMP '2026-11-20 04:00:00', 4, TRUE)
) AS v("genero", "descripcion", "inicio", "termino", "orden", "destacado")
WHERE e."is_deleted" = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM "artistas" a
    WHERE a."artista_evento_id" = e."evento_id"
      AND a."artista_genero" = v."genero"
  );

-- ---------------------------------------------------------------------------
-- Preguntas frecuentes
--
-- Reemplazan a las cinco del seed. Mismo cuidado que arriba: solo se borran
-- las que nadie edito, y cada una se inserta solo si no hay ya otra con ese
-- mismo texto. Nunca se pierde contenido escrito por una persona.
-- ---------------------------------------------------------------------------
DELETE FROM "preguntas_frecuentes"
WHERE "created_by" = 1
  AND "modified_by" IS NULL;

INSERT INTO "preguntas_frecuentes" (
  "pregunta_evento_id", "pregunta_texto", "pregunta_respuesta", "pregunta_orden", "created_by"
)
SELECT e."evento_id", v."texto", v."respuesta", v."orden", 1
FROM "eventos" e
CROSS JOIN (VALUES
  ('¿Cualquiera puede comprar una entrada?',
   'No. SOMOS es estrictamente privada: solo compra quien está en la lista de invitados. Al comprar verificamos tu número de teléfono, y cada número habilitado puede sacar hasta dos entradas — la tuya y la de alguien que traigas.',
   1),

  ('¿Cuánto cuesta y por qué sube el precio?',
   'El aforo es de 200 cupos y el precio sube por etapas: las primeras 100 entradas valen $20.000, desde la 101 valen $25.000, y el mismo día del evento cuestan $30.000 en la puerta. Mientras antes compres, menos pagas.',
   2),

  ('¿Cómo pago?',
   'Eliges tu entrada, dejas tu nombre y correo, y te la reservamos al tiro. Después pagas con Fintoc: eliges tu banco y apruebas la transferencia sin salir de la página. Si tu banco no aparece o algo falla, puedes transferir por tu cuenta y subir la captura del comprobante. Apenas se confirma el pago, tu entrada con QR aparece en pantalla y te llega al correo.',
   3),

  ('¿Cuándo y a qué hora es?',
   'Jueves 19 de noviembre de 2026. Las puertas abren a las 20:00 y la fiesta va hasta las 04:00.',
   4),

  ('¿Dónde es?',
   'En un recinto privado en Talca, Región del Maule. La dirección exacta no se publica: te llega junto con tu entrada, en tu correo de confirmación y en tu página de entrada, con el enlace a Google Maps. Es parte de lo que mantiene la fiesta privada, así que te pedimos no compartirla.',
   5),

  ('¿Qué música suena?',
   'La noche parte en deep house, sigue en house, sube a tech house y cierra en reggaetón. Los nombres del line-up se van confirmando a medida que se acerca la fecha.',
   6),

  ('¿Cómo entro el día del evento?',
   'Con el código QR que recibiste por correo, en el teléfono o impreso. En la puerta lo escaneamos y listo. Cada entrada es personal, nominal y el QR sirve una sola vez: si se lo pasas a alguien, esa persona entra y tú te quedas afuera.',
   7),

  ('¿Puedo comprar en la puerta?',
   'Sí, pero solo si quedan cupos de los 200 y si estás en la lista de invitados. En la puerta la entrada cuesta $30.000. Como el aforo es reducido, conviene asegurar el cupo antes.',
   8),

  ('¿Hay edad mínima y derecho de admisión?',
   'La fiesta es solo para mayores de 18 años y se verifica con cédula en la puerta. La organización se reserva el derecho de admisión y permanencia: no se permite el ingreso ni la permanencia, sin derecho a reembolso, a quien tenga conductas agresivas, moleste a otros asistentes o esté en un estado que ponga en riesgo la seguridad común.',
   9),

  ('¿Quién responde por accidentes o cosas perdidas?',
   'SOMOS es una reunión privada, autogestionada y sin fines de lucro: lo que se recauda cubre producción y técnica. Cada asistente asume su propia seguridad, su consumo y sus pertenencias. La organización no se hace responsable por lesiones o accidentes derivados de la imprudencia propia o de terceros, ni por la pérdida, robo o daño de objetos personales, vehículos o vestuario. Al comprar tu entrada aceptas estas condiciones; están completas en la página de términos.',
   10)
) AS v("texto", "respuesta", "orden")
WHERE e."is_deleted" = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM "preguntas_frecuentes" p
    WHERE p."pregunta_evento_id" = e."evento_id"
      AND p."pregunta_texto" = v."texto"
  );

-- ---------------------------------------------------------------------------
-- El lugar es secreto: si quedo un venue de relleno, se limpia.
-- El sitio publico muestra "Ubicación secreta" cuando esto es NULL.
-- ---------------------------------------------------------------------------
UPDATE "eventos"
SET "evento_venue" = NULL
WHERE "is_deleted" = FALSE
  AND "evento_venue" IN ('Por confirmar', 'Lugar por confirmar');
