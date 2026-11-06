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
a la 0004 ya están aplicadas.

**Telegram** (`worker/lib/telegram.js`): el webhook llega SIN sesión a `/api/telegram/webhook`; vale si trae el
secreto que se le dio a Telegram al conectar (HMAC del token: no hay otro secreto que guardar) y sólo se atiende el
chat atado a la cuenta (`telegram`, con un código de un solo uso cuya huella se guarda; `duenoDeChat`/`vincularChat` en
sesion.js). A un desconocido no se le contesta. Cada mensaje entra con un id fijo (`tg-<chat>-<mensaje>`): si Telegram
repite el aviso, no se guarda ni se paga dos veces. La voz la transcribe Whisper (Workers AI, binding `AI`); en local
no hay AI (`npm run dev:worker` usa `--env local`, sin ese binding, porque pide iniciar sesión en Cloudflare).

**Juancito Ads** (`worker/lib/juancito.js`): la agenda es un CLIENTE del MCP del calendario de marketing, con OAuth 2.1 +
PKCE y registro dinámico, igual que Claude: no hay llaves nuevas. Las llamadas van por el Service Binding `JUANCITO`
(un Worker no puede pedirle a otro de la misma zona por su dominio). El token de renovación ROTA en cada uso: se guarda
siempre el nuevo. El id de cada tarea de allá sale del texto de `ver_tareas` («(id t1)», que añadió el calendario de
marketing para esto) y queda en `accion.juancito.id`. `cambiosDesdeJuancito` es puro: lo hecho allá se marca aquí; lo
nuevo de Juan o sin asignar entra en el sombrero con `fuente: "juancito-ads"`.

**Google** (`worker/lib/google.js`): una conexión por cuenta (`google:<correo>`), los permisos CIFRADOS (AES-GCM, llave
por HKDF del `GOOGLE_CLIENT_SECRET`). Juan usa UNA cuenta (la del trabajo), así que se leen TODOS sus calendarios
(`calendarList`, recordada 6 h en `datos.lista`; los que se ven en Google Calendar, o los de `ajustes.leer`), también los
que otra cuenta le comparte, y lo de cada sombrero se guarda en el calendario de `ajustes.guardarEn` si se puede escribir
en él (`calendarioParaGuardar`; si no, el principal). Los eventos se leen a `externos`, que cada lectura repone ENTERA;
los de todo el día van a «Eventos especiales» (`especialesDelMes(…, externos)`) y los que tienen hora a «Reuniones».
`reunionesDelPeriodo` no repite lo que se creó desde aquí (también las instancias «<id>_…» de un evento que se repite).
**Qué es cada evento de Google lo decide `claseDeGoogle`** (src/lib/agenda.js): de todo el día → especial; con más
gente o que dice «reunión», «mentoría», «cita»… → reunión; que se repite y es sólo suyo (oración, lectura, inicio del
trabajo) → RUTINA, que no ocupa Hoy (una línea plegada) y vive en Plan («Tu semana»). Juan lo cambia por serie
(`ajustes.clasesGoogle[recurringEventId]`, diálogo `EventoGoogle`). **Google Tasks**: cada lista que se llama como un
sombrero es ese sombrero (en los dos sentidos); lo de «Mis tareas» lo pone la IA (`worker/lib/clasificar.js`, una
llamada barata, comprobada por el código; si falla, sin sombrero). Antes caía todo en el primer sombrero de `tareasDe`.

**Qué es cada cosa se cambia a mano** (Editar → «¿Qué es?»): tarea, recordatorio, reunión, evento o especial.
Pasar de acción a evento (o al revés) es `convertir` (agenda.js): se crea lo nuevo con id nuevo y se borra lo de antes,
así Google y Juancito Ads se enteran por el camino de siempre.

**Reflejar** (`worker/lib/reflejar.js`): UN sitio para que un cambio (pantalla, asistente, Telegram, Claude) vaya a
Juancito Ads y a Google. Lo que falla fuera NO deshace lo de aquí: la agenda es la verdad y la vuelta reintenta.

**La vuelta del cron** (`worker/lib/seguimiento.js`, cada minuto): sincroniza Juancito Ads (cada 3 min) y Google (cada
10) y manda por Telegram lo que toca según `ajustes.seguimiento` (`queToca` es puro). Cada mensaje se RESERVA antes de
mandarlo (`avisos_enviados`, clave única): dos vueltas no mandan lo mismo, y si Telegram falla se suelta.

**Claude** (`worker/lib/mcp.js`): la agenda también es un servidor MCP (`/mcp`, `/oauth/*`, `/.well-known/*`, con su
pantalla de permiso en `/autorizar` de la SPA). `capturar` pasa por el MISMO `ordenarCaptura` que la app y Telegram.

**El cerebro** (`src/lib/cerebro.js`, tabla `cerebro`): la ficha va siempre al asistente y las notas que tienen que ver
(BM25) entran por la consulta; lo que aprende (`aprendizajes`) lo comprueba `limpiarAprendizajes` (sin repetir, sin lo
confidencial, tres por vez). **El mentor** (`worker/lib/mentor.js`, `src/lib/agenda.js`): el código calcula valor,
reparto y delegables; la IA sólo da el consejo con eso delante.

**Los sombreros** se pueden renombrar, crear, quitar y reordenar (`ajustes.sombreros`, `aplicarSombrero`): el ORDEN es la
prioridad. Usa siempre `sombrerosDe(ajustes)`, nunca la lista fija `SOMBREROS`, en lo que se ve o se valida.

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
- **Recuperar la contraseña sin correo** (`crearRecuperacion`, `ponerContrasena` en worker/lib/sesion.js): un enlace de un
  solo uso por Telegram al chat atado (15 min, uno cada 2 min, en `oauth_pendientes` con servicio «recuperar», sólo su
  huella) o el `CODIGO_ALTA`. Las dos rutas pasan por el tope de intentos; poner una contraseña cierra TODAS las sesiones.
- La NVI está escogida, pero el banco sigue en RVR1960 hasta tener sus textos exactos: nunca de memoria.
