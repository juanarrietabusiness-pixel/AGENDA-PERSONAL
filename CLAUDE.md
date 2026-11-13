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

**Tu semana por bloques** (`src/lib/semana.js`, el «ritmo» del perfil): BLOQUES con su sombrero (Trabajo 8–12) y
RECORDATORIOS fijos dentro (`clase: "recordatorio"`, `antes` minutos; Proverbios 11:45). Vive en Kairos (Plan → «Tu
semana tipo», `EditarBloque` con la misma comprobación que el asistente: `aplicarRitmo`). «Traer de Google Calendar»
(`rutinaDeGoogle`) pasa la rutina de Google a bloques (marca `google` = la serie: no sale dos veces) y quita lo «por
confirmar» de partida a la misma hora. «Publicar en Google» la escribe, sólo de ida, en un calendario aparte «Kairos ·
Bloques» (`publicarSemana`, una huella por bloque en `conexiones.datos.semana`; se relanza al guardar el perfil si la
semana cambió) que NO se lee de vuelta. Con eso: Hoy → «Ahora» (`ahoraYDespues`, `tareasDelBloque`: las asignadas
—`accion.bloque`— y las de su sombrero para hoy, con su `carga`), Plan → tocar un bloque de un día para asignarle
tareas (`AsignarBloque`), las horas por sombrero salen de los bloques (`horasPorSombrero`), y Telegram avisa al empezar
cada bloque (`avisa`: no los de Reino) y en cada recordatorio con su anticipación, nunca en el silencio (`enSilencio`).
El asistente conoce los bloques (pone `bloque` en una tarea, crea recordatorios fijos como «ritmo»). **Reino** es un
sombrero aparte de Iglesia (intimidad con Dios), el primero; `conReino` lo pone UNA vez al cargar el estado
(`ajustes.reino`) y le pasa lo devocional. **La empresa del día** sale de los días fijos de Mi día en Juancito Ads
(`listar_clientes` → «Días fijos: …», `leerDiasFijos`, `empresasDelDia`; `estado.empresasDeHoy`).

**Tus 3 de hoy** (`enfoqueDelDia`, agenda.js): las fijadas con ★ (`accion.enfoque` = hoy; `completar` ya no lo borra,
así lo hecho sigue a la vista) y, si faltan, las que propone por prioridad; «Hoy no» (`noHoy`); al terminarlas, la
reserva propone lo siguiente. **Lo hecho se borra solo** (`ajustes.borrarHechas`, 7 días por defecto; `purgarHechas` una
vez al día en la vuelta, con la reserva `purga:<día>`), sólo de la agenda.

**Menos ruido, más foco** (decisión de Juan: «que promueva el enfoque, que sea fácil de entender»). En Hoy, «Ahora» y «Tus
3» van en UNA tarjeta corta (`.foco`): el bloque en una línea con «Ver sus N tareas» (filtra la lista) y Tus 3 como filas
compactas (`Fila compacta`: sin tarjeta, sólo lo urgente; ★ fija, ✕ es «Hoy no»). Añadir es una línea; el sombrero sale
como chips AL ESCRIBIR (propone el filtrado o el del bloque de ahora) y los recordatorios se añaden en su pestaña, con
hora. En Plan cada día tiene jerarquía (`diaEnBloques`): el BLOQUE es una franja con sus recordatorios y sus tareas
DENTRO, lo demás aparte, con una leyenda; en el teléfono, un día a la vez. La semana tipo y los sombreros van plegados, y
«Por revisar» (`porRevisar`: sin sombrero, los que se cruzan, lo de ejemplo) se arregla en un toque. Lo que no hace
falta ver siempre, plegado.

**Hoy: el teléfono primero, el tablero en la computadora** (decisión de Juan: «lo primero es ver mis tareas y poder
agregar»; «en la computadora no quiero deslizar»). Un solo marcado con `grid-template-areas`, decidido por el ancho del
CONTENIDO (`@container contenido`, no la ventana: con el asistente abierto al lado se estrecha). Teléfono: saludo corto,
añadir, Ahora + Tus 3, y las listas por pestañas. Desde 760 px de contenido, dos columnas; desde 940, tres (foco, tareas,
agenda) y, en pantallas de 900 px o más, a la altura de la ventana: cada columna se desplaza por dentro y la página no. El
versículo ya no está en Hoy: va en el resumen de la mañana por Telegram y en la barra lateral de la computadora. **La
burbuja es un micrófono** (si el navegador dicta): tocarla escucha al momento, se ve lo dicho y se envía con otro toque;
«Escribir» abre el chat. **Reuniones y eventos nunca se vuelven tarea**: sin hora, «hora por definir» (de todo el día,
`horaPorDefinir`); sin día, «por agendar» (`porAgendar`, sin fecha ni repetición, no va a Google hasta tener día);
`normalizarEvento` lo deja bien al editar o convertir. Reino no lleva reuniones con gente (`sombreroDeEvento`).

**La revisión semanal guiada** (`src/pantallas/Revision.jsx`, en la navegación donde estaba Mentor; `#mentor` lleva ahí):
seis pasos —lo que quedó (mañana, la semana que viene, algún día, ya no aplica), la bandeja, los proyectos sin siguiente
paso (se escribe ahí mismo), lo que esperas de otros, delegar o soltar, y la semana que viene (cómo va cada sombrero y
sus piedras grandes = `importante`)— con el consejo del mentor. «Terminé» deja `ajustes.ultimaRevision`. El aviso de
Telegram del día de la revisión lleva a `#revision`. «Lo que sé de ti» (el cerebro) pasó a Ajustes
(`componentes/Cerebro.jsx`). Hoy mira sólo un día (la semana se mira en Plan) y las filas ya no dicen «valor alto»: el
valor ordena, no se enseña.

**Proyectos con fecha** (`src/lib/proyectos.js`, `componentes/ProyectosConFecha.jsx` en Plan): un evento que pide
preparación. El proyecto lleva la fecha del evento (`limite`); el evento y los ensayos son eventos con `proyectoId`; los
pasos, acciones con `proyectoId`. El asistente los devuelve con el mismo «proyecto»: el evento le da la fecha al proyecto y
el ensayo que se repite se corta el día antes (`hastaElEvento`, UNTIL). La tarjeta dice cuánto falta, cuántos pasos llevas,
el siguiente y el próximo ensayo. La purga no borra los pasos hechos de un proyecto con fecha que sigue activo (son su
progreso). **Telegram con botones por tarea** (`botonesDeVarias`): el aviso de cada bloque y Tus 3 del resumen llevan
«✓ tarea» y «Mañana»; al pulsar se quita sólo esa fila. **Modo enfoque** (`componentes/ModoEnfoque.jsx`, «Enfocarme» en
Tus 3): una tarea a la vez hasta el final del bloque; `ajustes.enfoque = { dia, hasta }` calla los avisos de la escalera y
los de inicio de bloque (`enEnfoque`), no los recordatorios fijos ni las reuniones. **La app se instala**
(`public/manifest.webmanifest` con íconos) y el ícono tiene dos atajos: «Hablar» (`/?hablar=1`, el micrófono listo; si el
navegador no deja escuchar sin un toque, queda el botón «Hablar») y «Añadir» (`/?anadir=1`, el campo con el foco).

**Plan: la semana con horas** (`src/lib/rejilla.js`, `componentes/SemanaRejilla.jsx`; decisión de Juan: «ver el tiempo
que ocupa cada cosa y los espacios libres, todo en la pantalla de la laptop»). En la computadora, un calendario de la
semana: cada pieza del alto de lo que dura (bloques con sus tareas dentro, compromisos y reuniones, tareas con hora), lo
que se cruza lado a lado (`carriles`), «Del día» arriba (lo de todo el día y las tareas sin hora) y los HUECOS LIBRES
(`huecos`, entre el despertar y el dormir de Ajustes; los recordatorios no ocupan) que se tocan para poner ahí algo nuevo,
una reunión por agendar o una tarea sin fecha (`CrearAqui`: toma ese día y esa hora). Lo que no es un bloque (reuniones, rutinas, compromisos) va SIN caja, como texto gris y pequeño con su rango y una línea fina que dice cuánto dura (decisión de Juan: con fondo parecía un bloque); si cae encima de un bloque, va a su derecha sin partir el bloque. Los huecos de menos de una hora sólo se rotulan al pasar por encima. A la derecha, un panel fino
SÓLO del tiempo (ver «Plan sólo para el tiempo»). Desde 940 px de contenido, a la
altura de la ventana (cada lado se desplaza por dentro). En el teléfono, un día a la vez como lista, con los rangos de
hora y los huecos libres entre medias.

**Plan para TRABAJAR en él** (decisión de Juan: «todo debería poder hacerlo en el mismo calendario»). Tres vistas
(`plan-vista` en el navegador): **Semana** (la primera versión: una columna por día, la de partida), **Horas** (la
rejilla, sólo a lo ancho) y **Mes** (`MesVista`: lo especial, reuniones, compromisos que no son rutina y tareas; en el
teléfono, puntos y el día tocado debajo). Se navega por semanas o meses. En cualquiera: «+» de un día o un hueco abre
`CrearAqui` (tarea, reunión, compromiso, recordatorio o bloque, con día y hora puestos; abajo, «o pon aquí algo que ya
tienes»); en Horas se arrastra en lo vacío para crear con ese rango, y se arrastra un bloque, compromiso, reunión de Kairos
o tarea para moverlo (su borde de abajo, `.asa`, para estirarlo; puntero propio en `SemanaRejilla`, con un clic que no
abre nada tras arrastrar). Lo de Google no se mueve aquí. Las tareas (y las reuniones por agendar) se arrastran con
HTML5 (`src/lib/arrastre.js`, tipo MIME propio) a un día, un hueco, un bloque o «Del día». Lo que se repite pregunta
«¿Sólo este día o todas las semanas?» (`Alcance`): sólo un día va a `cambios` del bloque (`aplicarRitmo` con `unDia`:
`{ inicio, fin }`, `{ quitado }` o `{ extra }`; lo de hace más de un mes se olvida) y `semanaDelDia` lo aplica (con `{ tipo:
true }`, la semana tipo sin esos cambios); siempre, `moverSiempre`. «Semana tipo» edita lo que se repite en el MISMO
calendario (sin fechas, el editor de siempre al lado). Un evento de Kairos que se repite sólo cambia de hora arrastrando.
La publicación en «Kairos · Bloques» enseña la semana tipo, no los cambios de un día.

**Plan con más aire, como Google Calendar** (decisión de Juan: «se ve apeñuscado»). La cabecera es una línea (Hoy, ‹ ›,
el rango, las vistas, «Semana tipo» y «Sombreros»). El panel de la derecha se abre y se cierra con «Sombreros» y se FIJA
al lado o FLOTA encima del calendario (la chincheta; Escape lo cierra si flota), recordado en `plan-lado`. El menú de la
izquierda se pliega a sólo iconos con el botón de la cabecera (`nav-plegada`) y lleva debajo el MES CHICO (`MiniMes`):
un puntito de color el día con algo especial o una reunión que no se repite (`marcasDeDias` en agenda.js: lo de cada
semana no, que marcaría todos los días); tocar un día abre su semana en Plan (`irA`) con el día subrayado.

**Las tareas del día van ARRIBA del día en Plan** (como en Google Calendar): `diaEnBloques(…, { soloAsignadas: true })`
sólo mete en un bloque las que se le pusieron (`accion.bloque`); las demás salen arriba (Semana) o en «Del día» (Horas,
con «y N más» que despliega). **«Lo que viene»** (primero en el panel de Plan, también en el teléfono): lo especial y lo
que no se repite de las próximas semanas (`marcasDeDias`, que ahora trae `obj` y `de` para abrirlo); los días de la
semana del teléfono llevan su puntito. **La revisión semanal salió del menú** (decisión de Juan) pero `#revision` sigue
abriéndola (`OCULTAS` en App.jsx: el aviso de Telegram lleva ahí). **En el teléfono**: un «+» junto al micrófono abre
`CrearAqui` para cualquier día; las hojas no se mueven (`useDialogo` fija el body y ajusta la capa a `visualViewport` con
el teclado) y el nombre no abre el teclado solo; en Tareas las columnas se deslizan con el dedo (scroll-snap) y los
chips siguen a la que se ve. OJO: un `.solo-lector` (absoluto) dentro de algo que se desplaza a lo ancho necesita un
ancestro con `position: relative`, o ensancha la página entera en el teléfono (`.tablero`, `.columna-tareas`, `.plan-lado`).

**El compromiso fijo** (`clase: "compromiso"` en el ritmo): se repite y ocupa su tiempo (huecos, horas por sombrero) pero
no es un bloque para meter tareas; se ve en gris, sin caja, y no avisa salvo que se pida. **Pasar a Kairos**
(`rutinaDeGoogle(…, { todas: true })`, el aviso de Plan y el botón de la semana tipo): toda serie de Google que se repite y
es SÓLO suya (sin `conGente`) entra en la semana tipo, como bloque si lleva tareas (`claseParaTraer`: trabajo, task,
57DMC…) y si no como compromiso; desde ahí no se lee de Google (`seriesTraidas`, también en los avisos de reuniones) y se
ofrece publicarla en «Kairos · Bloques». Lo de otras personas sigue viniendo de Google. Se hace desde la Semana tipo
(«Pasar N de Google Calendar a Kairos»): el aviso que salía arriba de Plan se quitó (decisión de Juan: Kairos es el
principal y Google se va desplazando; no hace falta recordárselo en cada visita).

**Tareas: el panorama completo** (`src/pantallas/Tareas.jsx`, `src/lib/tablero.js`; pestaña después de Plan): una
columna por sombrero (con «Sin sombrero» si hace falta), dentro las sueltas, cada empresa (`cliente`) y cada proyecto
(también los que no tienen siguiente paso); filtros, buscar, «Completadas» plegado. Se arrastra para ordenar (`orden`, de
10 en 10; lo que aún no se ordenó va arriba, por prioridad) o a otra columna para cambiar de sombrero (`soltarEnTablero`;
sale del proyecto si es de otro sombrero); con el teclado, Alt + ↑/↓. En el teléfono, una columna a la vez.
**Etiquetas** (`accion.etiquetas`, `limpiarEtiquetas` en metodo.js: sin #, en minúsculas, sin repetir, 8 como mucho): se
escriben al añadir («Llamar a Pedro #llamadas», `leerEtiquetas`) o en Editar; la EMPRESA (`cliente`) cuenta como etiqueta
sola (`tieneEtiqueta`, `etiquetasEnUso`). Una fila de chips filtra el tablero (`tablero(…, { etiqueta })`); con una etiqueta
tuya filtrada, lo que se añade la lleva. **Pasos** (subtareas, `accion.pasos` = [{ id, texto, hecho }], `limpiarPasos`,
`agregarPaso`/`alternarPaso`/`quitarPaso` en tablero.js): «2/4 pasos» debajo del título se despliega y se marcan sin abrir
la tarea (`Pasos`, exportado de Editar.jsx, el mismo en el editor). **Los proyectos se pliegan** y llevan su barra de avance
(`avance` del grupo: hechas sobre todas las del proyecto, aunque las hechas no salgan en la lista). **Los sombreros se editan
aquí** (el lápiz de cada columna: `EditarSombrero`, prioridad, nombre, color, quitar; «+ Sombrero» arriba): ya no en Plan.
No se quita un sombrero con cosas abiertas.

**Qué es cada cosa y cómo se ve** (decisión de Juan: «el gris es sólo para lo que se repite cada semana»). Cuatro tipos
al crear (`CrearAqui`) y al editar: **Bloque** (tiempo con tareas dentro, caja de color; sólo en la semana tipo),
**Evento** (con casillas: «Es con otras personas» = `clase: "reunion"` → icono de personas y aviso por Telegram media hora
antes; «★ Especial» = `clase: "especial"` → color fuerte, ARRIBA del día y además en su hora, y también avisa; «Se repite
cada semana» → si no es con personas ni especial va a la semana tipo como compromiso), **Recordatorio** (campana) y
**Tarea** (arriba del día). En el calendario, `esRutinario` (rejilla.js) decide el gris: lo que se repite cada semana o
cada día (una serie de Google, un evento con FREQ=WEEKLY/DAILY, los compromisos del ritmo); lo de una vez va en color con
el borde de su sombrero, y lo especial nunca es rutina. Un especial con hora sale dos veces: `piezasDelDia` lo mete en su
hora y en «Del día» (`arriba: true`, otra clave), y lo de arriba va en orden: especial, eventos, recordatorios, tareas.
En Semana, lo especial y lo de todo el día van ANTES de las tareas del día. `convertir` a especial conserva la hora (sin
hora queda de todo el día). Un especial con otras personas lleva `conPersonas`. El especial avisa como una reunión
(`seguimiento.js`).

**Plan sólo para el tiempo** (decisión de Juan: Plan es la semana y lo que ocupa tiempo; las tareas viven en Tareas). El
panel de la derecha: Lo que viene, «Añadir un evento o un recordatorio» (`CrearAqui` con `queInicial: "evento"`), Por
agendar, Tareas sin día (`SinDia`: se arrastran a la semana; «Ver todas en Tareas»), Proyectos con fecha y las horas por
sombrero en una barra (`HorasSombreros`). Sin las listas de tareas de cada sombrero.

**El teléfono, quieto y por gestos** (decisión de Juan). En Hoy las pestañas (Tareas, Reuniones, Recordatorios,
Especiales) también se pasan DESLIZANDO con el dedo (`hooks/useDeslizar.js`: el panel sigue un poco al dedo, pasa del
umbral y cambia; lo vertical sigue siendo de la página por `touch-action: pan-y`; no toma lo que empieza en algo que ya se
desplaza de lado, como los chips, ni en un campo). «Crear» (`CrearAqui`) en el teléfono es una PANTALLA ENTERA, no una
hoja: la barra con cerrar y «Crear» queda fija arriba (`.crear-barra`) y sólo se desplaza lo de abajo (`.crear-cuerpo`),
sin moverse de lado (los campos de fecha y hora del iPhone llevan `min-width: 0` y `appearance: none`; ningún `.dialogo`
se desliza de lado). Dentro de esa pantalla, deslizar a los lados cambia el tipo (tarea → evento → recordatorio → bloque,
el mismo `useDeslizar` sobre `.crear-cuerpo`, sólo a pantalla entera); la fila de chips sigue al escogido. En Plan del teléfono (`useMedia("(max-width: 899px)")`), «Lo que viene» y lo pendiente van ARRIBA
(`.plan-primero`) y «Tu día» (la tira de días y el día escogido) debajo, más pequeño: una línea por cosa. «Lo que viene»
lleva además los recordatorios de una sola vez (`marcasDeDias(…, { recordatorios: true })`; el mes chico, no) y cada día va
con lo especial primero y luego por hora.

**Google Tasks: qué sombrero es cada lista** (`sombreroDeLista` en src/lib/sombreros.js, `ajustes.listas` de la cuenta:
un sombrero o «no»): lo escogido manda; si no, el nombre parecido (`nombreParecido`: sin «el», «mis», en singular — «EL
REINO» es Reino, «PERSONALES» es Personal). `listaParaSombrero` usa lo mismo al revés. Se escoge en Ajustes → Google.

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
