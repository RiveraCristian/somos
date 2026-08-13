# SOMOS

Sitio del evento **SOMOS**: fiesta de música electrónica. La gente compra su entrada,
paga por Tenpo, sube el comprobante y —cuando lo confirmas a mano— recibe su entrada
con un QR de un solo uso que se quema en la puerta.

Todo corre en **un solo servicio** (Next.js 15: frontend, API y Prisma en el mismo
proceso). PostgreSQL vive **fuera** de Docker.

---

## 1. Qué hace

| Vista | Ruta | Quién entra |
|---|---|---|
| Landing del evento | `/` | Cualquiera |
| Comprar entrada | `/comprar` | Cualquiera |
| Página privada del comprador | `/mi-entrada/<token>` | Quien tiene el link |
| Recuperar el link privado | `/mi-entrada` | Cualquiera |
| Entrada con QR | `/entrada/<token>` | Quien tiene el link |
| Acceso staff | `/ingresar` | Staff |
| Panel de producción | `/admin` | `Admin`, `DataOwner` |
| Validador de puerta | `/puerta` | `Admin`, `DataOwner`, `Steward` |

### El flujo completo

1. **Elige su entrada** en `/comprar` y deja sus datos. Recibe por correo su link
   privado y la entrada le queda reservada, sin pagar.
2. **Transfiere por Tenpo** el valor de la entrada, usando los datos que muestra su
   página privada.
3. **Sube el comprobante**. El pago queda *pendiente*.
4. **Tú lo confirmas** en `/admin/pagos` mirando la captura. Ahí y solo ahí se emite la
   entrada, se genera el QR y se manda por correo.
5. **En la puerta** se escanea el QR con la cámara. La entrada se quema en el mismo
   acto y queda registrada en la bitácora.

Puede pagar en más de una transferencia: cada pago confirmado se suma a su total y la
entrada se emite con el primero.

> **Sobre Tenpo.** Las transferencias entre tenpistas son un producto P2P de la app y
> **no tienen API pública**: ningún sitio web puede enterarse automáticamente de que
> llegó una transferencia. Por eso el flujo es *comprobante + confirmación manual*. A
> cambio, no se paga comisión de pasarela. Si algún día quieres cobro automático, hay
> que cambiar a Flow, MercadoPago o el Link de Pago de Tenpo Business (que exige cuenta
> de empresa).

---

## 2. Puesta en marcha

### Requisitos

- Node.js 22 o superior
- PostgreSQL 14+ corriendo en el host (no en Docker)

### Pasos

```bash
# 1. Dependencias
npm install

# 2. Configuración
cp .env.example .env
#    Edita .env: DATABASE_URL, JWT_SECRET y los datos del admin inicial.
#    Genera un JWT_SECRET con:
#    node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 3. Base de datos
npm run db:deploy   # aplica migraciones (tablas + triggers + restricciones)
npm run db:seed     # crea usuarios, el evento y los tipos de entrada

# 4. A correr
npm run dev         # http://localhost:3000
```

### Crear la base a mano

```sql
CREATE ROLE somos_user WITH LOGIN PASSWORD 'tu_password';
CREATE DATABASE somos_db OWNER somos_user ENCODING 'UTF8';
ALTER DATABASE somos_db SET timezone TO 'UTC';
```

`timezone = UTC` importa: las columnas son `TIMESTAMP` sin zona y Prisma escribe
siempre en UTC. Si la base queda en hora local, los `DEFAULT CURRENT_TIMESTAMP` de un
`INSERT` hecho por fuera de la app quedarían corridos respecto al resto.

### Cuentas que crea el seed

| Cuenta | Rol | Para qué |
|---|---|---|
| La de `ADMIN_SEED_CORREO` | `Admin` | Panel completo |
| `puerta@somos.cl` | `Steward` | Solo el validador de puerta |
| `sistema@somos.local` | `Viewer`, inactiva | No es de nadie: figura como autor de lo que se crea desde el sitio público, para que `created_by` nunca quede nulo |

Las dos primeras usan la contraseña de `ADMIN_SEED_PASSWORD`. **Cámbiala.**

---

## 3. Lo primero que tienes que configurar

Entra a `/admin/evento` y completa:

1. **Fecha, hora y lugar** — el seed los deja vacíos y el sitio muestra "por confirmar".
2. **Datos de transferencia de Tenpo** — titular, RUT, banco, tipo y número de cuenta.
   Es lo que ve cada comprador para pagarte; sin esto nadie puede completar su compra.
3. **QR de cobro de Tenpo** (opcional pero recomendado) — expórtalo desde la app,
   déjalo en `public/tenpo-qr.png` y pon `/tenpo-qr.png` en el campo correspondiente.
4. **Precios y cupos** de cada tipo de entrada.
5. **Line-up y preguntas frecuentes** — reemplaza los tres "Por confirmar" del seed.

Para que el sitio venda, el evento debe estar en estado **publicado**.

### Correo

Con `EMAIL_ENABLED="false"` no se manda nada: el contenido de cada correo se imprime
en la consola del servidor. Sirve para desarrollar sin gastar envíos.

Para enviar de verdad: crea una cuenta en [Resend](https://resend.com), verifica tu
dominio, y completa `RESEND_API_KEY` y `EMAIL_FROM`. Si no tienes dominio propio puedes
usar `onboarding@resend.dev` para probar.

---

## 4. Estructura

```
somos/
├── prisma/
│   ├── schema.prisma            # modelo de datos
│   ├── seed.ts                  # datos iniciales
│   └── migrations/0001_init/    # DDL + triggers + CHECK + índices
├── public/
│   ├── logo.svg                 # lockup a color
│   ├── logo-mark.svg            # solo el isotipo
│   └── logo-mono.svg            # una sola tinta (currentColor)
├── src/
│   ├── app/
│   │   ├── page.tsx             # landing
│   │   ├── icon.svg             # favicon
│   │   ├── comprar/             # elegir entrada y dejar datos
│   │   ├── mi-entrada/          # página privada: pagar y ver la entrada
│   │   ├── entrada/[token]/     # el ticket con QR
│   │   ├── ingresar/            # login del staff
│   │   ├── admin/               # panel de producción
│   │   ├── puerta/              # validador con cámara
│   │   └── api/                 # salud, comprobantes, exportación, validación
│   ├── components/
│   │   ├── marca/Logo.tsx
│   │   ├── publico/             # header, pie, onda animada, cuenta regresiva
│   │   └── admin/               # barra lateral, tarjetas de cifras
│   └── lib/                     # prisma, auth, qr, correo, archivos, formato
├── data/comprobantes/           # capturas subidas (no se versiona)
├── Dockerfile
└── docker-compose.yml
```

---

## 5. Identidad visual

- **Isotipo**: un oscilograma de once barras en gradiente cian → violeta → magenta.
- **Wordmark**: SOMOS dibujado a mano en SVG con trazo uniforme y terminaciones rectas,
  para que hable el mismo idioma que Unbounded sin depender de que la fuente cargue.
- **Tipografías**: `Unbounded` en títulos, `Inter` en cuerpo y formularios,
  `IBM Plex Mono` en códigos, montos y fechas.
- **Paleta**: negro `#05060A` con cian `#00F0FF`, violeta `#7B5CFF` y magenta `#FF2E9A`.
  Los tokens viven en `@theme` dentro de `src/app/globals.css`.

---

## 6. Base de datos

Sigue las convenciones de `CLAUDE.md`: identificadores `snake_case` con formato
`entidad_atributo`, mapeados en Prisma con `@map` / `@@map`.

| Tabla | Qué guarda |
|---|---|
| `usuarios` | Staff. Password nullable y columnas de proveedor, listas para Google SSO |
| `sesiones` | Tokens de sesión hasheados, revocables |
| `eventos` | El evento, incluidos los datos de cobro de Tenpo |
| `tipos_entrada` | Preventa / General / VIP: precio, cupo, color |
| `artistas` | Line-up |
| `preguntas_frecuentes` | FAQ del sitio |
| `asistentes` | Quién compró, con su token privado y su total pagado |
| `pagos` | Cada transferencia declarada, con su comprobante y estado |
| `entradas` | La entrada emitida: código legible, token del QR, estado |
| `escaneos` | Bitácora de puerta |

### Garantías que impone la base, no la aplicación

- **Auditoría**: las siete tablas de negocio llevan `created_by`, `created_at`,
  `modified_by` y `modified_at`, y un trigger mantiene `modified_at` en cada `UPDATE`.
- **Borrado lógico**: `eventos`, `asistentes`, `pagos` y `entradas` nunca se borran
  físicamente. Un `CHECK` impide marcar `is_deleted` sin registrar quién y cuándo.
- **Bitácora inmutable**: `escaneos` rechaza `UPDATE` y `DELETE` por trigger. Es
  evidencia de control de acceso.
- **Dominios cerrados**: 17 restricciones `CHECK` validan estados, métodos y montos.
  Un estado inventado no entra ni por SQL directo.
- **Un solo evento publicado**: índice único parcial sobre `evento_estado`.
- **Una entrada por comprador**: `UNIQUE` sobre `entrada_asistente_id`.

### Comandos

```bash
npm run db:deploy    # aplicar migraciones (producción)
npm run db:migrate   # crear una migración nueva (desarrollo)
npm run db:seed      # sembrar datos iniciales
npm run db:studio    # explorar la base en el navegador
```

---

## 7. Seguridad

- **Sesiones**: JWT `HS256` en cookie `httpOnly` + `sameSite=lax`, con el token
  hasheado en `sesiones` para poder revocarlo. Duran 7 días.
- **Passwords**: bcrypt con costo 12. El campo es nullable a propósito, para poder
  sumar Google SSO sin tocar el modelo.
- **Fuerza bruta**: 6 intentos fallidos por IP+correo bloquean 10 minutos. Es un
  contador en memoria del proceso; si algún día corre replicado, hay que moverlo a la
  base o a Redis.
- **Links privados**: la página del comprador y la entrada usan tokens aleatorios de
  24 bytes, no IDs correlativos. `/mi-entrada` nunca revela si un correo compró:
  manda el link por mail y responde siempre lo mismo.
- **Comprobantes**: son datos de terceros. No viven en `public/`; se sirven por
  `/api/comprobante/<archivo>` solo con sesión de administración, y el nombre se valida
  contra un patrón que corta cualquier `../`.
- **Doble entrada**: la quema es un `UPDATE` condicional (`WHERE estado = 'valida'`),
  no un leer-y-después-escribir. Si dos teléfonos escanean el mismo QR a la vez, solo
  uno pasa.

---

## 8. Despliegue

### Docker (un solo contenedor)

```bash
docker compose up -d --build
```

`docker-compose.yml` declara **solo la app**. PostgreSQL va afuera: apunta
`DATABASE_URL` a `host.docker.internal` en local o a la IP real del servidor. Los
comprobantes viven en el volumen `somos_comprobantes`.

Antes del primer arranque, aplica las migraciones:

```bash
docker compose run --rm somos npx prisma migrate deploy
```

### Servidor propio sin Docker

```bash
npm ci
npm run build
npm run db:deploy
npm start
```

Pon un Nginx o Caddy delante para el TLS. **`APP_URL` tiene que ser la URL pública
real**: de ahí sale el contenido del QR y los links de los correos. Si queda en
`localhost`, los QR emitidos no sirven fuera de tu máquina.

---

## 9. Decisiones que conviene conocer

- **Next.js en vez de React + backend aparte.** El requisito era un solo servicio.
  Server Actions permiten formularios con subida de archivos sin escribir una API
  intermedia, y `output: standalone` deja una imagen chica.
- **Canvas 2D en vez de Three.js para el hero.** `CLAUDE.md` permite Three.js en
  páginas públicas, pero estas ondas son cuatro curvas: no justifican cargar un motor
  3D en el celular de nadie. El canvas respeta `prefers-reduced-motion` y se detiene
  cuando el hero sale de pantalla.
- **El QR lleva una URL, no el código.** El código legible (`SOMOS-7K4M2P`) es para
  tipear a mano cuando la cámara falla; el QR apunta a `/entrada/<token>` con un token
  secreto. Ver el código de reojo en el ticket ajeno no sirve de nada.
- **El total pagado se recalcula, no se acumula.** Al confirmar o rechazar un pago se
  vuelve a sumar desde la tabla. Así un rechazo posterior siempre deja la cifra
  correcta.
- **Los tipos de entrada no se borran, se ocultan.** Hay entradas emitidas que los
  referencian y ese historial no se puede romper.
- **La cifra por tipo del panel suma lo pagado, no precio × reservas.** Si no, no
  cuadraría con la recaudación total, porque hay reservas sin pagar.

---

## 10. Pendientes conocidos

- `package.json#prisma` (la clave `seed`) está deprecada y desaparece en Prisma 7. Hay
  que migrarla a `prisma.config.ts` al actualizar. Hoy funciona y solo tira un aviso.
- No hay galería de fotos ni mapa embebido: el evento solo guarda un link de mapa.
- El bloqueo por intentos fallidos es en memoria (ver sección 7).
- Google SSO está preparado en el modelo pero no implementado.
- No hay reserva con vencimiento: una entrada reservada y nunca pagada ocupa cupo hasta
  que la anules a mano.
