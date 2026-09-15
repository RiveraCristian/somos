# ---------------------------------------------------------------------------
# SOMOS — imagen unica: Next.js (frontend + API + Prisma) en un solo servicio.
# PostgreSQL NO vive aqui; se consume via DATABASE_URL.
# ---------------------------------------------------------------------------

# --- 1. Dependencias --------------------------------------------------------
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# --- 2. Build ---------------------------------------------------------------
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# `prisma generate` corre dentro del script `build` del package.json.
RUN npm run build

# El seed esta en TypeScript y `tsx` es una dependencia de desarrollo: no llega
# a la imagen final. Se transpila aqui, donde si existe el compilador, para que
# el runtime pueda sembrar con `node prisma/seed.js` sin arrastrar devDeps.
RUN ./node_modules/.bin/tsc prisma/seed.ts --outDir /seed --module commonjs --target es2022 --moduleResolution node --esModuleInterop --skipLibCheck

# --- 2b. CLI de Prisma ------------------------------------------------------
# Copiar `node_modules/prisma` a mano no sirve: el CLI carga dependencias
# transitivas (`effect`, `@prisma/config`) que no viven dentro de esa carpeta y
# revienta con "Cannot find module" al primer `migrate deploy`. Se instala en
# su propio arbol, en la version EXACTA del lockfile: si el CLI y el cliente
# generado no coinciden, Prisma se niega a correr.
FROM node:22-alpine AS prisma-cli
WORKDIR /cli
COPY package-lock.json ./
RUN VER="$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")"  && npm install --no-save --no-audit --no-fund --ignore-scripts "prisma@$VER"

# --- 3. Runtime -------------------------------------------------------------
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV UPLOADS_DIR=/app/data/comprobantes
ENV LOGOS_DIR=/app/data/logos

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Salida standalone: incluye el server de Next y solo los node_modules usados.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma CLI + schema + migraciones, para poder correr `migrate deploy` al arrancar.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /seed/seed.js ./prisma/seed.js
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# El CLI vive aparte, con sus propias dependencias al lado. La ruta importa:
# Node resuelve subiendo por los directorios, asi que el `node_modules` tiene
# que ser el padre del paquete para que encuentre a sus hermanos.
COPY --from=prisma-cli --chown=nextjs:nodejs /cli/node_modules ./prisma-cli/node_modules

# El seed corre fuera del bundle de Next, asi que no puede depender de lo que
# el trazado de `standalone` haya decidido incluir: sus dos dependencias se
# copian explicitamente. `.prisma` es el cliente generado, sin el no hay query.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs

RUN mkdir -p /app/data/comprobantes /app/data/logos && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
