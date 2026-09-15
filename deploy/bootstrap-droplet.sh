#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# SOMOS — preparacion del droplet (Ubuntu 24.04) para produccion.
#
# Es IDEMPOTENTE: correrlo de nuevo no rompe nada ni pisa los secretos ya
# generados. Se ejecuta UNA vez como root:
#
#   bash bootstrap-droplet.sh "<llave-publica-ssh-del-deploy>"
#
# Deja el servidor con:
#   - swap (el droplet tiene 458 MB de RAM: sin swap, cualquier pico lo mata)
#   - Docker CE + plugin compose
#   - PostgreSQL NATIVO en el host (CLAUDE.md: la base NUNCA va en Docker)
#   - base somos_db + usuario somos_user con password generada aqui
#   - ufw cerrado salvo 22/80/443, y 5432 solo desde las redes de Docker
#   - nginx como reverse proxy en :80 hacia la app, listo para el dominio
#   - usuario deploy sin password, con su llave, para que lo use el workflow
#   - /opt/somos con el .env de produccion en modo 600
#
# La imagen de la app NO se construye aqui: 1 vCPU y 458 MB no alcanzan para un
# build de Next.js. La construye GitHub Actions y el servidor solo hace pull.
# ---------------------------------------------------------------------------
set -euo pipefail

LLAVE_DEPLOY="${1:-}"
DIR_APP="/opt/somos"
DB_NOMBRE="somos_db"
DB_USUARIO="somos_user"
PUERTO_APP="3000"

log() { printf '\n==> %s\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Hay que correrlo como root."; exit 1; }

export DEBIAN_FRONTEND=noninteractive

# --- 1. Swap ---------------------------------------------------------------
# Con 458 MB de RAM, Postgres + Node + un pull de imagen conviven solo si hay
# swap. Sin esto el OOM killer se lleva la app en el primer deploy.
log "Swap de 2 GB"
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "  swap creada"
else
  echo "  ya existia"
fi
# Swappiness bajo: la swap es red de seguridad, no memoria de uso habitual.
sysctl -qw vm.swappiness=10
grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf

# --- 2. Paquetes base ------------------------------------------------------
log "Actualizando el sistema"
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq ca-certificates curl gnupg lsb-release ufw nginx \
  postgresql postgresql-contrib fail2ban unattended-upgrades \
  certbot python3-certbot-nginx openssl >/dev/null

# --- 3. Docker -------------------------------------------------------------
log "Docker CE + compose"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  ARCH="$(dpkg --print-architecture)"
  echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin >/dev/null
fi
# El disco son 8.7 GB: sin limite, los logs de Docker se lo comen solos.
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
systemctl enable --now docker >/dev/null
systemctl restart docker
docker --version

# --- 4. Usuario de despliegue ----------------------------------------------
log "Usuario deploy"
id -u deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy >/dev/null
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
if [ -n "$LLAVE_DEPLOY" ] && ! grep -qF "$LLAVE_DEPLOY" /home/deploy/.ssh/authorized_keys; then
  echo "$LLAVE_DEPLOY" >> /home/deploy/.ssh/authorized_keys
  echo "  llave de despliegue instalada"
fi
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

# --- 5. PostgreSQL ---------------------------------------------------------
log "PostgreSQL"
VER_PG="$(ls /etc/postgresql | sort -n | tail -1)"
CONF_PG="/etc/postgresql/$VER_PG/main"
systemctl enable --now postgresql >/dev/null

# La app corre en un contenedor y la base en el host: el contenedor llega por
# la puerta de enlace del bridge de Docker (host.docker.internal), asi que
# Postgres tiene que escuchar ahi ademas de en localhost. En ninguna otra.
IP_BRIDGE="$(ip -4 -o addr show docker0 | awk '{print $4}' | cut -d/ -f1)"
mkdir -p "$CONF_PG/conf.d"
cat > "$CONF_PG/conf.d/somos.conf" <<CONF
# Generado por bootstrap-droplet.sh — no editar a mano.
listen_addresses = 'localhost,$IP_BRIDGE'
port = 5432

# Ajustes para un droplet de 458 MB. Los valores por defecto de Postgres
# asumen un servidor mucho mas grande y aqui lo dejarian sin memoria.
max_connections = 25
shared_buffers = 48MB
effective_cache_size = 128MB
work_mem = 2MB
maintenance_work_mem = 32MB
wal_buffers = 2MB
CONF
grep -q "include_dir = 'conf.d'" "$CONF_PG/postgresql.conf" \
  || echo "include_dir = 'conf.d'" >> "$CONF_PG/postgresql.conf"

# Acceso: por socket local (peer) y por TCP solo desde las redes privadas de
# Docker, siempre con password cifrada.
if ! grep -q 'somos-docker' "$CONF_PG/pg_hba.conf"; then
  {
    echo ""
    echo "# somos-docker — contenedores de la app hacia la base del host"
    echo "host    all             all             172.16.0.0/12           scram-sha-256"
  } >> "$CONF_PG/pg_hba.conf"
fi
systemctl restart postgresql

# Password de la base: se genera una sola vez y queda guardada en el .env.
ARCH_PASS="/root/.somos_db_password"
if [ ! -f "$ARCH_PASS" ]; then
  openssl rand -base64 30 | tr -d '/+=\n' | head -c 32 > "$ARCH_PASS"
  chmod 600 "$ARCH_PASS"
fi
DB_PASS="$(cat "$ARCH_PASS")"

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USUARIO'" | grep -q 1; then
  sudo -u postgres psql -qc "CREATE ROLE $DB_USUARIO LOGIN PASSWORD '$DB_PASS'"
fi
sudo -u postgres psql -qc "ALTER ROLE $DB_USUARIO PASSWORD '$DB_PASS'"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NOMBRE'" | grep -q 1; then
  sudo -u postgres createdb -O "$DB_USUARIO" "$DB_NOMBRE"
fi
# Prisma crea las tablas con migrate deploy; necesita mandar en el schema.
sudo -u postgres psql -q -d "$DB_NOMBRE" -c "GRANT ALL ON SCHEMA public TO $DB_USUARIO"
sudo -u postgres psql -q -d "$DB_NOMBRE" -c "ALTER SCHEMA public OWNER TO $DB_USUARIO"
echo "  base $DB_NOMBRE lista (propietario: $DB_USUARIO)"

# --- 6. Firewall -----------------------------------------------------------
log "Firewall"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp  comment 'ssh'   >/dev/null
ufw allow 80/tcp  comment 'http'  >/dev/null
ufw allow 443/tcp comment 'https' >/dev/null
# Postgres NO se expone a internet: solo lo alcanzan las redes de Docker.
ufw allow from 172.16.0.0/12 to any port 5432 proto tcp comment 'postgres desde docker' >/dev/null
ufw --force enable >/dev/null
ufw status

# --- 7. Nginx --------------------------------------------------------------
log "Nginx como reverse proxy"
rm -f /etc/nginx/sites-enabled/default
cat > /etc/nginx/sites-available/somos <<NGINX
# SOMOS — reverse proxy hacia el contenedor.
# Hoy responde por IP. Cuando exista el dominio, certbot reescribe este archivo
# para agregar el 443 y el redirect; no hay que tocarlo a mano.
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Los comprobantes de transferencia son fotos de celular (hasta 8 MB).
    # Si nginx corta antes, el asistente ve un error sin explicacion.
    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:$PUERTO_APP;
        proxy_http_version 1.1;
        proxy_set_header Upgrade            \$http_upgrade;
        proxy_set_header Connection         'upgrade';
        proxy_set_header Host               \$host;
        proxy_set_header X-Real-IP          \$remote_addr;
        proxy_set_header X-Forwarded-For    \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto  \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 90s;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/somos /etc/nginx/sites-enabled/somos
nginx -t
systemctl enable --now nginx >/dev/null
systemctl reload nginx

# --- 8. Carpeta de la app y .env ------------------------------------------
log "Carpeta $DIR_APP"
install -d -m 755 -o deploy -g deploy "$DIR_APP"

# El .env se crea una sola vez. En los redeploys NO se toca: es la fuente de
# verdad de los secretos y vive solo aqui, nunca en el repositorio ni en CI.
if [ ! -f "$DIR_APP/.env" ]; then
  JWT="$(openssl rand -base64 48 | tr -d '\n')"
  PASS_ADMIN="$(openssl rand -base64 18 | tr -d '/+=\n' | head -c 16)"
  # -4 obligatorio: sin eso el servicio contesta con la IPv6 del droplet y
  # APP_URL queda con una URL invalida (una IPv6 va entre corchetes). De
  # APP_URL sale el contenido de los QR: un error aca emite entradas rotas.
  IP_PUBLICA="$(curl -s -4 --max-time 5 https://ifconfig.me || hostname -I | awk '{print $1}')"
  cat > "$DIR_APP/.env" <<ENVEOF
# SOMOS — entorno de produccion. Generado por bootstrap-droplet.sh.
# Este archivo es la unica copia de estos secretos. No se versiona.

DATABASE_URL="postgresql://$DB_USUARIO:$DB_PASS@host.docker.internal:5432/$DB_NOMBRE?schema=public"
JWT_SECRET="$JWT"

# De aqui salen los QR y los links de los correos. Cambiar al dominio cuando
# exista, junto con el certificado.
APP_URL="http://$IP_PUBLICA"

UPLOADS_DIR="/app/data/comprobantes"
UPLOAD_MAX_MB="8"

# Pasarela de pago: vacia hasta cargar las llaves de Fintoc. Mientras tanto el
# sitio cobra por transferencia con comprobante, que es el flujo manual.
PASARELA=""
FINTOC_SECRET_KEY=""
FINTOC_PUBLIC_KEY=""
FINTOC_WEBHOOK_SECRET=""

MERCADOPAGO_ACCESS_TOKEN=""
MERCADOPAGO_PUBLIC_KEY=""
MERCADOPAGO_WEBHOOK_SECRET=""

# Correo apagado hasta tener el dominio verificado en Resend.
EMAIL_ENABLED="false"
RESEND_API_KEY=""
EMAIL_FROM="SOMOS <entradas@somos.cl>"

ADMIN_SEED_CORREO="admin@somos.cl"
ADMIN_SEED_NOMBRE="Administrador SOMOS"
ADMIN_SEED_PASSWORD="$PASS_ADMIN"

# Franja de "sitio en desarrollo". Apagar el dia del lanzamiento real.
AVISO_DESARROLLO="on"
ENVEOF
  chmod 600 "$DIR_APP/.env"
  chown deploy:deploy "$DIR_APP/.env"
  echo "  .env creado"
  echo "  CLAVE_ADMIN_GENERADA=$PASS_ADMIN"
else
  echo "  .env ya existia, no se toca"
fi

# --- 9. Endurecimiento basico ---------------------------------------------
log "fail2ban y actualizaciones automaticas"
systemctl enable --now fail2ban >/dev/null 2>&1 || true
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'AUTO'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
AUTO

log "Servidor listo"
echo "  Docker:    $(docker --version)"
echo "  Postgres:  $VER_PG (escucha en localhost y $IP_BRIDGE)"
echo "  App:       $DIR_APP  (nginx :80 -> 127.0.0.1:$PUERTO_APP)"
