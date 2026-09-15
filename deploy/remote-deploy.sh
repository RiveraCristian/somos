#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# SOMOS — lo que corre DENTRO del droplet en cada despliegue.
#
# No se ejecuta a mano: el workflow lo manda por stdin precedido de las
# variables SOMOS_IMAGE, GHCR_USER y GHCR_TOKEN. Van por stdin y no como
# argumentos a proposito: los argumentos quedan a la vista en `ps`.
# ---------------------------------------------------------------------------
set -euo pipefail

cd /opt/somos

: "${SOMOS_IMAGE:?falta SOMOS_IMAGE}"
: "${GHCR_USER:?falta GHCR_USER}"
: "${GHCR_TOKEN:?falta GHCR_TOKEN}"

limpiar() { docker logout ghcr.io >/dev/null 2>&1 || true; }
trap limpiar EXIT

echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null

echo "==> Bajando $SOMOS_IMAGE"
docker compose pull --quiet

# Las migraciones corren ANTES de levantar la version nueva (CLAUDE.md 11.5.6).
echo "==> Migraciones"
docker compose run --rm --no-deps somos \
  node node_modules/prisma/build/index.js migrate deploy

# El seed es idempotente: todos sus upsert llevan `update: {}`, asi que
# repetirlo no pisa lo que se haya editado desde el panel.
echo "==> Seed"
docker compose run --rm --no-deps somos node prisma/seed.js

echo "==> Levantando la aplicacion"
docker compose up -d --remove-orphans

# El disco son 8.7 GB: las imagenes viejas se acumulan rapido.
docker image prune -af --filter 'until=72h' >/dev/null

echo "==> Esperando a que responda sana"
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/salud 2>/dev/null | grep -q '"estado":"ok"'; then
    echo "OK: la aplicacion responde y ve la base de datos."
    exit 0
  fi
  sleep 4
done

echo "FALLO: no respondio sana en 2 minutos. Ultimos logs:" >&2
docker compose logs --tail 80 somos >&2
exit 1
