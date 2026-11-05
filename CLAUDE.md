# Notas del proyecto para Claude

La agenda personal de Juan: tareas, reuniones y recordatorios de sus cuatro
sombreros (Trabajo, Artístico, Iglesia, Personal), con un asistente que ordena
lo que se le dice. La propuesta y las decisiones están en `docs/propuesta.md`:
léela antes de cambiar algo de fondo.

## Cómo trabajar aquí

```bash
npm install
npm run dev         # sólo la interfaz: sin servidor es el PROTOTIPO (datos de ejemplo en el navegador)
npm run dev:worker  # la aplicación con el Worker y D1 en local (wrangler); pide .dev.vars con CODIGO_ALTA
npm run verificar   # lint (sin errores NI avisos) + pruebas + build: lo que corre CI
```

**Desplegar: Cloudflare se conecta al repositorio** (Workers Builds): cada push a la rama de producción corre
`npm run verificar` como build y, si pasa, `npx wrangler deploy`. Sin tokens que crear (Juan no los ha manejado
nunca: la llave la crea Cloudflare). Los pasos, sólo de navegador, en `DEPLOY.md`. El workflow «Desplegar» de GitHub
queda de alternativa, a mano. Vive en la MISMA cuenta de Cloudflare que el calendario de marketing, como Worker aparte
(`agenda-personal`), en **`agenda.juancitoads.com`** (dominio propio en `routes`; `workers_dev: true` va escrito o
wrangler apagaría el respaldo). La base es `agenda-personal-db` (su id, en `wrangler.jsonc`). Las llaves van en
Cloudflare como «Secret» del Worker.

**Una migración nueva se aplica a la D1 remota ANTES de subir el código que la usa**: la llave que crea Workers Builds
no tiene permiso sobre D1, y el push publica solo. Desde una sesión con el MCP de Cloudflare (`d1_database_query`, y
apuntarla en `d1_migrations` para que wrangler sepa que está) o con `wrangler d1 migrations apply --remote`. De la 0001
a la 0003 ya están aplicadas.

**Telegram** (`worker/lib/telegram.js`): el webhook llega SIN sesión a `/api/telegram/webhook`; vale si trae el
secreto que se le dio a Telegram al conectar (HMAC del token: no hay otro secreto que guardar) y sólo se atiende el
chat atado a la cuenta (`telegram`, con un código de un solo uso cuya huella se guarda; `duenoDeChat`/`vincularChat` en
sesion.js). A un desconocido no se le contesta. Cada mensaje entra con un id fijo (`tg-<chat>-<mensaje>`): si Telegram
repite el aviso, no se guarda ni se paga dos veces. La voz la transcribe Whisper (Workers AI, binding `AI`); en local
no hay AI (`npm run dev:worker` usa `--env local`, sin ese binding, porque pide iniciar sesión en Cloudflare).

**Las dos formas de la pantalla** (`useAlmacen`): si `/api/arranque` no contesta JSON, es el prototipo; si contesta,
pide entrar (o crear la única cuenta con `CODIGO_ALTA`) y cada cambio del estado se manda al servidor como DIFERENCIA
(`cambiosEntre` en `src/lib/api.js`). Las pantallas no saben en cuál están: usan `estado` y `cambiar`.

**El servidor** (`worker/`): `index.js` enruta y comprueba el origen; `lib/sesion.js` es el acceso; `lib/almacen.js`
es la ÚNICA capa que consulta D1, y recibe el dueño al construirse (D1 no tiene RLS: una consulta sin `owner_id` no
falla, devuelve datos ajenos; un test falla si aparece un `prepare(` fuera de almacen.js y sesion.js);
`lib/modelo.js` llama a Claude o a Meta por la misma puerta; `lib/ordenar.js` es el asistente que ordena.

**Capturar guarda primero y ordena después**: la captura entra TAL CUAL en `capturas`; si la IA falla, se queda en la
Bandeja con su error. Lo que devuelve el modelo lo comprueba `src/lib/agente.js` (`leerOrden`) antes de que
`aplicarOrden` toque nada, y todo lo aplicado se puede deshacer.

## Reglas que no se rompen

- **El método es GTD + roles (Covey) + Eisenhower + bloques de tiempo**, y las
  repeticiones son RRULE (RFC 5545). La lógica de «Mi día» del calendario de
  marketing NO se usa: a Juan no le gusta.
- **Rojo sólo es una fecha límite REAL que se pasó.** Lo planeado que no salió
  va a «Por decidir», no a atrasadas.
- **El código calcula; la IA interpreta.** Fechas, urgencia y cuándo avisar los
  decide el código. El modelo se equivoca con el día de la semana: se le da la
  tabla de días (`calendarioParaLaIA`) y se comprueba (`diaQueNoCuadra`).
- **Nada suena durante lo protegido** (oración, Palabra, servicios, célula,
  estudio) ni antes del resumen de la mañana, ni en las horas de silencio
  (`avisos.js`).
- **Los versículos salen SÓLO del banco** (`versiculos.js`) por su id; el texto
  lo pone el código. Nunca en un recordatorio ni para reprochar.
- **Muse Spark Contributor entrena con lo que recibe**: se puede escoger, nunca
  es el de partida, su advertencia no se cierra y lo confidencial nunca le
  llega (`ia.js`).
- **Los sombreros no parten el día**: son un color y sirven para planear la
  semana y ver el equilibrio.
- Las fechas son texto «AAAA-MM-DD» y nunca salen de `toISOString()`
  (`fechas.js`).
- Toda la interfaz en español, con tildes y signos de apertura. Accesible:
  diálogos con `useDialogo`, botones con nombre, nada interactivo en un `div`.
- `base` de Vite fija en `/` (en el calendario de marketing, condicionarla dejó
  la página en blanco en producción).
- **El agente sólo cambia lo que el código valida**: horarios de `CLAVES_AJUSTE` (`aplicarAjuste`) y bloques del
  ritmo (`aplicarRitmo`), con horas «HH:MM» y días 0–6. Una fecha pasada no se guarda: se pregunta.
- **El PBKDF2 va en tramos de 100.000** (`derivar` en worker/lib/sesion.js): workerd rechaza más por llamada y ni Node
  ni `wrangler dev` lo aplican. Un test espía `deriveBits`.
- Todo `create` de las migraciones lleva `if not exists` (un test lo exige), y `connect-src` es `'self'` a secas: una
  llave de IA nunca llega al navegador.
- **La entrada tiene tope** (`demasiadosFallos` en worker/lib/sesion.js): 5 fallos por IP o 30 en total en 15 minutos
  dan 429, y se mira ANTES de calcular la contraseña. Una ruta nueva que compruebe un secreto (Telegram, el MCP) tiene
  que pasar por lo mismo.
- La NVI está escogida, pero el banco sigue en RVR1960 hasta tener sus textos exactos: nunca de memoria.
