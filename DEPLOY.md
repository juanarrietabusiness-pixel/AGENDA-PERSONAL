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
| `GOOGLE_CLIENT_ID` | El «ID de cliente» de Google (paso 6) | Para Google Calendar y Tasks |
| `GOOGLE_CLIENT_SECRET` | El «Secreto del cliente» de Google (paso 6) | Para Google Calendar y Tasks |

Con una sola de las dos llaves de IA ya funciona. Al guardar, Cloudflare lo aplica en el momento.

**Nunca pegues una llave en el chat ni en un archivo del repositorio.**

## 3. Crear tu cuenta

Abre `https://agenda.juancitoads.com`. La primera vez pide **crear la cuenta** con tu nombre, tu correo, una contraseña
(10 caracteres o más) y el código de alta. Es la única cuenta: después nadie más puede darse de alta, y la pantalla sólo
pide entrar.

**Si olvidas la contraseña:** en la entrada, **¿Olvidaste tu contraseña?** → **Mandarme el enlace por Telegram** (llega
al chat del bot; vale 15 minutos y sirve una vez). Sin Telegram, con el **código de alta**; si también lo olvidaste,
pon uno nuevo en Cloudflare (**Settings → Variables and Secrets → CODIGO_ALTA → Edit**) y úsalo. Poner una contraseña
nueva cierra las sesiones de tus otros aparatos. Con la sesión abierta, se cambia en **Ajustes → Tu contraseña**.

## 4. Conectar Telegram

Con `TELEGRAM_BOT_TOKEN` puesto: en la agenda, **Ajustes → Telegram → Conectar Telegram → Abrir Telegram**, y en el
chat del bot pulsa **Iniciar**. El enlace sirve una vez y vale 15 minutos. Desde ahí, lo que le escribas o le dictes
al bot se ordena igual que en la aplicación, con su tarjeta y «Deshacer». El bot no le contesta a nadie más.

Las notas de voz las transcribe **Workers AI** (Whisper) en tu misma cuenta de Cloudflare: no hace falta otra llave.

## 5. Conectar Juancito Ads (sin llaves)

La agenda entra al calendario de marketing **como entra Claude**: en la agenda, **Ajustes → Juancito Ads → Conectar
Juancito Ads**. Se abre el calendario (con tu sesión de allá), dice que «Agenda personal» quiere conectarse y pulsas
**Permitir**. Vuelves a la agenda con «Juancito Ads quedó conectado».

Desde ahí: lo que agendes en el sombrero que dice «se guarda en Juancito Ads» se crea allá al momento; lo que marques
hecho aquí se marca allá, y lo que marques allá se marca aquí (cada pocos minutos, o con «Poner al día ahora»). Lo nuevo
de allá que es tuyo o no tiene a nadie asignado aparece aquí. Las dos aplicaciones hablan por dentro de Cloudflare (un
«Service Binding»), sin salir a internet.

## 6. Google Calendar y Google Tasks (las dos cuentas)

Una sola vez, en <https://console.cloud.google.com>, en un proyecto nuevo «Agenda personal» (aparte del calendario de
marketing, para no tocar lo suyo):

1. **APIs y servicios → Biblioteca**: activa **Google Calendar API** y **Google Tasks API**.
2. **Google Auth Platform → Comenzar**: nombre «Agenda personal», tu correo, público **Externo**.
3. **Desarrollo de la marca (Branding)** —Google no deja publicar sin esto—:
   - Página principal de la aplicación: `https://agenda.juancitoads.com`
   - Política de privacidad: `https://agenda.juancitoads.com/privacidad`
   - Dominios autorizados: `juancitoads.com`
   - **Sin logotipo** (con logo, Google exige verificar la app).
4. **Acceso a los datos (Data Access)**: añade a mano `https://www.googleapis.com/auth/calendar` y
   `https://www.googleapis.com/auth/tasks`.
5. **Público (Audience) → Publicar app**: que diga **En producción** («en prueba», el permiso caduca a los 7 días y la
   agenda deja de leer tu calendario sin avisar). La verificación no hace falta: la usas sólo tú.
6. **Clientes → Crear cliente → Aplicación web**, con la URI de redireccionamiento
   `https://agenda.juancitoads.com/api/google/vuelta`. Copia el **ID de cliente** y el **Secreto del cliente** en ese
   momento: Google enseña el secreto una sola vez.
7. Ponlos en Cloudflare como `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (tipo **Secret**, paso 2).

Conecta siempre desde `agenda.juancitoads.com` (desde la dirección de workers.dev Google diría que la vuelta no es la
registrada).

Después, en la agenda: **Ajustes → Google → Conectar Google** con **la cuenta que usas a diario** (con una basta). Google
avisará de que la app «no está verificada» (es tuya y sólo la usas tú): **Configuración avanzada → Ir a Agenda
personal**, y marca las dos casillas (Calendar y Tasks). Si es una cuenta de empresa y dice «bloqueada por tu
administrador», hay que autorizar la app en la consola de administración de Google Workspace.

La agenda lee **todos los calendarios que ves en esa cuenta**, también los que otra cuenta te comparte (si en la del
trabajo ves tu calendario personal, la agenda también). En **Ajustes → Google** escoges cuáles se ven en Hoy, en qué
calendario se guarda lo que agendas de cada sombrero (sólo los que te dejan escribir) y qué tareas van a Google Tasks.
Lo de todo el día (feriados, cumpleaños) sale en «Eventos especiales». Lo que se repite y es sólo tuyo (la oración, la
lectura, el inicio del trabajo) es tu **rutina**: no ocupa Hoy y vive en **Plan → Tu semana**; las reuniones (con más
gente, o que dicen «reunión», «mentoría», «cita») salen en «Reuniones». Toca cualquier evento de Google para cambiar qué
es; vale para toda la serie.

**Google Tasks:** crea en Google Tasks una lista por sombrero, con su mismo nombre («Iglesia», «Personal»…). Lo que
escribas en esa lista entra en ese sombrero, y lo que agendes aquí va a su lista. Lo que escribas en «Mis tareas» lo
pone en su sombrero el asistente. Los permisos se guardan cifrados con el secreto del cliente.

## 7. Conectar Claude

En claude.ai: **Ajustes → Conectores → Añadir conector personalizado**, con la dirección
`https://agenda.juancitoads.com/mcp` (está para copiar en **Ajustes → Claude** de la agenda). Claude abre la agenda,
entras si hace falta y pulsas **Permitir**. Desde cualquier chat: «agéndame la reunión con Adolfo el sábado a las 10» o
«¿qué tengo mañana?». Se desconecta en **Ajustes → Claude**.

## 8. El seguimiento

En **Ajustes → Seguimiento** escoges qué te escribe el asistente por Telegram: el resumen de la mañana (y a qué hora cada
día), los avisos de lo que vence, media hora antes de cada reunión, el cierre del día, «¿la completaste?» con botones, y
la revisión semanal. Lo revisa cada minuto (un «Cron Trigger» del Worker); nunca en lo protegido ni en tus horas de
silencio. Necesita Telegram conectado (paso 4).

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
- Claude entra con su propio permiso (OAuth con PKCE, un código de un solo uso) que se corta desde Ajustes; a Juancito
  Ads y a Google la agenda entra con los permisos que diste, y los de Google van cifrados.

**Opcional, una segunda puerta: Cloudflare Access** (gratis). Antes de ver la pantalla de entrar, Cloudflare te pide un
código que llega a tu correo. Se configura en **Zero Trust → Access → Applications** para `agenda.juancitoads.com` (y la
de workers.dev), dejando fuera `/api/telegram/*`, `/api/juancito/vuelta`, `/api/google/vuelta`, `/mcp`, `/oauth/*` y `/.well-known/*`,
que llevan su propia firma (si no, Telegram, Google y Claude se quedarían en la puerta).

## Las migraciones de la base

La llave que crea Cloudflare para publicar **no puede cambiar la base de datos** (a propósito). Por eso una migración
nueva (`migraciones/d1/`) se aplica a la base ANTES de subir el cambio que la usa: desde una sesión de Claude con acceso
a Cloudflare, o con `wrangler d1 migrations apply agenda-personal-db --remote`. Las que hay hoy (0001 a 0004) ya están
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
- **Juancito Ads «pidió volver a conectar»**: el permiso de allá se retiró o caducó. **Ajustes → Juancito Ads →
  Conectar** otra vez; lo de aquí no se pierde y lo que no subió se sube en la siguiente vuelta.
- **Google «retiró el permiso»**: la app de Google estaba «en prueba» (paso 6.2) o quitaste el acceso en tu cuenta.
  Publícala y vuelve a conectar esa cuenta.
- **El asistente no te escribe nunca**: mira **Ajustes → Seguimiento** (encendido), **Ajustes → Telegram** (conectado)
  y que el Worker tenga el Cron Trigger (**Settings → Trigger events**: «* * * * *»).

## Alternativa: desplegar desde GitHub

Si algún día se prefiere, el workflow **Desplegar** (`.github/workflows/desplegar.yml`, a mano desde Actions) hace lo
mismo y además aplica las migraciones, pero necesita en GitHub `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit, D1: Edit
y Zone → Workers Routes: Edit sobre juancitoads.com) y `CLOUDFLARE_ACCOUNT_ID`.
