#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# SOMOS — baja al servidor los secretos de la aplicacion guardados en GitHub.
#
# No se ejecuta a mano: lo manda el workflow por stdin, con los pares ya
# codificados en PARES_B64. Van asi y no como argumentos a proposito: los
# argumentos quedan a la vista en `ps`.
#
# Regla central: SOLO se escriben las claves que llegan con valor. Una que
# venga vacia —porque ese secreto no existe en GitHub— se ignora y lo que haya
# en el servidor queda intacto.
#
# Sin esa regla, agregar un secreto nuevo borraria todos los que no estuvieran
# cargados en GitHub, y el sitio se quedaria sin cobrar sin que nadie entienda
# por que. Vale mas quedarse corto que apagar algo que funcionaba.
#
# Lo que NUNCA se toca: DATABASE_URL y JWT_SECRET. Los genera el bootstrap, son
# propios de cada servidor y no tienen por que existir en GitHub.
# ---------------------------------------------------------------------------
set -euo pipefail

ENV=/opt/somos/.env
: "${PARES_B64:?falta PARES_B64}"

[ -f "$ENV" ] || { echo "No existe $ENV. ¿Corrio el bootstrap?" >&2; exit 1; }

cp "$ENV" "${ENV}.antes-de-sincronizar"

PARES="$(mktemp)"
chmod 600 "$PARES"
trap 'rm -f "$PARES"' EXIT
printf '%s' "$PARES_B64" | base64 -d > "$PARES"

escritas=0
omitidas=0

# El `|| [ -n "$linea" ]` no sobra: sin el, `read` descarta la ultima linea
# si el archivo no termina en salto, y ese secreto se pierde en silencio.
while IFS= read -r linea || [ -n "$linea" ]; do
  [ -z "$linea" ] && continue

  clave="${linea%%=*}"
  valor="${linea#*=}"

  # Vacio = no esta en GitHub. Se respeta lo que ya tenga el servidor.
  if [ -z "$valor" ]; then
    omitidas=$((omitidas + 1))
    continue
  fi

  sed -i -E "/^${clave}=/d" "$ENV"
  printf '%s="%s"\n' "$clave" "$valor" >> "$ENV"
  escritas=$((escritas + 1))
done < "$PARES"

chmod 600 "$ENV"
chown deploy:deploy "$ENV" 2>/dev/null || true

echo "Secretos sincronizados desde GitHub: $escritas escritas, $omitidas sin valor (se dejo lo del servidor)."

# Util para entender por que el cobro o el correo no andan, sin revelar nada:
# lo que importa es cuales quedaron vacias, no cuanto valen.
vacias="$(grep -E '^[A-Z_]+=""$' "$ENV" | cut -d= -f1 | tr '\n' ' ')"
if [ -n "$vacias" ]; then
  echo "Siguen vacias en el servidor: $vacias"
fi
