# Asistente personal: propuesta

Estado a 2026-11-04. Es una propuesta y todavía no hay código. Al final están
las decisiones que te tocan a ti.

---

## 0. En pocas líneas

**Tú sueltas lo que tienes en la cabeza** por Telegram, por Claude o en la
aplicación, escribiendo o con una nota de voz. **El agente lo ordena solo**, te
enseña lo que hizo y puedes deshacerlo con un toque. **Te persigue hasta que lo
cumplas**, sin llenarte de avisos. Y cada semana te enseña si lo que haces te
acerca o no a la visión de cada área de tu vida.

Lo que recomiendo:

1. **Una aplicación aparte y privada**, en este repositorio, con su propia base
   de datos y otro color. No va dentro de Juancito Ads.
2. **El mismo suelo técnico que el calendario de marketing** (Cloudflare Worker
   con D1 y R2, React y Vite, despliegue desde GitHub Actions). Ya lo sabes
   operar, y casi todo lo difícil ya está resuelto allí: se **copia**, no se
   comparte.
3. **Telegram es el canal principal del teléfono.** Sirve para capturar (texto y
   voz) y es **el único canal que te puede avisar con botones** («Hecho»,
   «Mañana», «Ya no»). Claude sirve para conversar, pero no te puede mandar
   avisos por su cuenta. WhatsApp queda para después.
4. **Cada cosa vive en un solo sitio**: el trabajo en Juancito Ads, los eventos
   con hora en Google Calendar y lo demás aquí. Pero **en «Hoy» se ve todo
   junto**, y lo que marques como hecho se cierra en su sitio original.
5. **El cerebro se rescata del calendario de marketing**: búsqueda por pasajes,
   memoria que aprende y reglas que la IA propone y tú aceptas. Se adapta de
   «un cerebro por cliente» a «un cerebro de tu vida».
6. **El agente propone y tú decides** las metas, las subtareas, las reglas y lo
   que se delega. **El código calcula** las fechas, la urgencia y cuándo avisar.
   La IA nunca decide sola cuándo molestarte.
7. **Cuatro pantallas y un botón para capturar.** Si hace falta explicarla, está
   mal hecha.
8. **Costo estimado:** unos 2 a 5 US$ al mes de IA (más detalle en la
   sección 15). Cloudflare, Telegram y Google, gratis para una persona.

---

## 1. Lo que pediste, pieza por pieza

| Lo que pediste | Cómo se resuelve | Fase |
|---|---|---|
| Decirle cosas por Telegram, Claude o la aplicación, por voz o escribiendo | Tres puertas que llegan al **mismo agente**. La voz se transcribe antes de que la lea el agente | 1 y 2 |
| Que lo organice solo por áreas, proyectos, tareas y recordatorios | El agente clasifica cada captura (qué es, de qué área, de qué proyecto, para cuándo) y te enseña una tarjeta con «Cambiar» y «Deshacer» | 1 |
| Que aprenda tu estilo de vida | El cerebro: tu perfil, tus personas («Adolfo, hermano de la iglesia») y tus reglas. Aprende de cada corrección que haces | 1 (lo básico) y 5 |
| Seguimiento hasta que lo cumplas | Una escalera de avisos según la importancia, la pregunta «¿Lo hiciste?» con botones y el cierre del día | 1 (lo básico) y 3 |
| Avisar cuando algo pasa de importante a urgente | El **código** calcula la urgencia por fecha y avisa una sola vez cuando cruza la línea | 3 |
| Sugerir qué delegar y qué vale poco | Cada tarea lleva su valor (alto, medio o bajo) y si se puede delegar, a quién y por qué. Sale en la revisión semanal | 3 |
| Visión por área, meta anual y su reparto en semestres, meses y semanas | Una cascada de metas que la IA propone y tú ajustas. Cada tarea se puede ligar a una meta | 4 |
| Que te dé seguimiento a esas metas y te diga si una tarea vale la pena | La revisión semanal: el avance de cada meta, lo que está fuera de rumbo y las 3 prioridades de la semana siguiente | 4 |
| Que el trabajo se guarde en tu calendario de trabajo y se vea aquí | Las tareas de trabajo se crean **en Juancito Ads** (donde las ve el equipo) y se leen desde aquí | 2 |
| Que los eventos vayan a Google Calendar y se vean aquí | Va y viene: lo que crea el agente va a Google y lo que creas en Google sale aquí | 2 |
| Rescatar lo que sirva del calendario de marketing | Ver la sección 14: el cerebro, «Mi día», el MCP, el acceso, la conexión con Google, el dictado y los tokens de diseño | Todas |
| Fácil de entender en la computadora y en el celular | Cuatro pantallas, un botón de captura, «Hoy» como pantalla de inicio y dos columnas en la computadora | 1 |

---

## 2. Los principios que no se rompen

1. **Capturar tarda tres segundos y nunca se pierde.** Lo que dices se guarda tal
   cual **antes** de que la IA lo lea. Si la IA falla o se acaba el presupuesto,
   la captura queda en la Bandeja y se ordena después. Es la misma idea del
   calendario de marketing: la base de datos es la verdad.
2. **El agente hace y te enseña lo que hizo, en vez de preguntar.** Sólo pregunta
   cuando falta algo esencial, como la hora de una reunión o una fecha que ya
   pasó. Todo lo demás sale con «Deshacer».
3. **Cada cosa vive en un solo sitio, y aquí se ve todo.** El trabajo, en
   Juancito Ads. Los eventos, en Google Calendar. Lo personal, aquí.
4. **La IA propone y tú decides** en todo lo que pesa: metas, subtareas de un
   proyecto, reglas nuevas del cerebro y qué delegar.
5. **El código calcula y la IA interpreta.** La IA entiende «el jueves después
   del culto». El código comprueba que esa fecha cae en jueves, calcula si es
   urgente y decide cuándo avisar. En el calendario de marketing, el modelo dijo
   una vez que el domingo 4 de octubre «no existía»: las fechas no se le
   confían.
6. **Pocos avisos, pero buenos.** Si te avisa de todo, aprendes a no hacerle
   caso. Hay horas de silencio, un tope de avisos al día y los avisos se
   agrupan.
7. **Sencilla.** Cuatro pantallas. Una función que no cabe ahí espera a que el
   uso diario la pida.

---

## 3. El recorrido de una captura

```
 Telegram (texto o voz) ─┐
 Claude (MCP) ───────────┼──▶ 1. CAPTURA guardada tal cual (nunca se pierde)
 La aplicación ──────────┘            │   La voz pasa antes por la transcripción
                                      ▼
                         2. EL AGENTE la lee con el CEREBRO delante:
                            tu perfil, tus áreas y proyectos, tus personas,
                            tus reglas, hoy y los próximos 14 días
                                      │
                    ┌─────────────────┼──────────────────────┐
                    ▼                 ▼                      ▼
            Tarea, recordatorio,   Evento con hora        Algo del trabajo
            idea, fecha especial   (reunión, ensayo)      (un cliente pidió…)
            → aquí                 → Google Calendar      → Juancito Ads
                                     y aquí                 y se ve aquí
                    └─────────────────┬──────────────────────┘
                                      ▼
                         3. TARJETA de vuelta, por el mismo canal:
                            «Reunión con Adolfo · Iglesia › Reuniones ·
                             jue 12 nov, 7:00 p. m. · en Google Calendar»
                             [Cambiar] [Deshacer]
                                      │
                                      ▼
                         4. AVISOS planificados según su importancia
                            (el código, no la IA)
                                      │
                                      ▼
                         5. Lo que corriges ENSEÑA al cerebro
```

---

## 4. Ejemplos: lo que dices y lo que hace

Hoy es miércoles 4 de noviembre de 2026.

| Lo que dices | Qué es | Dónde queda | Qué más hace |
|---|---|---|---|
| «Agenda una reunión con mi hermano Adolfo de la iglesia el jueves a las 7» | Reunión | Iglesia › Reuniones, y Google Calendar: jue 5 nov, 7:00 p. m. (ver la nota de abajo) | Guarda que Adolfo es de la iglesia. La próxima vez basta con decir «reunión con Adolfo». Al terminar te pregunta si salieron tareas |
| «Acuérdame comprar el perfume para mi esposa» | Recordatorio | Familia › Compras | Sin fecha, sale en el resumen de la mañana. Si dices «antes del viernes», te avisa el jueves |
| «Tengo una presentación el 3 de octubre» | Proyecto con fecha | Liderazgo › Presentaciones | El 3 de octubre ya pasó, así que pregunta si es el de 2027. Propone subtareas hacia atrás (mensaje, borrador, diapositivas, ensayo, logística) y entran cuando las aceptas |
| «El cliente Dcasa me pidió cambiar el logo del perfil» | Tarea de trabajo | Juancito Ads, cliente Dcasa | Sale en tu «Hoy». Si la marcas hecha aquí, se cierra allá |
| «Idea: un retiro de jóvenes en enero» | Idea | Iglesia › Ideas | No tiene fecha ni avisos. Sale en la revisión semanal por si quieres convertirla en proyecto |
| «Idea para Baby Caleb: un reel del baño» | Idea de contenido | El banco de ideas de Juancito Ads | La agencia ya tiene su banco de ideas. No se duplica aquí |
| «El cumpleaños de mi mamá es el 12 de marzo» | Fecha especial | Familia | Se repite cada año. Avisa siete días antes («¿regalo?») y el mismo día |
| «Ensayo de la banda todos los martes a las 7:30» | Evento que se repite | Música, y Google Calendar | Un solo evento que se repite, no 52 copias |
| «Ya hablé con Adolfo» | Cierre | — | Busca lo pendiente con Adolfo, lo marca hecho y te lo dice |

> **Nota sobre «el jueves».** Si lo dices un miércoles, ¿es mañana o el de la
> semana que viene? El agente toma el más cercano y lo deja escrito en la
> tarjeta («jue 5 nov»). Si te equivocas, lo cambias. Si aprende que tú dices
> «el jueves» por el de la semana siguiente, eso se vuelve una regla que
> propone y tú aceptas.

---

## 5. Cómo se organiza tu vida

Cuatro niveles. Si hubiera más, dejaría de ser sencilla.

```
ÁREA            Iglesia · Familia · Trabajo · Música · Liderazgo · Salud · Finanzas · Personal
 └ PROYECTO     con final:  «Presentación del 3 de octubre», «Retiro de jóvenes»
   o LISTA      permanente: «Reuniones», «Presentaciones», «Compras», «Ideas»
    └ ELEMENTO  la tarea, el evento, el recordatorio, la idea…
       └ SUBTAREAS
```

**Las áreas** las escoges tú, entre 6 y 8. Cada una tiene un color, su visión y
sus metas. Las de arriba son una sugerencia sacada de lo que contaste: iglesia,
familia (con tu esposa), trabajo (Juancito Ads), música y liderazgo.

**Qué puede ser cada elemento:**

| Tipo | Qué es | Avisa | Va a |
|---|---|---|---|
| Tarea | Algo que haces y se tacha | Sí, según su importancia | Aquí (o Juancito Ads si es del trabajo) |
| Evento | Tiene hora y duración: reunión, ensayo, culto | Lo avisa Google, y aquí se preparan las tareas de antes y las de después | Google Calendar y aquí |
| Recordatorio | Algo ligero a una hora o sin ella | Sí, a su hora o en el resumen | Aquí |
| Idea | Sin fecha y sin avisos | No; sale en la revisión semanal | Aquí (o el banco de ideas de la agencia) |
| Fecha especial | Cumpleaños, aniversario, feriado | Siete días antes y el mismo día | Aquí, y en Google si quieres |

**Importante y urgente no son lo mismo**, y no los decide el mismo:

- **La importancia (alta, normal o baja) la propone el agente** con tu visión
  delante, y tú la cambias. Es alta si sirve a una meta del año, si es un
  compromiso con otra persona (una reunión, una entrega, la familia) o si
  dejarla tiene consecuencias serias.
- **La urgencia la calcula el código** con la fecha: vence hoy o mañana, o ya se
  pasó. Cuando una tarea importante entra en esa ventana, te avisa una vez: «Esto
  pasó a urgente».

**Las personas** son la manera en que el agente entiende tu vida. «Adolfo,
hermano de la iglesia», «mi esposa», «el equipo de Juancito Ads», «el pastor».
Cada una tiene su nombre, sus apodos, su relación y su área. Con eso el agente
sabe a dónde va una reunión y a quién se le puede delegar algo.

---

## 6. Dónde vive cada cosa

| Qué | Dónde vive | Cómo se ve aquí | Si lo marcas hecho aquí |
|---|---|---|---|
| Trabajo y clientes | **Juancito Ads** (el equipo lo ve) | En «Hoy», con la etiqueta del cliente | Se cierra en Juancito Ads |
| Eventos con hora | **Google Calendar** | En «Hoy» y en el calendario | — (los eventos no se tachan) |
| Personal, iglesia, música, familia | **Aquí** | Todo | Aquí |
| Ideas de contenido para un cliente | **Banco de ideas de Juancito Ads** | No hace falta | — |

**La regla para decidir:** si un cliente o el equipo debería enterarse, va a
Juancito Ads. Tú no tienes que pensarlo: capturas aquí y el agente lo manda a su
sitio.

### Cómo habla esta aplicación con Juancito Ads

Lo mejor es una **conexión directa entre los dos Workers** (Service Binding con
RPC de Cloudflare). La aplicación personal llama a funciones de Juancito Ads como
`tareasDe(persona)`, `crearTarea(…)` y `completarTarea(id)`.

- **No sale a internet y no tiene dirección pública.** Una función así no se
  puede llamar desde fuera, así que no hay ninguna llave que se pueda filtrar.
- **Exige un cambio pequeño en el calendario de marketing:** un archivo que
  expone esas tres funciones y pasa por la misma capa de acceso de siempre
  (`acceso.js`), atada a tu espacio y a tu persona.
- **Lo que se ve aquí** son tus tareas de trabajo (las asignadas a ti y las sin
  asignar, igual que «Mías» en Mi día). Las lecturas se guardan unos minutos
  para no pedir lo mismo varias veces.
- **Si Juancito Ads no contesta,** «Hoy» enseña lo último que leyó y lo dice. La
  aplicación personal no se cae por eso.

Hasta que exista esa conexión (fase 2), Claude ya puede hacer de puente con los
dos conectores a la vez: el de Juancito Ads (`ver_tareas`, `crear_tarea`,
`completar_tarea`) y el de esta aplicación.

### Google Calendar

- **Se conecta una vez** con tu cuenta de Google. El permiso se guarda cifrado,
  igual que hace el calendario de marketing con Drive (`worker/lib/google.js`).
- **Cada área puede ir a un calendario de Google distinto.** Por ejemplo,
  Iglesia a «Iglesia» y Trabajo a tu calendario de trabajo. Así también sirve si
  «mi calendario de trabajo» es un calendario de Google y no Juancito Ads.
- **Va y viene.** Lo que crea el agente va a Google con una marca oculta (el id
  del elemento) para no duplicarlo nunca. Lo que creas en Google se lee aquí con
  la sincronización por cambios de Google (`syncToken`), cada pocos minutos y al
  abrir la aplicación.
- **No usa Google Tasks.** Es demasiado básico: sin áreas, sin importancia y sin
  seguimiento.
- **La trampa conocida:** con la app de Google «en prueba», el permiso caduca a
  los 7 días. Tiene que estar «en producción». El proyecto de Google de la
  agencia ya pasó por eso con Drive, y se puede reutilizar añadiendo el permiso
  de Calendar.

---

## 7. Seguimiento hasta que lo cumplas

Aquí está el valor de verdad, y también el riesgo: un asistente que avisa
demasiado se termina silenciando.

### Los cuatro momentos fijos del día

| Cuándo (se puede cambiar) | Qué te manda | Por dónde |
|---|---|---|
| **6:30 a. m. · Resumen de la mañana** | Eventos de hoy, tus 3 prioridades, lo urgente y cuántas atrasadas hay. Lo arma el código, sin IA | Telegram |
| **A su hora** | Los recordatorios con hora y lo que hay que preparar antes de un evento | Telegram |
| **9:00 p. m. · Cierre del día** | «Hiciste 5 de 8. ¿Qué hacemos con las 3 que faltan?», con botones en cada una | Telegram |
| **Domingo · Revisión semanal** | Las metas, lo atascado, lo que se puede delegar o soltar y las prioridades de la semana | Telegram, que lleva a la aplicación |

### La escalera de avisos de una tarea con fecha

| Importancia | Antes | El día | Si se pasa |
|---|---|---|---|
| **Alta** | 7 días antes (sólo si tiene subtareas: «¿empezaste?») y 2 días antes | En el resumen, y una hora antes si tiene hora | Al día siguiente: «¿La completaste?» |
| **Normal** | 1 día antes | En el resumen | Al día siguiente: «¿La completaste?» |
| **Baja** | — | En «Hoy», sin aviso | Pasa a atrasadas, sin aviso |

### «¿Lo completaste?» y sus botones

```
⏰ Enviar la propuesta a Dcasa — vencía ayer
[✓ Hecho]  [Mañana]  [Elegir día]  [Delegar]  [Ya no aplica]
```

- Si **no contestas**, te vuelve a preguntar al día siguiente, **tres veces como
  mucho**. Después pasa a **«Atascadas»** en la revisión semanal y deja de
  avisar.
- Si la **pospones tres veces**, el agente pregunta otra cosa: «¿Sigue valiendo
  la pena? Hacerla · Delegarla · Soltarla». Postergar algo una y otra vez dice
  algo de su valor o de cómo está planteada.
- Con **«Ya no aplica»** la tarea queda soltada, no borrada. Eso también le
  enseña al cerebro.

### Las guardas contra el cansancio

- **Horas de silencio** de 10:00 p. m. a 6:00 a. m. Lo que caiga ahí sale en el
  resumen de la mañana.
- **Tope diario** de avisos sueltos, unos 8. Por encima, se agrupan.
- **Varios avisos a la misma hora salen en un solo mensaje.**
- **Modo «domingo»** (opcional): ese día sólo avisa de lo de Iglesia y Familia.
- **Una tarea de baja importancia nunca manda un aviso suelto.**

---

## 8. El valor de cada tarea y qué delegar

Cada tarea lleva, propuestos por el agente:

- **Valor: alto, medio o bajo,** con una línea de por qué: «sirve a la meta
  "Lanzar el ministerio de jóvenes"», «nadie más tiene la relación con el
  cliente», «es operativa».
- **Se puede delegar: sí o no, a quién y por qué.** Por ejemplo, «Reservar el
  salón · la puede hacer alguien del comité de jóvenes».

Se cruza en la **matriz de siempre**, que es fácil de leer:

|  | **Urgente** | **No urgente** |
|---|---|---|
| **Importante** | **Hazla tú, ya** | **Agéndala** (aquí se construye la visión) |
| **No importante** | **Delégala** | **Suéltala** o déjala para algún día |

- **Dónde se ve:** como una etiqueta pequeña en la tarea y, sobre todo, en la
  revisión semanal: «5 cosas que podrías delegar» y «3 que podrías soltar».
- **Nunca se delega solo.** Si es del trabajo y aceptas, el agente crea la tarea
  en Juancito Ads asignada a esa persona, y te lo confirma antes.
- **Lo que hace a esto inteligente es tu visión.** Sin metas escritas, el agente
  sólo puede adivinar el valor. Por eso la fase 4 importa tanto.

---

## 9. De la visión a la semana

```
VISIÓN del área     «Una iglesia donde los jóvenes lideran»       (3 a 5 años, texto libre)
 └ META DEL AÑO     «Formar 10 líderes jóvenes en 2027»            (1 a 3 por área, medibles)
    └ SEMESTRE      «Ene–jun: escoger y empezar con los 10»
       └ MES        «Enero: lista de candidatos y primer encuentro»
          └ SEMANA  «Hablar con 3 candidatos» → tareas reales en tu calendario
```

- **Tú escribes la visión y la meta del año.** Con «Proponer el reparto», la IA
  sugiere los hitos de cada semestre y de cada mes. Los aceptas, los corriges o
  los quitas. Nada entra sin tu sí.
- **Cada semana** el agente propone las tareas que acercan cada meta y las 3
  prioridades de la semana. Tú escoges.
- **Cada tarea que capturas** se intenta ligar a una meta. Cuando no sirve a
  ninguna meta y no es urgente, es candidata a «bajo valor». Así responde la
  pregunta «¿vale la pena?».
- **El avance** se ve como una barra por meta: hitos cumplidos frente a los
  previstos hasta hoy. Una meta que no se mueve en tres semanas sale marcada en
  la revisión.
- **Revisión mensual y de semestre:** los mismos datos, un nivel más arriba, y la
  pregunta de si una meta sigue siendo la correcta.

**El freno:** como mucho tres metas por área y sólo hitos mensuales. Más que eso
se vuelve una hoja de cálculo que nadie mira.

---

## 10. El cerebro

El cerebro del calendario de marketing es de lo mejor que tiene esa aplicación, y
**casi todo su motor es puro**: no toca la base ni la red, así que se copia sin
cambios. Lo que cambia es **qué guarda** y **de qué aprende**.

### Qué guarda

| Tipo de nota | Qué es | Cuándo la lee el agente |
|---|---|---|
| **Perfil** | Quién eres, tus roles, tu ritmo (a qué hora rindes, qué día es de la iglesia) | **Siempre** |
| **Visión** (una por área) | La visión y las metas vigentes | **Siempre** |
| **Pautas** | Tus reglas: «las reuniones de iglesia van los martes», «nada del trabajo los domingos» | **Siempre** |
| **Persona** | Adolfo, tu esposa, el pastor, el equipo: quién es y de qué área | Cuando aparece en la captura |
| **Decisión** | Lo que aprendió y tú aceptaste | Cuando aplica |
| **Nota / idea** | Lo que le dictas para que lo recuerde | Cuando se busca |

Al principio todo cabe en una sola llamada: el perfil, las visiones, las pautas y
unas decenas de personas no pasan de unos 4.000 tokens. Cuando crezca, el motor
de búsqueda por pasajes (BM25) trae sólo lo que esa captura necesita, igual que
en el calendario de marketing.

### De qué aprende

En el calendario de marketing aprende de la respuesta del cliente, de los
resultados en redes y de las correcciones del equipo. Aquí las señales son tuyas:

| Señal | De dónde sale | Qué enseña |
|---|---|---|
| **Corrección de clasificación** | Moviste algo a otra área o proyecto, o cambiaste su importancia | «Lo de Adolfo va a Iglesia», «"la banda" es Música» |
| **Cumplido o soltado** | Lo hiciste a tiempo, tarde, lo pospusiste o lo soltaste | Qué clase de tareas sí haces y cuáles te estorban |
| **Cuándo cumples** | A qué hora y qué día tachas cada clase de tarea | Sugerir el mejor momento: «lo creativo te sale en la mañana» |
| **Lo que dices con tus palabras** | «Nunca me pongas cosas el domingo» | Una regla expresa |

Y las **guardas** se copian tal cual, porque ya funcionan:

- **La IA propone reglas y una persona (tú) las acepta, corrige o descarta.**
  Ninguna entra sola, y una descartada no se vuelve a proponer.
- **Una regla necesita dos casos de respaldo,** salvo que la hayas dicho como
  orden. Esto lo comprueba el código, no la IA.
- **Si no hay nada nuevo desde la última vez, ni se llama a la IA.**

### Qué NO se trae

La importación desde GitHub, el mapa 3D (puede venir después, porque es bonito),
el filtro de maquetación, «Saber del rubro», la voz UGC y el candado de «interna»
(aquí todo es privado: eres el único que entra).

---

## 11. Los canales

### Telegram: el principal en el teléfono

- **Por qué Telegram y no WhatsApp:** su API para bots es gratuita, no necesita
  aprobación de Meta, recibe notas de voz y tiene **botones dentro del mensaje**
  y **mensajes que se editan** (llega «Anotando…» y se convierte en la tarjeta).
  WhatsApp Business exige una cuenta de empresa verificada, plantillas aprobadas
  y cobra por conversación. Se puede sumar después: es un canal más que llega al
  mismo agente.
- **Es TUYO y de nadie más.** Un bot de Telegram lo puede encontrar cualquiera.
  Se conecta desde la aplicación con un código de un solo uso, y desde ahí el
  Worker **sólo atiende tu chat**. Todo lo demás se ignora sin contestar.
- **El webhook se firma.** Telegram manda un secreto en cada llamada
  (`X-Telegram-Bot-Api-Secret-Token`), y lo que llega sin él se rechaza.
- **La voz:** Telegram la entrega como archivo OGG. Se baja, se transcribe y
  entra como si la hubieras escrito. La transcripción queda guardada con la
  captura.
- **Conversación corta:** si el agente pregunta «¿a qué hora?», tu siguiente
  mensaje se lee como la respuesta. Recuerda lo de los últimos minutos, no todo
  el historial.
- **A tener en cuenta:** los mensajes con un bot no van cifrados de punta a
  punta. Pasan por los servidores de Telegram. Para tareas y recordatorios es
  aceptable. Para algo muy delicado (una contraseña, un dato bancario), mejor la
  aplicación.

### La aplicación: en el celular y en la computadora

- **Se instala como aplicación** desde el navegador (PWA), con su icono.
- **Botón de captura en todas las pantallas:** escribes, o lo mantienes pulsado
  para dictar (`dictado.js`, que ya funciona en el chat de la agencia). Como en
  el iPhone el dictado del navegador es irregular, también hay **grabar nota de
  voz**, que sigue el mismo camino que la de Telegram.
- **Avisos del navegador (Web Push):** más adelante, como segundo canal. En el
  iPhone sólo funcionan con la aplicación añadida a la pantalla de inicio.
  Telegram los cubre mientras tanto.

### Claude (MCP): para conversar y planear

- La aplicación tiene **su propio servidor MCP**, copiado del de Juancito Ads con
  su OAuth. Se añade una vez en claude.ai → Conectores y funciona en Claude web,
  en el escritorio y en el móvil.
- **La herramienta principal es `capturar`:** Claude le pasa tu frase al MISMO
  agente de la aplicación, y así lo que entra por Claude se clasifica y aprende
  igual que lo de Telegram. Una sola forma de clasificar, no dos que acaben
  discrepando. Además están `ver_hoy`, `ver_semana`, `buscar`, `completar`,
  `posponer`, `ver_metas` y `revision_semanal`.
- **Claude no te puede mandar avisos por su cuenta.** Es Telegram el que avisa.
  Lo que sí puede hacer Claude es una **tarea programada** (el resumen de la
  mañana por correo o en la app de Claude), que es justo la fase 0.
- Con el conector de Juancito Ads puesto a la vez, Claude ve las dos cosas.

### La transcripción de la voz

La API de Claude no recibe audio, así que hace falta un paso antes. Recomiendo
**Whisper en Workers AI de Cloudflare**: corre en la misma cuenta, no necesita
otra llave y lo usaría una sola persona. Si en la prueba no entiende bien el
español de Panamá, se usa **Gemini**, que el calendario de marketing ya usa para
oír audio (`verVideo` con `audio: true`). La transcripción se enseña en la
tarjeta («Entendí: …»), así que un error se ve en el momento.

---

## 12. Las pantallas

Cuatro pestañas y un botón. En el teléfono van en la barra de abajo y en la
computadora a la izquierda.

| Pestaña | Qué tiene |
|---|---|
| **Hoy** (la de inicio) | Arriba lo **urgente** en rojo. Luego la **agenda del día** (los eventos de Google y del trabajo en una línea de tiempo), **tus 3 prioridades**, las **tareas de hoy** con el color de su área y las **atrasadas** con el repaso de la mañana. Abajo, cuántas capturas esperan en la Bandeja |
| **Calendario** | La semana (por defecto) o el mes, con los eventos y las tareas con fecha. Se arrastra para cambiar de día |
| **Áreas** | Cada área con su visión, sus metas con barra de avance, sus proyectos, sus listas y sus personas |
| **Asistente** | La conversación con el agente (la misma de Telegram), la Bandeja de lo que no supo clasificar y las revisiones semanales |

**El botón de capturar** flota en todas: escribes o hablas.

**En la computadora,** «Hoy» va a dos columnas: las tareas a la izquierda y la
agenda de la semana a la derecha.

**Cómo se ve:** la misma familia que Juancito Ads (los tokens de `index.css`, los
iconos de `Icon.jsx` y los diálogos accesibles), pero **con otro acento y otro
nombre**. Juancito Ads es azul (`#1E90FF`). Aquí propongo **verde esmeralda**,
para que al abrirla sepas en qué modo estás. Como nombre de trabajo propongo
**«Norte»**: la visión marca el rumbo y las tareas son los pasos. Tú decides.

---

## 13. Cómo está hecha por dentro

| Pieza | Qué | Por qué |
|---|---|---|
| Servidor | **Un Cloudflare Worker** con la aplicación y la API en el mismo origen | Como el calendario de marketing: cookie `__Host-` y CSP estricta |
| Datos | **D1** (`agenda-db`, aparte) y **R2** para los audios | Tu vida no se mezcla con la base de la agencia |
| Interfaz | **React 19 y Vite**, instalable | Lo mismo que ya conoces |
| Reloj | **Un cron cada minuto** que manda los avisos que tocan | El mismo patrón que la cola de publicación |
| IA | **Claude**: Haiku 5.5 para clasificar y Sonnet 5.5 para planear | Ver la sección 15 |
| Voz | **Whisper en Workers AI**, con Gemini de respaldo | Ver la sección 11 |
| Canales | Webhook de **Telegram**, **MCP** con OAuth y la aplicación | Ver la sección 11 |
| Fuentes | **Google Calendar** (OAuth) y **Juancito Ads** (Service Binding con RPC) | Ver la sección 6 |
| Despliegue | **GitHub Actions**: `verificar` en verde y después desplegar | Como el calendario de marketing: nada se despliega a mano |

**No hace falta un Durable Object al principio.** En el calendario de marketing
sirve para que dos personas se vean escribir. Aquí eres uno, y basta con releer
al volver a la pestaña. Si algún día compartes un área con tu esposa, se añade.

### Las tablas (D1)

```
usuarios, sesiones, mcp_*            el acceso (copiado de Juancito Ads)
areas                                nombre, color, icono, visión, calendario de Google
proyectos                            área, nombre, ¿permanente?, fecha límite, meta
elementos                            tipo, título, notas, área, proyecto, padre (subtarea),
                                     estado, importancia, fecha planeada, vence, hora,
                                     duración, recurrencia, meta, personas, valor,
                                     delegable, origen, captura, id en Google, id en Juancito Ads,
                                     veces pospuesta, completado
capturas                             texto, audio, transcripción, canal, estado, qué hizo el agente
metas                                área, nivel (año · semestre · mes · semana), padre, periodo,
                                     medida, avance
avisos                               elemento, momento, clase, estado, canal, intentos,
                                     id del mensaje de Telegram
personas                             nombre, apodos, relación, área
cerebro_notas, cerebro_senales,      el cerebro (copiado y adaptado)
cerebro_propuestas
conexiones                           Google (cifrado), Telegram (tu chat)
conversacion                         los mensajes con el agente (Telegram, la aplicación y Claude)
ajustes, consumo_ia                  horarios, silencio, presupuesto de IA, gasto
```

Todas llevan `owner_id` desde el primer día. Eres uno solo, pero ese campo es lo
que permitiría compartir algo después sin rehacer la base, y la capa de acceso
del calendario de marketing ya funciona así.

---

## 14. Lo que se rescata del calendario de marketing

Esto revisé en `CALENDARIOS-MARKETING-APP`. Se **copia** a este repositorio, sin
paquete compartido, por la misma razón que ya decidió la agencia con Agents
Office: dos repositorios con un paquete en común es trabajo extra que hoy no
compensa.

### Se copia casi tal cual

| Archivo allá | Para qué aquí | Cambio |
|---|---|---|
| `worker/lib/cerebro/conocimiento.js` | Buscar en el cerebro por pasajes (BM25, sin tildes, con plurales) | Ninguno: es puro |
| `worker/lib/cerebro/memoria.js` | Menciones, resúmenes, presupuesto de contexto y pesos que aprenden | Ninguno: es puro |
| `src/lib/agenda.js` | **El corazón de «Hoy»**: el hoy de Panamá, atrasadas, recurrentes (semanal, mensual, «último viernes»), «¿cuándo toca?» y «hace 3 días» | «Empresa» pasa a ser «área» |
| `src/lib/semanaTareas.js` | La semana de lunes a sábado con arrastrar | «Empresa» pasa a ser «área» |
| `src/lib/horas.js` | Entender «930», «9:30 pm», «21:30» | Ninguno |
| `src/lib/fechasEspeciales.js` | Feriados de Panamá (Pascua y Carnaval calculados) y fechas propias | Quitar las comerciales |
| `src/lib/dictado.js` | El micrófono que escucha hasta que lo vuelves a pulsar | Ninguno |
| `src/lib/idioma.js` | La regla del español latino neutro | Ninguno |
| `worker/lib/anthropic.js`, `flujoAnthropic.js` | Llamar a Claude en streaming, reintentar y explicar los rechazos | Ninguno |
| `worker/lib/configIA.js` | El presupuesto mensual de IA, el consumo y el tope | Con los modelos 5.5 (ver la sección 15) |
| `worker/lib/sesion.js` | Contraseña (PBKDF2 en tramos de 100.000), cookie `__Host-` y los tokens del MCP | Sin invitaciones ni equipo |
| `worker/rutas/mcp.js`, `worker/lib/mcp.js` | El servidor MCP con su OAuth para Claude | Otras herramientas |
| `worker/lib/google.js`, `firmas.js` | OAuth de Google, permiso cifrado y `state` firmado | De Drive a Calendar |
| `worker/lib/acceso.js` | La capa que acota todo por dueño | Más sencilla: un solo papel |
| `worker/lib/respuesta.js`, `public/_headers` | Cabeceras de seguridad y CSP | Ninguno |
| `src/index.css`, `components/Icon.jsx`, `hooks/useDialogA11y.js`, `useAltoVisible.js`, `useAnchoAmplio.js` | El sistema de diseño, los iconos y la accesibilidad | Otro acento |
| `components/SelectorFecha.jsx`, `ElegirDia.jsx`, `RepasoAtrasadas.jsx`, `hooks/useRepaso.js`, `useArrastrarOrden.js` | Escoger fecha, «¿cuándo la haces?», el repaso de la mañana y ordenar arrastrando | Textos |
| `src/lib/rutas.js` | El router propio de 150 líneas | Otras direcciones |
| `tests/utils/d1Memoria.js` y las guardas de `tests/despliegue/` | Una D1 de verdad en los tests; CSP, migraciones con `if not exists` y acceso | Ninguno |
| `.github/workflows/ci.yml`, `desplegar.yml`, `sembrar-admin.yml` | Verificar y desplegar sólo desde Actions | Otros nombres |

### Se adapta

| Allá | Aquí |
|---|---|
| `cerebro/notas.js` (ficha, cifras, pautas, marca…) | Perfil, visión, pautas, persona, decisión, nota |
| `cerebro/cerebro.js` (un índice por cliente en R2) | Un solo índice, el tuyo |
| `cerebro/senales.js`, `aprender.js`, `proponer.js` | Las señales de la sección 10 en lugar de las del cliente y las redes. **Las guardas se copian tal cual** |
| `worker/lib/geminiVideo.js` (`verVideo` con audio) | El respaldo de la transcripción |
| El bucle de herramientas del asistente (`rutas/chat.js`, `herramientasServidor.js`) | El agente clasificador y el de planear, con menos herramientas |
| `src/lib/turnoChat.js` | Recuperar una respuesta que se cortó al bloquear el teléfono |

### Las trampas que ya se pagaron allí y no se pagan otra vez

- **`toISOString()` para una fecha cambia el día** a partir de las 7 de la noche
  en Panamá. Se usa `fechaEnZona()`.
- **workerd no acepta más de 100.000 vueltas de PBKDF2 por llamada.** En local
  funciona y en producción da «Error interno».
- **Todo `create` lleva `if not exists`.** Si no, un despliegue muere al
  reaplicar el esquema.
- **Un id de modelo fijo es una apuesta sobre la cuenta.** Se resuelve contra
  `/v1/models` y, si no está, se usa el siguiente.
- **Google «en prueba» caduca a los 7 días.**
- **`no-undef` en el lint.** Una constante sin importar dejó media aplicación en
  blanco con todos los tests en verde.
- **El modelo calcula mal el día de la semana.** Se le da la tabla de los
  próximos 14 días y el código lo comprueba.
- **Un aviso que sale siempre deja de significar algo.** Sólo se avisa cuando
  algo cambió.
- **«Muse Contributor» entrena con lo que recibe.** No se usa aquí: es tu vida
  privada.

---

## 15. Cuánto cuesta

**Cloudflare:** el plan gratuito sobra para una persona (Worker, D1, R2, el cron
y, casi seguro, la transcripción de Workers AI). Hay que confirmar la
transcripción con el uso real.

**Telegram y Google Calendar:** gratis.

**IA (Claude).** Con precios de octubre de 2026, por millón de tokens:

| Modelo | Entrada | Salida | Para qué |
|---|---|---|---|
| **Haiku 5.5** | 0,10 US$ | 0,50 US$ | Clasificar cada captura y redactar los avisos |
| **Sonnet 5.5** | 2 US$ | 10 US$ | Planear: el reparto de las metas, la revisión semanal, el valor y la delegación, las reglas propuestas |

Una estimación con **30 capturas al día**, cada una con ~6.000 tokens de entrada
(cerebro incluido) y ~1.000 de salida:

- Clasificar todo con **Haiku 5.5:** ~900 llamadas al mes ≈ **1 US$ al mes**.
- Lo mismo con **Sonnet 5.5:** ≈ **20 US$ al mes**.
- Las revisiones y la planificación con Sonnet 5.5 (pocas llamadas largas):
  ≈ **1 a 3 US$ al mes**.

**Lo que recomiendo:** **Haiku 5.5 para clasificar y Sonnet 5.5 para pensar**, en
total unos 2 a 5 US$ al mes. Antes de decidirlo, se prueban 30 o 40 capturas
reales tuyas con los dos modelos. Si Haiku se equivoca en algo que importa (el
área de una persona, una fecha), se sube a Sonnet sólo para clasificar. El
presupuesto mensual con su tope (`configIA.js`) se copia del calendario de
marketing, así que no hay sustos.

---

## 16. Fases

Cada fase se puede usar sola. No se empieza la siguiente hasta que la anterior se
usa de verdad todos los días.

### Fase 0 · Esta semana, sin programar

Una **tarea programada en Claude** cada mañana que lea tus tareas de Juancito Ads
(con el conector que ya existe) y tu Google Calendar, y te diga qué toca hoy, qué
está atrasado y qué es urgente. Sirve para saber qué te resulta útil de verdad
antes de construir.

### Fase 1 · Capturar y no olvidar

- El repositorio con la base copiada: acceso, D1, CI y despliegue.
- Las áreas, los proyectos y listas, y los elementos con subtareas y
  recurrencia.
- **El agente clasificador** con el cerebro básico (perfil, pautas y personas)
  y la tarjeta con «Cambiar» y «Deshacer».
- **La Bandeja:** lo que no supo clasificar y las capturas que fallaron.
- **«Hoy»** y el calendario de la semana.
- **Telegram:** capturar texto y voz, el resumen de la mañana y los avisos a su
  hora con botones.
- La aplicación instalable, con su botón de capturar y el dictado.

**Terminada cuando** llevas dos semanas capturando todo ahí y nada se perdió.

### Fase 2 · Todo en un solo sitio

- **Google Calendar**, de ida y vuelta, con un calendario por área.
- **Juancito Ads**, con el Service Binding: crear, leer y completar tus tareas
  de trabajo. Esto necesita un cambio pequeño en el otro repositorio.
- **El MCP de esta aplicación** para Claude.

**Terminada cuando** «Hoy» es lo único que miras por la mañana.

### Fase 3 · Seguimiento hasta cumplir

- La escalera de avisos por importancia y el aviso «pasó a urgente».
- «¿La completaste?», el cierre del día y las «Atascadas».
- El valor y la delegación de cada tarea.
- Las horas de silencio, el tope diario y los avisos agrupados.

**Terminada cuando** ninguna tarea importante se te pasa sin que te lo dijera y
no silenciaste el bot.

### Fase 4 · De la visión a la semana

- La visión y las metas por área, y «Proponer el reparto» por semestre y mes.
- Ligar las tareas a las metas y la barra de avance.
- La revisión semanal del domingo: avance, atascadas, delegar o soltar y las 3
  prioridades.

**Terminada cuando** hiciste cuatro revisiones semanales seguidas y te sirvieron.

### Fase 5 · El cerebro que aprende

- Las señales: correcciones, cumplido o soltado, a qué hora cumples.
- Las reglas propuestas con tu sí.
- Las sugerencias de hora («lo creativo, en la mañana») y los patrones de lo que
  pospones.
- El índice por pasajes, cuando el cerebro crezca.

**Terminada cuando** el agente se equivoca de área menos de una vez por semana.

---

## 17. Riesgos y cómo se evitan

| Riesgo | Cómo se evita |
|---|---|
| **Que avise tanto que lo silencies** | Escalera por importancia, horas de silencio, tope diario, avisos agrupados y como mucho tres preguntas sobre la misma tarea |
| **Que clasifique mal** | La tarjeta lo dice todo y se deshace con un toque. Cada corrección enseña. Lo dudoso va a la Bandeja en vez de adivinar |
| **Que entienda mal una fecha** | El código comprueba el día de la semana, pregunta si la fecha ya pasó y la tarjeta enseña la fecha completa |
| **Que se vuelva complicada** | Cuatro pantallas, tres metas por área como mucho e hitos mensuales. Lo nuevo espera a que el uso lo pida |
| **Que Juancito Ads o Google no contesten** | «Hoy» enseña lo último que leyó y lo dice. Lo tuyo sigue funcionando |
| **La privacidad en Telegram** | Sólo tu chat, webhook firmado, y lo delicado por la aplicación. Tus datos están en tu cuenta de Cloudflare. La API de Anthropic no entrena con lo que recibe |
| **Que la IA se coma el presupuesto** | Un tope mensual con «avisar, bajar de modelo o detener», copiado de Juancito Ads |
| **Que el bot de Telegram lo use otra persona** | Conexión con un código de un solo uso. Lo que llega de otro chat se ignora |

---

## 18. Lo que necesito que decidas

Al lado de cada pregunta va lo que yo haría.

1. **Nombre y color.** Yo propongo «Norte» en verde esmeralda.
2. **Tus áreas** (entre 6 y 8). Yo propongo Iglesia, Familia, Trabajo, Música,
   Liderazgo, Salud, Finanzas y Personal.
3. **«Mi calendario de trabajo»:** ¿es Juancito Ads o un calendario de Google de
   trabajo? Yo recomiendo que las tareas vayan a Juancito Ads y los eventos de
   trabajo a tu calendario de Google de trabajo. La propuesta cubre las dos
   cosas.
4. **Qué cuenta de Google conectas:** la personal, la de la agencia o las dos.
   Se puede conectar más de una.
5. **Tus horarios:** el resumen (6:30 a. m.), el cierre (9:00 p. m.), el
   silencio (de 10:00 p. m. a 6:00 a. m.) y el día de la revisión semanal
   (domingo).
6. **¿Modo domingo?** Ese día, sólo avisos de Iglesia y Familia.
7. **La dirección:** una propia, como `agenda.tudominio.com`, o la de
   `workers.dev` para empezar. Recomiendo no colgarla de juancitoads.com: es
   personal.
8. **Fase 0:** ¿la monto ya, como tarea programada en Claude, mientras se
   construye la fase 1?
9. **¿Empiezo la fase 1?** Si me dices que sí, lo primero es preparar el
   repositorio con la base copiada del calendario de marketing y el bot de
   Telegram. Para el bot necesitarás crearlo una vez con @BotFather (dos
   minutos) y pegar su token como secreto en Cloudflare.
