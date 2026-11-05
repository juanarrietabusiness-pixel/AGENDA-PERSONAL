# Ponerla en línea

Todo se hace desde el navegador: GitHub y Cloudflare. Nada desde una consola.

- **Dónde vive:** en la misma cuenta de Cloudflare que el calendario de marketing, pero como un Worker aparte
  (`agenda-personal`), con su propia base (`agenda-personal-db`, ya creada).
- **La dirección:** `https://agenda.juancitoads.com`. La crea el propio despliegue (con su certificado), como
  `calendario.juancitoads.com`: no hay que tocar GoDaddy ni los DNS. La de respaldo, `…workers.dev`, sigue funcionando.

## 1. Lo que va en GitHub: sólo lo de Cloudflare

En este repositorio: **Settings → Secrets and variables → Actions → New repository secret**.

| Nombre | Qué es |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Un token de Cloudflare (ver abajo) |
| `CLOUDFLARE_ACCOUNT_ID` | El id de tu cuenta: en el panel de Cloudflare, **Workers & Pages**, a la derecha («Account ID») |

**El token:** en Cloudflare, el icono de la persona → **My Profile → API Tokens → Create Token → «Edit Cloudflare
Workers»** (plantilla). En **Permissions** añade **Account → D1 → Edit**, y en **Zone Resources** deja incluida la
zona **juancitoads.com** (para **Zone → Workers Routes → Edit**, que es lo que crea el dominio). Cópialo al crearlo:
Cloudflare no lo vuelve a enseñar. Sirve el mismo token del calendario de marketing, si lo tienes guardado.

## 2. Desplegar

En GitHub: **Actions → Desplegar → Run workflow**. Hace, en este orden y sin publicar nada si algo falla:

1. Lint, pruebas y build (`npm run verificar`).
2. Las migraciones de D1.
3. Publica el Worker y el dominio `agenda.juancitoads.com`.
4. Comprueba que contesta. La primera vez el certificado del dominio puede tardar unos minutos: si aún no está, el
   resumen del job da la dirección de respaldo.

## 3. Las llaves: en Cloudflare, como en el calendario

En Cloudflare: **Workers & Pages → agenda-personal → Settings → Variables and Secrets → Add**. Cada una con el tipo
**Secret** (no «Text»: lo de tipo Text se borra en cada despliegue; lo de tipo Secret se queda y nadie lo puede volver
a leer).

| Nombre | Qué es | ¿Hace falta? |
|---|---|---|
| `CODIGO_ALTA` | Una frase que inventas tú (por ejemplo, cinco palabras al azar). Sólo con ella se crea la cuenta | Para crear la cuenta |
| `META_API_KEY` | La llave nueva de Meta para este asistente | Para usar Muse Spark |
| `ANTHROPIC_API_KEY` | La llave de Anthropic | Para usar Claude |

Con una sola de las dos llaves de IA ya funciona. Al guardar, Cloudflare aplica el cambio en el momento: no hace falta
volver a desplegar. El Worker tiene que existir antes, así que este paso va después del primer despliegue.

**Nunca pegues una llave en el chat ni en un archivo del repositorio.**

(Si prefieres tenerlas en GitHub, con esos mismos nombres como secretos del repositorio, el workflow las pone en el
Worker en cada despliegue.)

## 4. Crear tu cuenta

Abre `https://agenda.juancitoads.com`. La primera vez pide **crear la cuenta** con tu nombre, tu correo, una contraseña
(10 caracteres o más) y el código de alta. Es la única cuenta: después nadie más puede darse de alta, y la pantalla sólo
pide entrar.

## Lo que la protege

- Una sola cuenta, que sólo se crea con el código de alta.
- La contraseña se guarda con PBKDF2 a 600.000 vueltas: probar contraseñas a ciegas es lento a propósito.
- **Cinco intentos fallidos** desde la misma conexión cierran la entrada a esa conexión **15 minutos** (treinta en total,
  a todas). Un código de alta equivocado cuenta igual.
- La sesión vive en una cookie que sólo vale para esta dirección exacta y que ninguna otra página puede leer.
- Ninguna llave llega al navegador, y nada de otra web puede escribir aquí.
- Los buscadores no la indexan.

**Opcional, una segunda puerta: Cloudflare Access** (gratis). Antes de ver la pantalla de entrar, Cloudflare te pide un
código que llega a tu correo. Se configura en **Zero Trust → Access → Applications** para `agenda.juancitoads.com` (y la
de workers.dev), dejando fuera las rutas de Telegram y de Claude cuando existan, que llevan su propia firma.

## Si algo falla

- **«Faltan secretos del repositorio»**: falta `CLOUDFLARE_API_TOKEN` o `CLOUDFLARE_ACCOUNT_ID`.
- **Falla «Aplicar las migraciones»** con un error de permisos: al token le falta **D1: Edit**.
- **Falla «Publicar el Worker» al crear el dominio**: al token le falta **Zone → Workers Routes → Edit** sobre
  juancitoads.com; o ya hay un registro DNS llamado `agenda` en esa zona (Cloudflare → juancitoads.com → DNS): bórralo
  y vuelve a desplegar.
- **«El alta no está abierta»** al crear la cuenta: falta `CODIGO_ALTA` en el Worker.
- **«No hay ninguna llave de IA»** en la Bandeja: falta `META_API_KEY` o `ANTHROPIC_API_KEY`. Lo capturado no se
  pierde: queda en la Bandeja y, con la llave puesta, «Que lo ordene el asistente» lo vuelve a intentar.
- **«Demasiados intentos fallidos»**: espera 15 minutos.
