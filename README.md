# SOMOS

Sitio del evento **SOMOS**: fiesta de música electrónica. La gente compra su entrada,
paga —con Fintoc desde la misma página, o transfiriendo por su cuenta y subiendo el
comprobante— y recibe un QR de un solo uso que se quema en la puerta.

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
| Lista de invitados | `/admin/invitados` | `Admin`, `DataOwner` |
| Validador de puerta | `/puerta` | `Admin`, `DataOwner`, `Steward` |

### Es una fiesta privada

No vende a cualquiera. Para comprar hay que estar en la **lista de invitados**, y la
llave es el **teléfono**:

- El teléfono es obligatorio y se guarda normalizado (`+56XXXXXXXXX`), da lo mismo cómo
  lo escriba la persona. Sin eso el tope por número se saltaría solo.
- Cada número puede sacar **hasta 2 entradas**. El cupo es por número y se puede ajustar
  uno a uno desde `/admin/invitados`.
- Cada entrada va a nombre de una persona **con su propio correo**: el correo sigue
  siendo único por evento porque es el que recibe el QR y el link privado.

La lista se carga pegando números en bloque en `/admin/invitados`, uno por línea y con
el nombre opcional después de una coma.

### El precio sube por etapas

El precio no lo pone el tipo de entrada sino la **etapa vigente** (tabla `etapas_venta`):

| Etapa | Precio | Cuándo |
|---|---|---|
| Primera tanda | $20.000 | Entradas 1 a 100 |
| Segunda tanda | $25.000 | De la 101 en adelante |
| En puerta | $30.000 | El mismo día del evento |

Al reservar, el precio se **congela** en `asistente_precio`. Quien compró en la primera
tanda paga la primera tanda aunque la etapa haya cambiado antes de que pague. Nada del
cobro vuelve a mirar el precio vigente.

### El flujo completo

1. **Elige su entrada** en `/comprar` y deja sus datos. Recibe por correo su link
   privado y la entrada le queda reservada, sin pagar.
2. **Paga**, por uno de dos caminos:
   - **En línea sin salir del sitio** (si hay pasarela configurada): transferencia
     bancaria con Fintoc o tarjeta con Mercado Pago. Se confirma solo.
   - **Transferencia manual**: transfiere a la cuenta del organizador y sube la
     captura. Queda *pendiente* hasta que alguien la revise.
3. **Se emite la entrada**: automáticamente al confirmarse el cobro en línea, o
   cuando tú apruebas el comprobante en `/admin/pagos`. Ahí se genera el QR y se
   manda por correo.
4. **En la puerta** se escanea el QR con la cámara. La entrada se quema en el mismo
   acto y queda registrada en la bitácora.

Puede pagar en más de una transferencia: cada pago confirmado se suma a su total y la
entrada se emite con el primero.

> **Por qué el camino manual necesita comprobante.** Un banco no le avisa a un sitio
> web cuando le llega una transferencia: no hay forma de enterarse solo. Por eso ese
> camino es *captura + confirmación a mano*. El cobro automático es Fintoc (sección 4):
> ahí es la propia pasarela la que confirma que el dinero se movió.

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
npm run dev         # http://localhost:3100
```

> **Puerto 3100.** `npm run dev` fija el puerto para no chocar con otros
> proyectos. Si lo cambias, cambia también `APP_URL` en `.env`: de ahí sale el
> contenido de los QR y los links de los correos, y si no coinciden, las entradas
> emitidas apuntan al lugar equivocado.

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
2. **Cuenta bancaria de respaldo** — titular, RUT, banco, tipo y número de cuenta. No es
   por donde cobra Fintoc (eso se configura en el panel de Fintoc): es la cuenta que ve
   quien no pudo usar el widget y prefiere transferir por su cuenta.
3. **QR de transferencia** (opcional) — si tu banco genera uno, déjalo en `public/` y
   pon su ruta en el campo correspondiente.
4. **Precios y cupos** de cada tipo de entrada.
5. **Line-up y preguntas frecuentes** — reemplaza los tres "Por confirmar" del seed.
6. **La lista de invitados** en `/admin/invitados`. El seed deja un solo número de
   prueba (`+56999999999`): mientras no cargues los reales, nadie más puede comprar.

Para que el sitio venda, el evento debe estar en estado **publicado**.

### Correo

Con `EMAIL_ENABLED="false"` no se manda nada: el contenido de cada correo se imprime
en la consola del servidor. Sirve para desarrollar sin gastar envíos.

Para enviar de verdad: crea una cuenta en [Resend](https://resend.com), verifica tu
dominio, y completa `RESEND_API_KEY` y `EMAIL_FROM`. Si no tienes dominio propio puedes
usar `onboarding@resend.dev` para probar.

---

## 4. Pago en línea (opcional)

Hay **dos pasarelas implementadas**. Una variable decide cuál se usa:

```bash
PASARELA="fintoc"       # transferencia bancaria
PASARELA="mercadopago"  # tarjetas de crédito y débito
PASARELA=""             # ninguna: solo transferencia manual + comprobante
```

Si la elegida no tiene sus credenciales cargadas, el sitio se queda con el flujo
manual y el panel avisa qué falta. **No se autodetecta a propósito**: dejar que el
cobro dependa de qué variables quedaron sueltas es una forma fácil de terminar
cobrando por donde no correspondía.

| | Fintoc | Mercado Pago |
|---|---|---|
| Medio | Transferencia desde el banco | Tarjeta de crédito y débito |
| Comisión | ~1% + IVA | Bastante más alta |
| Abono | 1 día hábil | Según el plan |
| Alta | Autoservicio para pruebas; contrato para producción | Autoservicio, inmediata |
| Dentro de la página | Sí, widget embebido | Sí, Checkout Bricks |

### Fintoc

Llaves de **prueba** autoservicio, sin contrato ni RUT de empresa:

1. Crea la cuenta en [dashboard.fintoc.com/signup](https://dashboard.fintoc.com/signup).
2. Cambia de **Live** a **Test** y entra a **API Keys**.
3. Completa `.env`:

   ```bash
   PASARELA="fintoc"
   FINTOC_SECRET_KEY="sk_test_..."   # crea las sesiones de pago (servidor)
   FINTOC_PUBLIC_KEY="pk_test_..."   # monta el widget (navegador)
   ```

4. Reinicia. Al pagar, usa el **banco simulado** de Fintoc para Chile:

   ```text
   Usuario:    41614850-3
   Contraseña: jonsnow
   ```

Para producción hay que firmar el contrato de licencia y usar las llaves *live*.

**Cómo funciona por dentro**: la sesión se crea con `ui_mode: 'embedded'` y el
`session_token` que devuelve alimenta al widget de `@fintoc/fintoc-js`, que se abre
encima de la página. Si el widget no logra montarse, aparece un enlace al checkout
alojado como plan B para que nadie quede sin poder pagar.

### Mercado Pago

Credenciales inmediatas desde el
[panel de desarrolladores](https://www.mercadopago.cl/developers/panel/app):

```bash
PASARELA="mercadopago"
MERCADOPAGO_ACCESS_TOKEN="..."   # cobra desde el servidor
MERCADOPAGO_PUBLIC_KEY="..."     # monta el formulario en el navegador
```

**Cómo funciona por dentro**: se usa el **Payment Brick** de Checkout Bricks. El
formulario de tarjeta se renderiza dentro de la página, tokeniza los datos en el
navegador —las claves de la tarjeta nunca pasan por este servidor— y el `onSubmit`
manda ese token al backend, que cobra contra `POST /v1/payments`.

**El monto se fija en el servidor**, tomado del tipo de entrada. Si viniera del
navegador, cualquiera podría pagar mil pesos por una entrada de doce mil.

### Webhooks

Cada pasarela tiene el suyo. Ambos validan firma y rechazan todo si falta el secreto.

| Pasarela | URL a registrar | Eventos | Secreto |
|---|---|---|---|
| Fintoc | `<APP_URL>/api/webhooks/fintoc` | `checkout_session.finished`, `checkout_session.expired` | `FINTOC_WEBHOOK_SECRET` |
| Mercado Pago | `<APP_URL>/api/webhooks/mercadopago` | `payment` | `MERCADOPAGO_WEBHOOK_SECRET` |

Las dos firmas son HMAC-SHA256 pero **no se firma lo mismo**:

- Fintoc firma `timestamp.cuerpoCrudo`, con ventana de 5 minutos contra reenvíos.
- Mercado Pago firma el manifiesto `id:<recurso>;request-id:<header>;ts:<ts>;` — el
  id del recurso, no el cuerpo.

**No hace falta túnel para probar en local.** El webhook es la vía principal, pero no
la única (ver abajo).

### Decisiones que conviene conocer

- **Nunca se confía en el navegador.** El `onSuccess` del widget y la respuesta del
  Brick solo mueven la interfaz; la entrada se emite cuando la pasarela lo confirma.
  Fintoc lo dice explícito en su documentación, y con Mercado Pago se vuelve a
  consultar la API aunque ya tengamos la respuesta del cobro en la mano.
- **Un solo camino emite entradas**: [`src/lib/emision.ts`](src/lib/emision.ts),
  compartido por los dos webhooks, la conciliación y el panel. Confirmar dos veces el
  mismo pago es inofensivo.
- **No se depende solo del webhook.** [`src/lib/conciliacion.ts`](src/lib/conciliacion.ts)
  le pregunta a la pasarela por los cobros pendientes:
  - mientras el comprador espera, cada 3 segundos;
  - al abrir su página privada, si dejó un cobro colgado hace más de 20s;
  - y a mano desde `/admin/pagos` con **Consultar a la pasarela**.

  Por eso funciona en local sin túnel, y por eso un webhook perdido en producción no
  deja a nadie sin su entrada.
- **Los eventos se deduplican** por id en la tabla `webhooks`, prefijados con el
  proveedor para que las dos pasarelas no puedan chocar. El payload crudo queda
  guardado para poder auditar un cobro sin depender de los logs.
- **Un pago de pasarela no se puede confirmar a mano** desde el panel: la verdad la
  tiene la pasarela, no el operador.
- **Las llaves públicas viajan como props** desde el servidor, no como variables
  `NEXT_PUBLIC_`. Esas se incrustan al compilar, y acá la configuración se carga desde
  `.env` al arrancar el contenedor.

---
## 5. Estructura

```
somos/
├── prisma/
│   ├── schema.prisma            # modelo de datos
│   ├── seed.ts                  # datos iniciales
│   └── migrations/0001_init/    # DDL + triggers + CHECK + índices
├── logo_somos.png               # logo oficial (fuente de los assets)
├── scripts/
│   └── procesar-logo.mjs        # npm run logo
├── public/
│   ├── logo.png                 # blanco, transparente (generado)
│   └── logo-negro.png           # fondos claros e impresion (generado)
├── src/
│   ├── app/
│   │   ├── page.tsx             # landing
│   │   ├── icon.png             # favicon (generado)
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

## 6. Identidad visual

### Logo

El logo oficial es `logo_somos.png` en la raíz: letras extruidas en 3D dentro de un
chevrón, trazo blanco sobre negro. De ahí salen, generados, los archivos que usa el
sitio:

| Archivo | Para qué |
|---|---|
| `public/logo.png` | Blanco con transparencia real, recortado al contenido |
| `public/logo-negro.png` | Fondos claros e impresión |
| `src/app/icon.png` | Favicon 512×512 |

```bash
npm run logo   # regenera los tres desde logo_somos.png
```

El recorte usa la luminancia del original como canal alfa. Como el fondo es negro
puro, el resultado es exacto y conserva el antialias del borde, sin los dientes de
sierra que deja un recorte por umbral.

**Si cambia el logo**, reemplaza `logo_somos.png` y corre `npm run logo`. El script
vive en [`scripts/procesar-logo.mjs`](scripts/procesar-logo.mjs) y no necesita
dependencias: procesa la imagen en el canvas de un Edge headless.

Un detalle de uso: las letras ocupan poco más de la mitad del alto del chevrón, así
que el logo necesita más altura que un wordmark normal para leerse. En el encabezado
va a 38px, no a 26px.

### Tipografía

- **`Chakra Petch`** en títulos — angular, con las esquinas cortadas en diagonal, el
  mismo gesto que los biseles del logo.
- **`Inter`** en cuerpo, formularios y botones.
- **`IBM Plex Mono`** en códigos, montos y fechas.

### Paleta

Negro `#05060A` con cian `#00F0FF`, violeta `#7B5CFF` y magenta `#FF2E9A`. Los tokens
viven en `@theme` dentro de `src/app/globals.css`.

---

## 7. Base de datos

Sigue las convenciones de `CLAUDE.md`: identificadores `snake_case` con formato
`entidad_atributo`, mapeados en Prisma con `@map` / `@@map`.

| Tabla | Qué guarda |
|---|---|
| `usuarios` | Staff. Password nullable y columnas de proveedor, listas para Google SSO |
| `sesiones` | Tokens de sesión hasheados, revocables |
| `eventos` | El evento, incluida la cuenta bancaria de respaldo |
| `tipos_entrada` | Preventa / General / VIP: precio, cupo, color |
| `artistas` | Line-up |
| `preguntas_frecuentes` | FAQ del sitio |
| `asistentes` | Quién compró, con su token privado y su total pagado |
| `pagos` | Cada transferencia, con su comprobante o sus ids de Fintoc, y su estado |
| `entradas` | La entrada emitida: código legible, token del QR, estado |
| `escaneos` | Bitácora de puerta |
| `webhooks` | Eventos recibidos de las pasarelas, con su payload crudo, para deduplicar |

### Garantías que impone la base, no la aplicación

- **Auditoría**: las siete tablas de negocio llevan `created_by`, `created_at`,
  `modified_by` y `modified_at`, y un trigger mantiene `modified_at` en cada `UPDATE`.
- **Borrado lógico**: `eventos`, `asistentes`, `pagos` y `entradas` nunca se borran
  físicamente. Un `CHECK` impide marcar `is_deleted` sin registrar quién y cuándo.
- **Bitácora inmutable**: `escaneos` rechaza `UPDATE` y `DELETE` por trigger. Es
  evidencia de control de acceso.
- **Dominios cerrados**: 20 restricciones `CHECK` validan estados, métodos y montos.
  Un estado inventado no entra ni por SQL directo. Una de ellas exige que todo pago
  de pasarela traiga su rastro en el proveedor, y que uno `manual` no lo traiga.
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

## 8. Seguridad

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

## 9. Despliegue

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

## 10. Decisiones que conviene conocer

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

## 11. Portada pública en GitHub Pages

El sitio completo necesita servidor y base de datos, así que no se puede servir desde
Pages. Lo que sí se publica es la **portada**, para que la gente vea cómo va quedando:

```bash
npm run vitrina     # deja la portada estática en .vitrina/out
```

Cada push a `main` la publica solo, vía `.github/workflows/pages.yml`. Queda en
`https://<usuario>.github.io/<repo>/`.

**Para activarlo la primera vez**: en GitHub → *Settings* → *Pages* → *Source*, elegir
**GitHub Actions**.

Cómo funciona (`scripts/construir-vitrina.mjs`):

- Arma una mini-aplicación Next en `.vitrina/` con **solo** la portada.
- Esa portada es el mismo `src/app/page.tsx` del sitio real, no una copia: el diseño no
  se puede quedar atrás.
- Compila con `MODO_VITRINA=1`, y ahí las funciones de datos devuelven el contenido de
  muestra de `src/lib/vitrina.ts` en vez de consultar Postgres.
- Cualquier link a `/comprar` o `/admin` cae en un 404 propio que explica que es una
  demo, en vez del 404 crudo de GitHub.

> El aviso de **"sitio en desarrollo"** sale siempre en la vitrina. En el sitio real se
> controla con `AVISO_DESARROLLO` (`off` para apagarlo el día que se publique de verdad).

---

## 12. Pendientes conocidos

- `package.json#prisma` (la clave `seed`) está deprecada y desaparece en Prisma 7. Hay
  que migrarla a `prisma.config.ts` al actualizar. Hoy funciona y solo tira un aviso.
- No hay galería de fotos ni mapa embebido: el evento solo guarda un link de mapa.
- El bloqueo por intentos fallidos es en memoria (ver sección 8).
- Google SSO está preparado en el modelo pero no implementado.
- No hay reserva con vencimiento: una entrada reservada y nunca pagada ocupa cupo hasta
  que la anules a mano. Con lista de invitados esto pesa más: una reserva muerta le
  consume el cupo a ese número.
- La lista de invitados trae un solo número de prueba (`+56999999999`). Hay que cargar
  la real antes de abrir la venta.
- El cupo del tipo de entrada (200) y los cupos de las etapas (100 + resto) son dos
  topes distintos que conviven. Manda el que se agote primero.
