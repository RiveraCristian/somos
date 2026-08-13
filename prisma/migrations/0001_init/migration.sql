-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "usuarios" (
    "usuario_id" SERIAL NOT NULL,
    "usuario_correo" VARCHAR(255) NOT NULL,
    "usuario_nombre" VARCHAR(255) NOT NULL,
    "usuario_password" VARCHAR(255),
    "usuario_departamento" VARCHAR(100),
    "usuario_rol" VARCHAR(50) NOT NULL,
    "usuario_activo" BOOLEAN NOT NULL DEFAULT true,
    "usuario_proveedor_auth" VARCHAR(50) NOT NULL DEFAULT 'local',
    "usuario_proveedor_id" VARCHAR(255),
    "usuario_fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_fecha_desactivacion" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("usuario_id")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "sesion_id" SERIAL NOT NULL,
    "sesion_usuario_id" INTEGER NOT NULL,
    "sesion_token_hash" VARCHAR(255) NOT NULL,
    "sesion_expira_en" TIMESTAMP(3) NOT NULL,
    "sesion_revocada" BOOLEAN NOT NULL DEFAULT false,
    "sesion_ip" VARCHAR(45),
    "sesion_user_agent" VARCHAR(300),
    "sesion_fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("sesion_id")
);

-- CreateTable
CREATE TABLE "eventos" (
    "evento_id" SERIAL NOT NULL,
    "evento_slug" VARCHAR(120) NOT NULL,
    "evento_nombre" VARCHAR(200) NOT NULL,
    "evento_lema" VARCHAR(300),
    "evento_descripcion" TEXT,
    "evento_fecha_inicio" TIMESTAMP(3),
    "evento_fecha_termino" TIMESTAMP(3),
    "evento_venue" VARCHAR(200),
    "evento_direccion" VARCHAR(300),
    "evento_ciudad" VARCHAR(120) NOT NULL,
    "evento_region" VARCHAR(120),
    "evento_mapa_url" VARCHAR(500),
    "evento_capacidad" INTEGER,
    "evento_estado" VARCHAR(30) NOT NULL DEFAULT 'borrador',
    "evento_instagram" VARCHAR(120),
    "evento_whatsapp" VARCHAR(60),
    "evento_tenpo_nombre" VARCHAR(200),
    "evento_tenpo_rut" VARCHAR(20),
    "evento_tenpo_correo" VARCHAR(255),
    "evento_tenpo_banco" VARCHAR(120),
    "evento_tenpo_tipo_cuenta" VARCHAR(60),
    "evento_tenpo_cuenta" VARCHAR(50),
    "evento_tenpo_qr_url" VARCHAR(500),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_by" INTEGER,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" INTEGER,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("evento_id")
);

-- CreateTable
CREATE TABLE "tipos_entrada" (
    "tipo_entrada_id" SERIAL NOT NULL,
    "tipo_entrada_evento_id" INTEGER NOT NULL,
    "tipo_entrada_nombre" VARCHAR(80) NOT NULL,
    "tipo_entrada_slug" VARCHAR(80) NOT NULL,
    "tipo_entrada_descripcion" VARCHAR(300),
    "tipo_entrada_precio" INTEGER NOT NULL,
    "tipo_entrada_cupo" INTEGER,
    "tipo_entrada_orden" INTEGER NOT NULL DEFAULT 0,
    "tipo_entrada_activo" BOOLEAN NOT NULL DEFAULT true,
    "tipo_entrada_color" VARCHAR(20) NOT NULL DEFAULT 'cyan',
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_by" INTEGER,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_entrada_pkey" PRIMARY KEY ("tipo_entrada_id")
);

-- CreateTable
CREATE TABLE "artistas" (
    "artista_id" SERIAL NOT NULL,
    "artista_evento_id" INTEGER NOT NULL,
    "artista_nombre" VARCHAR(120) NOT NULL,
    "artista_genero" VARCHAR(80),
    "artista_descripcion" VARCHAR(400),
    "artista_hora_inicio" TIMESTAMP(3),
    "artista_hora_termino" TIMESTAMP(3),
    "artista_instagram" VARCHAR(120),
    "artista_imagen_url" VARCHAR(500),
    "artista_orden" INTEGER NOT NULL DEFAULT 0,
    "artista_destacado" BOOLEAN NOT NULL DEFAULT false,
    "artista_activo" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_by" INTEGER,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artistas_pkey" PRIMARY KEY ("artista_id")
);

-- CreateTable
CREATE TABLE "preguntas_frecuentes" (
    "pregunta_id" SERIAL NOT NULL,
    "pregunta_evento_id" INTEGER NOT NULL,
    "pregunta_texto" VARCHAR(300) NOT NULL,
    "pregunta_respuesta" TEXT NOT NULL,
    "pregunta_orden" INTEGER NOT NULL DEFAULT 0,
    "pregunta_activa" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_by" INTEGER,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preguntas_frecuentes_pkey" PRIMARY KEY ("pregunta_id")
);

-- CreateTable
CREATE TABLE "asistentes" (
    "asistente_id" SERIAL NOT NULL,
    "asistente_evento_id" INTEGER NOT NULL,
    "asistente_tipo_entrada_id" INTEGER NOT NULL,
    "asistente_nombre" VARCHAR(200) NOT NULL,
    "asistente_correo" VARCHAR(255) NOT NULL,
    "asistente_telefono" VARCHAR(30),
    "asistente_instagram" VARCHAR(80),
    "asistente_mensaje" VARCHAR(500),
    "asistente_token" VARCHAR(64) NOT NULL,
    "asistente_estado" VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    "asistente_monto_pagado" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_by" INTEGER,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" INTEGER,

    CONSTRAINT "asistentes_pkey" PRIMARY KEY ("asistente_id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "pago_id" SERIAL NOT NULL,
    "pago_asistente_id" INTEGER NOT NULL,
    "pago_monto" INTEGER NOT NULL,
    "pago_metodo" VARCHAR(30) NOT NULL DEFAULT 'tenpo',
    "pago_estado" VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    "pago_comprobante_archivo" VARCHAR(300),
    "pago_comprobante_nombre" VARCHAR(300),
    "pago_comprobante_mime" VARCHAR(120),
    "pago_comprobante_tamano" INTEGER,
    "pago_referencia" VARCHAR(120),
    "pago_mensaje" VARCHAR(500),
    "pago_fecha_declarado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pago_fecha_revisado" TIMESTAMP(3),
    "pago_revisado_por" INTEGER,
    "pago_motivo_rechazo" VARCHAR(300),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_by" INTEGER,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" INTEGER,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("pago_id")
);

-- CreateTable
CREATE TABLE "entradas" (
    "entrada_id" SERIAL NOT NULL,
    "entrada_asistente_id" INTEGER NOT NULL,
    "entrada_tipo_entrada_id" INTEGER NOT NULL,
    "entrada_codigo" VARCHAR(24) NOT NULL,
    "entrada_token" VARCHAR(64) NOT NULL,
    "entrada_estado" VARCHAR(20) NOT NULL DEFAULT 'valida',
    "entrada_fecha_emision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entrada_fecha_quemada" TIMESTAMP(3),
    "entrada_quemada_por" INTEGER,
    "entrada_correo_enviado" BOOLEAN NOT NULL DEFAULT false,
    "entrada_correo_fecha" TIMESTAMP(3),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_by" INTEGER,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" INTEGER,

    CONSTRAINT "entradas_pkey" PRIMARY KEY ("entrada_id")
);

-- CreateTable
CREATE TABLE "escaneos" (
    "escaneo_id" SERIAL NOT NULL,
    "escaneo_entrada_id" INTEGER,
    "escaneo_codigo" VARCHAR(120) NOT NULL,
    "escaneo_resultado" VARCHAR(30) NOT NULL,
    "escaneo_usuario_id" INTEGER NOT NULL,
    "escaneo_fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "escaneo_ip" VARCHAR(45),
    "escaneo_user_agent" VARCHAR(300),

    CONSTRAINT "escaneos_pkey" PRIMARY KEY ("escaneo_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_usuario_correo_key" ON "usuarios"("usuario_correo");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_sesion_token_hash_key" ON "sesiones"("sesion_token_hash");

-- CreateIndex
CREATE INDEX "sesiones_sesion_usuario_id_idx" ON "sesiones"("sesion_usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_evento_slug_key" ON "eventos"("evento_slug");

-- CreateIndex
CREATE INDEX "tipos_entrada_tipo_entrada_evento_id_idx" ON "tipos_entrada"("tipo_entrada_evento_id");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_entrada_tipo_entrada_evento_id_tipo_entrada_slug_key" ON "tipos_entrada"("tipo_entrada_evento_id", "tipo_entrada_slug");

-- CreateIndex
CREATE INDEX "artistas_artista_evento_id_idx" ON "artistas"("artista_evento_id");

-- CreateIndex
CREATE INDEX "preguntas_frecuentes_pregunta_evento_id_idx" ON "preguntas_frecuentes"("pregunta_evento_id");

-- CreateIndex
CREATE UNIQUE INDEX "asistentes_asistente_token_key" ON "asistentes"("asistente_token");

-- CreateIndex
CREATE INDEX "asistentes_asistente_evento_id_idx" ON "asistentes"("asistente_evento_id");

-- CreateIndex
CREATE INDEX "asistentes_asistente_estado_idx" ON "asistentes"("asistente_estado");

-- CreateIndex
CREATE UNIQUE INDEX "asistentes_asistente_evento_id_asistente_correo_key" ON "asistentes"("asistente_evento_id", "asistente_correo");

-- CreateIndex
CREATE INDEX "pagos_pago_asistente_id_idx" ON "pagos"("pago_asistente_id");

-- CreateIndex
CREATE INDEX "pagos_pago_estado_idx" ON "pagos"("pago_estado");

-- CreateIndex
CREATE UNIQUE INDEX "entradas_entrada_asistente_id_key" ON "entradas"("entrada_asistente_id");

-- CreateIndex
CREATE UNIQUE INDEX "entradas_entrada_codigo_key" ON "entradas"("entrada_codigo");

-- CreateIndex
CREATE UNIQUE INDEX "entradas_entrada_token_key" ON "entradas"("entrada_token");

-- CreateIndex
CREATE INDEX "entradas_entrada_estado_idx" ON "entradas"("entrada_estado");

-- CreateIndex
CREATE INDEX "escaneos_escaneo_fecha_idx" ON "escaneos"("escaneo_fecha");

-- CreateIndex
CREATE INDEX "escaneos_escaneo_entrada_id_idx" ON "escaneos"("escaneo_entrada_id");

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_sesion_usuario_id_fkey" FOREIGN KEY ("sesion_usuario_id") REFERENCES "usuarios"("usuario_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("usuario_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_modified_by_fkey" FOREIGN KEY ("modified_by") REFERENCES "usuarios"("usuario_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("usuario_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipos_entrada" ADD CONSTRAINT "tipos_entrada_tipo_entrada_evento_id_fkey" FOREIGN KEY ("tipo_entrada_evento_id") REFERENCES "eventos"("evento_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipos_entrada" ADD CONSTRAINT "tipos_entrada_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("usuario_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipos_entrada" ADD CONSTRAINT "tipos_entrada_modified_by_fkey" FOREIGN KEY ("modified_by") REFERENCES "usuarios"("usuario_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artistas" ADD CONSTRAINT "artistas_artista_evento_id_fkey" FOREIGN KEY ("artista_evento_id") REFERENCES "eventos"("evento_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artistas" ADD CONSTRAINT "artistas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("usuario_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artistas" ADD CONSTRAINT "artistas_modified_by_fkey" FOREIGN KEY ("modified_by") REFERENCES "usuarios"("usuario_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preguntas_frecuentes" ADD CONSTRAINT "preguntas_frecuentes_pregunta_evento_id_fkey" FOREIGN KEY ("pregunta_evento_id") REFERENCES "eventos"("evento_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preguntas_frecuentes" ADD CONSTRAINT "preguntas_frecuentes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("usuario_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preguntas_frecuentes" ADD CONSTRAINT "preguntas_frecuentes_modified_by_fkey" FOREIGN KEY ("modified_by") REFERENCES "usuarios"("usuario_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistentes" ADD CONSTRAINT "asistentes_asistente_evento_id_fkey" FOREIGN KEY ("asistente_evento_id") REFERENCES "eventos"("evento_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistentes" ADD CONSTRAINT "asistentes_asistente_tipo_entrada_id_fkey" FOREIGN KEY ("asistente_tipo_entrada_id") REFERENCES "tipos_entrada"("tipo_entrada_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistentes" ADD CONSTRAINT "asistentes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("usuario_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistentes" ADD CONSTRAINT "asistentes_modified_by_fkey" FOREIGN KEY ("modified_by") REFERENCES "usuarios"("usuario_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistentes" ADD CONSTRAINT "asistentes_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("usuario_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pago_asistente_id_fkey" FOREIGN KEY ("pago_asistente_id") REFERENCES "asistentes"("asistente_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pago_revisado_por_fkey" FOREIGN KEY ("pago_revisado_por") REFERENCES "usuarios"("usuario_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("usuario_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_modified_by_fkey" FOREIGN KEY ("modified_by") REFERENCES "usuarios"("usuario_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("usuario_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas" ADD CONSTRAINT "entradas_entrada_asistente_id_fkey" FOREIGN KEY ("entrada_asistente_id") REFERENCES "asistentes"("asistente_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas" ADD CONSTRAINT "entradas_entrada_tipo_entrada_id_fkey" FOREIGN KEY ("entrada_tipo_entrada_id") REFERENCES "tipos_entrada"("tipo_entrada_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas" ADD CONSTRAINT "entradas_entrada_quemada_por_fkey" FOREIGN KEY ("entrada_quemada_por") REFERENCES "usuarios"("usuario_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas" ADD CONSTRAINT "entradas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("usuario_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas" ADD CONSTRAINT "entradas_modified_by_fkey" FOREIGN KEY ("modified_by") REFERENCES "usuarios"("usuario_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas" ADD CONSTRAINT "entradas_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("usuario_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escaneos" ADD CONSTRAINT "escaneos_escaneo_entrada_id_fkey" FOREIGN KEY ("escaneo_entrada_id") REFERENCES "entradas"("entrada_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escaneos" ADD CONSTRAINT "escaneos_escaneo_usuario_id_fkey" FOREIGN KEY ("escaneo_usuario_id") REFERENCES "usuarios"("usuario_id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ===========================================================================
-- Gobernanza de datos (CLAUDE.md seccion 4)
-- ===========================================================================

-- --- Funcion global que mantiene modified_at ------------------------------
-- Las columnas son TIMESTAMP sin zona y Prisma siempre escribe UTC. Un NOW()
-- pelado se convertiria a la zona de la sesion (UTC-4 en Chile) y dejaria
-- modified_at cuatro horas antes que created_at. Por eso se fija UTC explicito.
CREATE OR REPLACE FUNCTION set_modified_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modified_at = (NOW() AT TIME ZONE 'UTC');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --- Trigger de modified_at por cada tabla de negocio ---------------------
CREATE TRIGGER trg_set_modified_at_eventos
BEFORE UPDATE ON "eventos"
FOR EACH ROW EXECUTE FUNCTION set_modified_at();

CREATE TRIGGER trg_set_modified_at_tipos_entrada
BEFORE UPDATE ON "tipos_entrada"
FOR EACH ROW EXECUTE FUNCTION set_modified_at();

CREATE TRIGGER trg_set_modified_at_artistas
BEFORE UPDATE ON "artistas"
FOR EACH ROW EXECUTE FUNCTION set_modified_at();

CREATE TRIGGER trg_set_modified_at_preguntas_frecuentes
BEFORE UPDATE ON "preguntas_frecuentes"
FOR EACH ROW EXECUTE FUNCTION set_modified_at();

CREATE TRIGGER trg_set_modified_at_asistentes
BEFORE UPDATE ON "asistentes"
FOR EACH ROW EXECUTE FUNCTION set_modified_at();

CREATE TRIGGER trg_set_modified_at_pagos
BEFORE UPDATE ON "pagos"
FOR EACH ROW EXECUTE FUNCTION set_modified_at();

CREATE TRIGGER trg_set_modified_at_entradas
BEFORE UPDATE ON "entradas"
FOR EACH ROW EXECUTE FUNCTION set_modified_at();

-- --- Bitacora de puerta inmutable ----------------------------------------
-- Los escaneos son evidencia de control de acceso: no se editan ni se borran.
CREATE OR REPLACE FUNCTION escaneos_solo_insert()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'La tabla escaneos es de solo insercion (bitacora inmutable)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_escaneos_inmutable
BEFORE UPDATE OR DELETE ON "escaneos"
FOR EACH ROW EXECUTE FUNCTION escaneos_solo_insert();

-- --- Dominios controlados -------------------------------------------------
ALTER TABLE "usuarios" ADD CONSTRAINT "chk_usuario_rol"
  CHECK ("usuario_rol" IN ('Admin', 'DataOwner', 'Steward', 'Analyst', 'Viewer'));

ALTER TABLE "usuarios" ADD CONSTRAINT "chk_usuario_proveedor_auth"
  CHECK ("usuario_proveedor_auth" IN ('local', 'google'));

ALTER TABLE "eventos" ADD CONSTRAINT "chk_evento_estado"
  CHECK ("evento_estado" IN ('borrador', 'publicado', 'cerrado', 'finalizado'));

ALTER TABLE "tipos_entrada" ADD CONSTRAINT "chk_tipo_entrada_precio"
  CHECK ("tipo_entrada_precio" >= 0);

ALTER TABLE "tipos_entrada" ADD CONSTRAINT "chk_tipo_entrada_cupo"
  CHECK ("tipo_entrada_cupo" IS NULL OR "tipo_entrada_cupo" > 0);

ALTER TABLE "tipos_entrada" ADD CONSTRAINT "chk_tipo_entrada_color"
  CHECK ("tipo_entrada_color" IN ('cyan', 'magenta', 'violeta', 'lima'));

ALTER TABLE "asistentes" ADD CONSTRAINT "chk_asistente_estado"
  CHECK ("asistente_estado" IN ('pendiente', 'confirmado', 'anulado'));

ALTER TABLE "asistentes" ADD CONSTRAINT "chk_asistente_monto_pagado"
  CHECK ("asistente_monto_pagado" >= 0);

ALTER TABLE "pagos" ADD CONSTRAINT "chk_pago_estado"
  CHECK ("pago_estado" IN ('pendiente', 'confirmado', 'rechazado'));

ALTER TABLE "pagos" ADD CONSTRAINT "chk_pago_metodo"
  CHECK ("pago_metodo" IN ('tenpo', 'transferencia', 'efectivo', 'otro'));

ALTER TABLE "pagos" ADD CONSTRAINT "chk_pago_monto"
  CHECK ("pago_monto" > 0);

ALTER TABLE "entradas" ADD CONSTRAINT "chk_entrada_estado"
  CHECK ("entrada_estado" IN ('valida', 'quemada', 'anulada'));

ALTER TABLE "escaneos" ADD CONSTRAINT "chk_escaneo_resultado"
  CHECK ("escaneo_resultado" IN ('autorizado', 'ya_usada', 'no_existe', 'anulada'));

-- --- Coherencia del borrado logico ---------------------------------------
-- Si is_deleted = TRUE, deleted_at y deleted_by no pueden quedar vacios.
ALTER TABLE "eventos" ADD CONSTRAINT "chk_evento_soft_delete"
  CHECK ("is_deleted" = FALSE OR ("deleted_at" IS NOT NULL AND "deleted_by" IS NOT NULL));

ALTER TABLE "asistentes" ADD CONSTRAINT "chk_asistente_soft_delete"
  CHECK ("is_deleted" = FALSE OR ("deleted_at" IS NOT NULL AND "deleted_by" IS NOT NULL));

ALTER TABLE "pagos" ADD CONSTRAINT "chk_pago_soft_delete"
  CHECK ("is_deleted" = FALSE OR ("deleted_at" IS NOT NULL AND "deleted_by" IS NOT NULL));

ALTER TABLE "entradas" ADD CONSTRAINT "chk_entrada_soft_delete"
  CHECK ("is_deleted" = FALSE OR ("deleted_at" IS NOT NULL AND "deleted_by" IS NOT NULL));

-- --- Indices parciales para las lecturas que filtran is_deleted = FALSE ---
CREATE INDEX "idx_asistentes_vigentes"
  ON "asistentes" ("asistente_evento_id", "asistente_estado")
  WHERE "is_deleted" = FALSE;

CREATE INDEX "idx_pagos_pendientes"
  ON "pagos" ("pago_estado", "pago_fecha_declarado")
  WHERE "is_deleted" = FALSE;

CREATE INDEX "idx_entradas_vigentes"
  ON "entradas" ("entrada_estado")
  WHERE "is_deleted" = FALSE;

-- Un solo evento publicado a la vez.
CREATE UNIQUE INDEX "idx_evento_publicado_unico"
  ON "eventos" ("evento_estado")
  WHERE "evento_estado" = 'publicado' AND "is_deleted" = FALSE;