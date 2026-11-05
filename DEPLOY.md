# Ponerla en línea

Todo se hace desde el navegador: GitHub y Cloudflare. Nada desde una consola.

La base de datos ya existe en Cloudflare: **`agenda-personal-db`** (D1), y su id está en `wrangler.jsonc`.

## 1. Los secretos del repositorio

En GitHub, en este repositorio: **Settings → Secrets and variables → Actions → New repository secret**. Uno por uno:

| Nombre | Qué es | ¿Obligatorio? |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Un token de Cloudflare con **Workers Scripts: Edit** y **D1: Edit** (ver abajo) | Sí |
| `CLOUDFLARE_ACCOUNT_ID` | El id de tu cuenta de Cloudflare: en el panel, **Workers & Pages**, a la derecha («Account ID») | Sí |
| `CODIGO_ALTA` | Una frase que inventas tú (por ejemplo, cinco palabras al azar). Sólo con ella se puede crear la cuenta | Para crear la cuenta |
| `META_API_KEY` | La llave nueva de Meta para este asistente | Para usar Muse Spark |
| `ANTHROPIC_API_KEY` | La llave de Anthropic (puede ser la misma del calendario de marketing) | Para usar Claude |

Con una sola de las dos llaves de IA ya funciona: el asistente usa la que haya.

**El token de Cloudflare:** en el panel, el icono de la persona → **My Profile → API Tokens → Create Token →
«Edit Cloudflare Workers»** (plantilla), y en **Permissions** añade **Account → D1 → Edit**. Cópialo al crearlo:
Cloudflare no lo vuelve a enseñar. Sirve también el que ya usa el calendario de marketing, si lo tienes guardado.

**Nunca pegues una llave en el chat ni en un archivo del repositorio.**

## 2. Desplegar

En GitHub: **Actions → Desplegar → Run workflow**. Hace, en este orden y sin publicar nada si algo falla:

1. Lint, pruebas y build (`npm run verificar`).
2. Las migraciones de D1.
3. Publica el Worker.
4. Pone los secretos de la aplicación (`CODIGO_ALTA` y las llaves de IA) que estén en el repositorio. Uno que no esté
   no borra el que ya tenga el Worker.
5. Comprueba que contesta. La dirección sale en el resumen del job: `https://agenda-personal.<tu-subdominio>.workers.dev`.

## 3. Crear tu cuenta

Abre la dirección. La primera vez pide **crear la cuenta** con tu nombre, tu correo, una contraseña (10 caracteres o
más) y el código de alta. Es la única cuenta: después de crearla nadie más puede darse de alta, y la pantalla sólo pide
entrar.

## 4. Cambiar una llave

Cambia el secreto en GitHub y vuelve a lanzar **Desplegar**.

## Si algo falla

- **«Faltan secretos del repositorio»**: falta `CLOUDFLARE_API_TOKEN` o `CLOUDFLARE_ACCOUNT_ID`.
- **Falla «Aplicar las migraciones»** con un error de permisos: al token le falta **D1: Edit**.
- **«El alta no está abierta»** al crear la cuenta: falta `CODIGO_ALTA`; ponlo y vuelve a desplegar.
- **«No hay ninguna llave de IA»** en la Bandeja: falta `META_API_KEY` o `ANTHROPIC_API_KEY`. Lo capturado no se
  pierde: queda en la Bandeja y, con la llave puesta, «Que lo ordene el asistente» lo vuelve a intentar.
