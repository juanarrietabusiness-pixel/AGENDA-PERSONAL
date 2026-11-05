# Ponerla en línea

Todo se hace desde el navegador, en Cloudflare. **No hay que crear ningún token ni tocar GitHub**: Cloudflare se
conecta al repositorio y crea él mismo la llave que necesita para publicar.

- **Dónde vive:** en la misma cuenta de Cloudflare que el calendario de marketing, como un Worker aparte
  (`agenda-personal`), con su propia base (`agenda-personal-db`). La base ya está creada y con sus tablas.
- **La dirección:** `https://agenda.juancitoads.com`. La crea el propio despliegue, con su certificado, como
  `calendario.juancitoads.com`: no hay que tocar GoDaddy ni los DNS.
- **Cada cambio que se sube al repositorio se publica solo**, pero sólo si antes pasan el lint, las pruebas y el build
  (`npm run verificar`). Si algo falla, lo que está en línea no se toca.

## 1. Conectar el repositorio (una sola vez)

1. En Cloudflare: **Workers & Pages → Create application** (o «Crear») **→ Import a repository** («Importar un
   repositorio»).
2. **Connect GitHub.** GitHub te pregunta a qué repositorios dejarle entrar a Cloudflare: escoge **Only select
   repositories** y marca sólo **AGENDA-PERSONAL**. Acepta.
3. Escoge el repositorio **AGENDA-PERSONAL** y rellena:

   | Campo | Qué poner |
   |---|---|
   | Project name (nombre) | `agenda-personal` (tiene que ser exactamente éste) |
   | Production branch (rama) | `claude/awesome-albattani-x1ei2x` (la principal del repositorio por ahora) |
   | Build command | `npm run verificar` |
   | Deploy command | `npx wrangler deploy` |
   | API token | Déjalo en **Create new token** (lo crea Cloudflare) |
   | Builds for non-production branches | **Apagado** |

4. **Create and deploy.** La primera vez tarda dos o tres minutos. Si sale bien, en **Settings → Domains & Routes**
   aparecen `agenda.juancitoads.com` y la de respaldo `…workers.dev`. El certificado del dominio puede tardar unos
   minutos más la primera vez.

## 2. Las llaves: en el Worker, como en el calendario

En Cloudflare: **Workers & Pages → agenda-personal → Settings → Variables and Secrets → Add**. Cada una con el tipo
**Secret** (no «Text»: lo de tipo Text se borra en cada despliegue; lo de tipo Secret se queda y nadie lo puede volver
a leer).

| Nombre | Qué es | ¿Hace falta? |
|---|---|---|
| `CODIGO_ALTA` | Una frase que inventas tú (por ejemplo, cinco palabras al azar). Sólo con ella se crea la cuenta | Para crear la cuenta |
| `META_API_KEY` | La llave nueva de Meta para este asistente | Para usar Muse Spark |
| `ANTHROPIC_API_KEY` | La llave de Anthropic | Para usar Claude (opcional) |
| `TELEGRAM_BOT_TOKEN` | El token que da @BotFather al crear el bot | Para Telegram |

Con una sola de las dos llaves de IA ya funciona. Al guardar, Cloudflare lo aplica en el momento.

**Nunca pegues una llave en el chat ni en un archivo del repositorio.**

## 3. Crear tu cuenta

Abre `https://agenda.juancitoads.com`. La primera vez pide **crear la cuenta** con tu nombre, tu correo, una contraseña
(10 caracteres o más) y el código de alta. Es la única cuenta: después nadie más puede darse de alta, y la pantalla sólo
pide entrar.

## 4. Conectar Telegram

Con `TELEGRAM_BOT_TOKEN` puesto: en la agenda, **Ajustes → Telegram → Conectar Telegram → Abrir Telegram**, y en el
chat del bot pulsa **Iniciar**. El enlace sirve una vez y vale 15 minutos. Desde ahí, lo que le escribas o le dictes
al bot se ordena igual que en la aplicación, con su tarjeta y «Deshacer». El bot no le contesta a nadie más.

Las notas de voz las transcribe **Workers AI** (Whisper) en tu misma cuenta de Cloudflare: no hace falta otra llave.

## Lo que la protege

- Una sola cuenta, que sólo se crea con el código de alta.
- La contraseña se guarda con PBKDF2 a 600.000 vueltas: probar contraseñas a ciegas es lento a propósito.
- **Cinco intentos fallidos** desde la misma conexión cierran la entrada a esa conexión **15 minutos** (treinta en total,
  a todas). Un código de alta equivocado cuenta igual.
- La sesión vive en una cookie que sólo vale para esta dirección exacta y que ninguna otra página puede leer.
- Ninguna llave llega al navegador, y nada de otra web puede escribir aquí.
- Los buscadores no la indexan.
- Cloudflare sólo puede entrar al repositorio de la agenda (paso 1.2), y su llave para publicar no toca la base de
  datos.

**Opcional, una segunda puerta: Cloudflare Access** (gratis). Antes de ver la pantalla de entrar, Cloudflare te pide un
código que llega a tu correo. Se configura en **Zero Trust → Access → Applications** para `agenda.juancitoads.com` (y la
de workers.dev), dejando fuera las rutas de Telegram y de Claude cuando existan, que llevan su propia firma.

## Las migraciones de la base

La llave que crea Cloudflare para publicar **no puede cambiar la base de datos** (a propósito). Por eso una migración
nueva (`migraciones/d1/`) se aplica a la base ANTES de subir el cambio que la usa: desde una sesión de Claude con acceso
a Cloudflare, o con `wrangler d1 migrations apply agenda-personal-db --remote`. Las que hay hoy (0001 a 0003) ya están
aplicadas. Todo `create` lleva `if not exists`, así que aplicar dos veces no rompe nada.

## Si algo falla

- **El build falla en «verificar»**: una prueba o el lint no pasan; lo que está en línea sigue igual. El registro del
  build dice cuál.
- **«Worker name mismatch»** o parecido: el nombre del proyecto no es exactamente `agenda-personal`.
- **Falla al crear el dominio**: ya hay un registro DNS llamado `agenda` en Cloudflare → juancitoads.com → DNS. Bórralo
  y vuelve a lanzar el build (**Deployments → Retry build** o subiendo cualquier cambio).
- **«El alta no está abierta»** al crear la cuenta: falta `CODIGO_ALTA` en el Worker.
- **«No hay ninguna llave de IA»** en la Bandeja: falta `META_API_KEY` o `ANTHROPIC_API_KEY`. Lo capturado no se
  pierde: queda en la Bandeja y, con la llave puesta, «Que lo ordene el asistente» lo vuelve a intentar.
- **«Demasiados intentos fallidos»**: espera 15 minutos.

## Alternativa: desplegar desde GitHub

Si algún día se prefiere, el workflow **Desplegar** (`.github/workflows/desplegar.yml`, a mano desde Actions) hace lo
mismo y además aplica las migraciones, pero necesita en GitHub `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit, D1: Edit
y Zone → Workers Routes: Edit sobre juancitoads.com) y `CLOUDFLARE_ACCOUNT_ID`.
