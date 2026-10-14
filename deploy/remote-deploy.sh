#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# SOMOS — lo que corre DENTRO del droplet en cada despliegue.
#
# No se ejecuta a mano: el workflow lo manda por stdin precedido de las
# variables SOMOS_IMAGE, GHCR_USER y GHCR_TOKEN. Van por stdin y no como
# argumentos a proposito: los argumentos quedan a la vista en `ps`.
#
# OJO con stdin: como bash lee ESTE script desde ahi, cualquier comando que
# tambien lea stdin se traga las lineas que bash todavia no leyo. Paso de
# verdad: `docker compose run` se comio el seed, el `up -d` y el chequeo de
# salud, y el despliegue termino en verde sin haber desplegado nada. Por eso
# cada `run` lleva `-T` y `< /dev/null`.
# ---------------------------------------------------------------------------
set -euo pipefail

cd /opt/somos

: "${SOMOS_IMAGE:?falta SOMOS_IMAGE}"
: "${GHCR_USER:?falta GHCR_USER}"
: "${GHCR_TOKEN:?falta GHCR_TOKEN}"

# ---------------------------------------------------------------------------
# Configuracion que viene de GitHub
#
# Los secretos de Mercado Pago (y la pasarela elegida) pueden vivir en GitHub.
# Si llegaron, se escriben en el .env; si llegaron vacios, no se toca nada: un
# secreto que falta en GitHub no puede borrar el que ya funciona aca.
#
# No se usa sed: un token con / o & romperia el reemplazo. Se reescribe el
# archivo sin la linea y se agrega al final, con los permisos de antes.
# ---------------------------------------------------------------------------
fijar_en_env() {
  local llave="$1" valor="$2" tmp
  [ -n "$valor" ] || return 0
  case "$valor" in
    *$'\n'* | *'"'*) echo "FALLO: $llave trae un salto de linea o comillas." >&2; exit 1 ;;
  esac
  tmp="$(mktemp /opt/somos/.env.XXXXXX)"
  grep -v "^${llave}=" .env > "$tmp" || true
  printf '%s="%s"\n' "$llave" "$valor" >> "$tmp"
  chmod --reference=.env "$tmp"
  mv "$tmp" .env
  echo "    $llave actualizado desde GitHub"
}

echo "==> Configuracion"
fijar_en_env MERCADOPAGO_ACCESS_TOKEN "${MP_ACCESS_TOKEN:-}"
fijar_en_env MERCADOPAGO_WEBHOOK_SECRET "${MP_WEBHOOK_SECRET:-}"
fijar_en_env PASARELA "${PASARELA_ELEGIDA:-}"
unset MP_ACCESS_TOKEN MP_WEBHOOK_SECRET

limpiar() { docker logout ghcr.io >/dev/null 2>&1 || true; }
trap limpiar EXIT

echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null

echo "==> Bajando $SOMOS_IMAGE"
docker compose pull --quiet

# Las migraciones corren ANTES de levantar la version nueva (CLAUDE.md 11.5.6).
echo "==> Migraciones"
docker compose run --rm --no-deps -T somos \
  node prisma-cli/node_modules/prisma/build/index.js migrate deploy < /dev/null

# El seed es idempotente: todos sus upsert llevan `update: {}`, asi que
# repetirlo no pisa lo que se haya editado desde el panel.
echo "==> Seed"
docker compose run --rm --no-deps -T somos node prisma/seed.js < /dev/null

echo "==> Levantando la aplicacion"
docker compose up -d --remove-orphans

# El disco son 8.7 GB y la imagen pesa ~700 MB: guardar versiones viejas para
# un eventual rollback no cabe. Se borra todo lo que no use el contenedor vivo;
# si hay que volver atras, la version anterior sigue en GHCR y se vuelve a bajar.
docker image prune -af >/dev/null

# Que el contenedor este vivo no basta: si `up -d` no recreo nada, el de antes
# sigue respondiendo sano y el despliegue pasa sin haber desplegado. Se compara
# contra la imagen que se acaba de construir.
esperada="$(docker image inspect "$SOMOS_IMAGE" --format '{{.Id}}')"
enUso="$(docker inspect somos --format '{{.Image}}')"
if [ "$esperada" != "$enUso" ]; then
  echo "FALLO: el contenedor no quedo con la imagen nueva." >&2
  echo "  esperada: $esperada" >&2
  echo "  en uso:   $enUso" >&2
  exit 1
fi
echo "El contenedor corre la imagen recien construida."

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
