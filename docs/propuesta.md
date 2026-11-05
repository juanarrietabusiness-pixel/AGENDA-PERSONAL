# Asistente personal: propuesta (versión 3)

Estado a 2026-11-05. Esta versión recoge tus segundas respuestas, y la fase 1 ya empezó: hay **servidor** (sección 12).
Al final quedan las decisiones pendientes.

**Qué cambió desde la versión 2:**

- **Ya hay servidor**: un Worker de Cloudflare con su base de datos (`agenda-personal-db`, ya creada), el acceso con
  contraseña y **el asistente que ordena de verdad** con Muse Spark o Claude. Falta ponerle los secretos y desplegarlo
  (`DEPLOY.md`).
- **Tus horarios se ajustan hablando con el asistente** («madrugo a las 5», «la célula ahora es los viernes»): no hay
  que confirmarlos antes (sección 3).
- **Nombre y color quedan para el final.** Mientras, el prototipo sigue llamándose Atalaya (sección 7).
- **La Biblia: NVI.** Sus textos todavía no están en el banco (sección 6).
- **Lo que no te gustó de «Mi día»** (que no es cómodo, ni intuitivo, ni atractivo) es ahora una regla de diseño
  (sección 10).

**Qué cambió de la versión 1 a la 2:**

- La lógica de tareas **no sale de «Mi día» del calendario de marketing**: es nueva, armada con los métodos de
  productividad más usados (sección 1).
- **Los cuatro sombreros** (Trabajo, Artístico, Iglesia, Personal) ya tienen su sitio: un solo día con cuatro colores
  (sección 2).
- **Tu semana real** ya está cargada como ritmo fijo y protegido (sección 3).
- **Se puede escoger Claude o Meta**, también Muse Spark Contributor, función por función (sección 5).
- **El asistente tiene personalidad cristiana**, con un banco cerrado de versículos y su contexto (sección 6).
- **Nombres y colores** para probar en el prototipo (sección 7).
- **Juancito Ads es el calendario de trabajo**, y Google Calendar es sólo para eventos (secciones 4 y 8).

---

## 0. En pocas líneas

Le cuentas lo que tienes en la cabeza por Telegram, por Claude o en la aplicación, escribiendo o con una nota de voz.
El asistente lo **aclara y lo ordena con GTD**, el método más usado de productividad personal, y lo acomoda en **un solo
día con cuatro colores**, uno por sombrero. Te avisa **sin interrumpir lo que es de Dios** (la oración, la Palabra, los
servicios, la célula y el estudio). Te da seguimiento hasta que cumplas, **sin reproches y sin volverse pesado**. Cada
sábado te ayuda a ver si la semana te acerca a la visión de cada área.

---

## 1. El método: lo estándar, no lo inventado

Cada pieza sale de un método conocido y probado. Ninguna es invento de la aplicación.

| Pieza | De dónde sale | Para qué |
|---|---|---|
| **Capturar → Aclarar → Organizar → Reflexionar → Hacer** | GTD, *Getting Things Done* (David Allen) | Vaciar la cabeza y que nada se pierda. El asistente hace el segundo y el tercer paso solo |
| **Las listas**: Bandeja, Siguientes acciones, En espera, Algún día, Referencia, y el Calendario | GTD | Cada cosa en su sitio. «En espera» es lo que delegaste, con su fecha para preguntar |
| **La regla de los dos minutos** | GTD | Si cuesta menos de dos minutos, se hace al aclararla |
| **Proyecto = resultado con más de un paso**, y todo proyecto lleva una siguiente acción | GTD | La revisión avisa de los proyectos sin un próximo paso |
| **Roles y piedras grandes** | Covey, *Los 7 hábitos* (hábito 3: «Primero lo primero») | Tus cuatro sombreros son roles: cada semana cada uno pone su piedra grande antes de que la llene lo urgente |
| **Importante y urgente** | Matriz de Eisenhower | Hazla, agéndala, delégala o suéltala |
| **Las 3 de hoy** | La «regla de tres» y las MIT (*Most Important Tasks*) | Pocas cosas que, si se hacen, el día valió |
| **Bloques de tiempo** | *Time blocking* (Cal Newport, entre otros) | Lo de hoy se propone en los huecos que deja lo fijo: el Trabajo dentro de la jornada y lo demás fuera |
| **Cierre del día** | El *shutdown ritual* | Decidir qué pasa con lo que quedó, en vez de que se acumule |
| **Revisión semanal** | GTD | El sábado: dejar todo al día, revisar proyectos y metas y escoger las piedras grandes |
| **Repeticiones** | RFC 5545 (RRULE), el estándar de Google Calendar y de todos los calendarios | «Cada jueves», «cada dos semanas», «el último viernes del mes», sin traducir nada al pasar a Google |
| **Repetir por calendario o después de hacerla** | Todoist, Things, OmniFocus | La célula toca cada jueves aunque la anterior se hiciera tarde; el filtro del agua cuenta desde que se cambió |
| **Fecha para hacerla y fecha límite, separadas** | Things, GTD | La fecha en que piensas hacerla no es una fecha límite. Sólo lo segundo se pone en rojo |

### Lo que cambia respecto a «Mi día»

No sé qué es exactamente lo que no te gustó de «Mi día», así que te dejo las diferencias de fondo para que me digas si
van por ahí:

| En «Mi día» | Aquí |
|---|---|
| Lo que no hiciste se acumula en «Atrasadas», en rojo | **Rojo sólo es una fecha límite real que se pasó.** Lo planeado que no salió va a «Por decidir», y en el cierre del día decides: hoy, mañana, algún día o soltarlo |
| Las tareas se ordenan por empresa y por día | **Se ordenan por lo que importa**: tus 3 de hoy, después lo importante y después el resto. La empresa o el sombrero es un color, no una carpeta |
| No hay hora: es una lista | **Tu día es una línea de tiempo** con lo fijo (oración, servicios, célula) y los huecos libres. Te propone dónde meter cada cosa |
| La repetición tiene formatos propios («último lunes», «semana antes del fin») | **La repetición es la de Google Calendar** (RRULE): la misma en todas partes |
| No sabe si cabe todo | **Si no cabe, lo dice**: «Hoy hay 4 h 20 planeadas y 1 h 55 libres. ¿Movemos algo?» |
| Mover una tarea tres veces no significa nada | **A la tercera vez que la mueves**, pregunta si sigue valiendo la pena |

El código de «Mi día» (`agenda.js`, `semanaTareas.js`, el repaso de la mañana, `ElegirDia`) **no se usa**. Lo que sí se
reutiliza del calendario de marketing está en la sección 11.

---

## 2. Tus cuatro sombreros, sin partirte la cabeza

**Recomiendo: un solo día, cuatro colores.** Si la pantalla se partiera en cuatro sombreros, tendrías que saltar
entre cuatro listas, que es justo lo que fragmenta la cabeza. Los sombreros sirven para dos cosas:

1. **Planear la semana** (Covey): el sábado, cada sombrero escoge su piedra grande.
2. **Ver el equilibrio**: «esta semana, Iglesia 43 %, Artístico 31 %, Trabajo 14 % (lo que no está en Juancito Ads) y
   Personal 12 %». Si uno casi no tiene tiempo, la revisión lo pregunta.

En el día a día, cada cosa lleva **un punto de color** y nada más.

| Sombrero | Color | Qué lleva | Dónde vive |
|---|---|---|---|
| **Trabajo** | Azul | Clientes de la agencia, reuniones y recordatorios del trabajo | **Juancito Ads** (tu equipo las ve). Aquí se leen y se marcan hechas |
| **Artístico** | Rosa | Música, presentaciones, ensayos, grabaciones y contenido de tu marca personal | Aquí, y los eventos en Google Calendar |
| **Iglesia** | Violeta | La célula y sus tareas, discipulados, reuniones con hermanos, servicios y liderazgo | Aquí, y los eventos en Google Calendar |
| **Personal** | Verde | Tu esposa, la familia, tus planes y proyectos (como esta aplicación) | Aquí, y los eventos en Google Calendar |

El orden es el que me diste, y **ninguno pesa más que otro**. Lo que pesa lo decide cada tarea (importante o no) y la
visión de cada área.

**Antes de los sombreros va lo devocional**: la oración y la lectura de la Palabra no son un rol más. Salen en tu día
con su propio tono («Con Dios»), nunca reciben avisos encima y no cuentan en el reparto de la semana (Mateo 6:33).

**Dentro de cada sombrero hay dos clases de cosas** (la diferencia la hace PARA, de Tiago Forte):

- **Responsabilidades**, que no terminan: la célula, los discipulados, tu matrimonio, tu marca personal, los clientes.
- **Proyectos**, que sí terminan: «Retiro de jóvenes en enero», «El sencillo nuevo», «Esta aplicación».

Ejemplos de lo que ya está en el prototipo:

- **Iglesia**: la célula (responsabilidad, con «Preparar el tema» cada miércoles), los discipulados (con candado de
  confidencial) y el retiro de jóvenes (proyecto; avisa de que no tiene siguiente acción porque esperas al pastor).
- **Personal**: tu matrimonio («Reservar la cena del sábado», «Comprar el perfume») y esta aplicación.

---

## 3. Tu semana

Lo que me contaste ya está cargado como **ritmo fijo**. Todo se puede mover, y lo que es una suposición mía sale
marcado «Hora por confirmar».

| Día | Lo fijo |
|---|---|
| Lunes | Oración de madrugada · trabajo desde las 9:00 · la Palabra al mediodía · **planificación de la célula** en la noche |
| Martes | Oración de madrugada · trabajo · la Palabra · **servicio a las 6:30 p. m.** |
| Miércoles | Oración (sin madrugar tanto) · trabajo · la Palabra · **servicio a las 8:00 p. m.** |
| Jueves | Oración de madrugada · trabajo · la Palabra · **grabación en el estudio** en la tarde · **célula a las 8:00 p. m.** |
| Viernes | Oración de madrugada · trabajo · la Palabra |
| Sábado | Oración (sin madrugar tanto) · la revisión semanal (propuesta: 8:30 a. m.) |
| Domingo | **Servicio a las 10:00 a. m.** |

**Lo que supuse** (la hora a la que madrugas, cuánto dura la oración, cuándo termina tu jornada, la hora de la
planificación de la célula, cuánto duran los servicios y la grabación) **no hay que confirmarlo antes**: se lo dices al
asistente cuando quieras («madrugo a las 5», «la grabación es de 2 a 5», «ya no hay servicio el martes») y él cambia tu
semana. Lo que puede cambiar así está acotado: horarios (despertar, dormir, resumen, cierre, silencio, jornada, día y
hora de la revisión) y los bloques fijos de la semana (añadir, cambiar o quitar). El código valida cada hora y cada
día antes de guardar, y la tarjeta dice qué cambió, con «Deshacer». En Ajustes sale la lista de lo que todavía es
suposición mía.

**Una sola fuente:** casi todo eso ya está en tu Google Calendar. En la aplicación real **se lee de ahí**; no se copia.
Al conectar Google, cada evento que se repite se casa con su sombrero y se te pregunta cuáles son **protegidos** (sin
avisos mientras duran).

**Lo que hace el asistente con tu ritmo:**

- **El resumen de la mañana sale DESPUÉS de la oración**: a las 6:15 los días que madrugas y a las 7:30 los
  miércoles y sábados.
- **Nada suelto suena antes del resumen.** Lo que caiga antes, va dentro del resumen.
- **Nada suena durante lo protegido.** Un aviso que caería en plena célula sale al terminar.
- **El cierre del día sale después del servicio o de la célula**, no durante: el miércoles, a las 9:30.
- **Lo que pasa de las 10:00 p. m.** queda para el resumen del día siguiente.
- **No te propone tareas antes del resumen** ni en horas que ya pasaron.
- **El Trabajo se propone dentro de tu jornada**; lo demás, fuera de ella.

---

## 4. Google: qué cuentas conectar

Tienes dos cuentas, la personal y la de la agencia, y cambiar entre una y otra te complica. Usas más la de la agencia.

**Recomiendo una sola cuenta para mirar, y que tus datos personales sigan siendo tuyos:**

1. **Los calendarios personales viven en tu cuenta personal**: crea ahí uno por sombrero si quieres («Artístico»,
   «Iglesia», «Personal»), o usa el que ya tienes. Si algún día dejas la agencia o cambias su cuenta, tu vida no se va con
   ella.
2. **Compártelos con la cuenta de la agencia con permiso de «Hacer cambios en eventos»** (en Google Calendar →
   Configuración del calendario → Compartir con personas específicas).
3. **En el teléfono y en la computadora miras sólo la cuenta de la agencia**, que ya ve los dos.
4. **La aplicación se conecta UNA vez, con la cuenta de la agencia**: lee tus eventos de trabajo y los personales
   compartidos, y escribe en el calendario de cada sombrero.

Así dejas de cambiar de cuenta, y cada cosa sigue siendo de quien es. Si prefieres conectar las dos cuentas a la
aplicación, también se puede: es una conexión más.

---

## 5. Claude o Meta: tú escoges

En **Ajustes → Quién piensa** escoges el proveedor y, si quieres, un modelo distinto para cada trabajo:

| Trabajo | Qué hace | Por defecto con Claude | Por defecto con Meta |
|---|---|---|---|
| **Ordenar lo que capturas** | Muchas veces al día, mensajes cortos | Claude Haiku 5.5 | Muse Spark 1.3 |
| **Conversar** | Por Telegram, la aplicación y Claude | Claude Sonnet 5.5 | Muse Spark 1.3 |
| **Planear y revisar** | Metas, revisión semanal, qué delegar y qué soltar | Claude Sonnet 5.5 | Muse Spark 1.3 |

Y en cualquiera puedes escoger **Muse Spark 1.2 Contributor**, el que usas en el calendario. (Me escribiste «Spark
News»; entiendo que es Muse Spark. Si era otro, dime cuál).

**Lo que tienes que saber de Contributor:** Meta puede usar lo que recibe para entrenar sus modelos. En el calendario de
marketing eso son captions; aquí es **tu vida**: tu familia, tu iglesia y, sobre todo, **las personas que discipulas y lo
que te confían**. Por eso:

- **Se puede escoger**, pero nunca es el de partida, y la advertencia no se cierra mientras alguna función lo use.
- **Lo confidencial nunca le llega.** Va con un modelo que no entrena: Muse Spark 1.3 si tienes llave de Meta, y si no,
  Claude. Es confidencial lo que empieza por «privado:», lo que nombra a una persona marcada como confidencial (los que
  discipulas) y lo que trae palabras como «consejería», «discipulado» o «petición de oración». Es una red y no una
  garantía, y lo digo tal cual.
- **El precio no es razón para usarlo:** Claude Haiku 5.5 cuesta casi lo mismo y no entrena con lo que recibe.

| Modelo | Entrada / salida (US$ por millón de tokens) | Ordenar 30 capturas al día, al mes | ¿Entrena con lo que recibe? |
|---|---|---|---|
| Claude Haiku 5.5 | 0,10 / 0,50 | ≈ 0,99 US$ | No |
| Muse Spark 1.2 Contributor | 0,10 / 0,20 | ≈ 0,72 US$ | **Sí** |
| Muse Spark 1.3 | 1,25 / 4,25 | ≈ 10,57 US$ | No |
| Claude Sonnet 5.5 | 2 / 10 | ≈ 19,80 US$ | No |
| Claude Opus 5.5 | 4 / 20 | ≈ 39,60 US$ | No |

(Los precios de Claude son los de octubre de 2026. Los de Meta salen de lo que ya usa el calendario de marketing).

**Mi recomendación:** Claude Haiku 5.5 para ordenar y Sonnet 5.5 para conversar y planear, en total unos 2 a 5 US$ al
mes. Es tu decisión, y se cambia con un toque.

**Cómo funciona por dentro:** Meta habla el mismo formato de mensajes que Claude (`api.meta.ai/v1/messages`), así que la
llamada es una y sólo cambia la puerta. A Meta se le quita lo que es propio de Claude (el razonamiento, la caché, la
búsqueda web), igual que hace el calendario de marketing. Si a un proveedor le falta la llave, se usa el otro y se
avisa.

---

## 6. La personalidad del asistente

**Cristiano en cómo anima, no en cuánto predica.** Las reglas que se le dan al modelo:

- Español latino neutro, de tú, cálido y directo. **Mensajes cortos**: lo que cabe en la pantalla del teléfono.
- Anima al **trabajo hecho de corazón, a la disciplina, a la constancia y al descanso a su tiempo**.
- **Nunca reprocha ni hace sentir culpa.** Si algo no se hizo, ayuda a decidir qué hacer y sigue. Después de un mal día
  va la gracia.
- Celebra lo cumplido con sobriedad: una frase, no una fiesta.
- Cuida el descanso: si la semana se carga de más, lo dice y propone qué mover o delegar.
- Lo delicado de otra persona (una consejería, una petición de oración) es confidencial.
- **Una sola pregunta a la vez**, y sólo si falta algo esencial.
- Como mucho un emoji por mensaje, y nunca en lugar de palabras.

### Los versículos: un banco cerrado, con su contexto

**El asistente nunca cita la Biblia de memoria.** Un modelo puede cambiar una palabra de un versículo sin que se note.
Escoge el `id` de un versículo del banco y **el código pone el texto exacto**.

El banco tiene **30 versículos** (Reina-Valera 1960), y cada uno lleva:

- **su contexto** («Pablo escribe a los siervos de las casas cristianas…»);
- **para qué SÍ se usa** («dar sentido y excelencia al trabajo ordinario»);
- **para qué NO** («exigir más horas o justificar trabajar de más»);
- **los momentos** en que puede salir.

Algunos y su momento:

| Momento | Versículos |
|---|---|
| Madrugar a orar | Marcos 1:35 (Jesús ora antes de seguir: la oración ordena las prioridades) |
| El resumen de la mañana | Colosenses 3:23, Proverbios 16:3, Mateo 6:33, Salmo 90:12 |
| Planear | Proverbios 21:5, Proverbios 16:9, Santiago 4:15, Lucas 14:28 (si el día no cabe) |
| Escribir la visión | Habacuc 2:2, con prudencia: escribir con claridad lo que Dios ha puesto, sin presentar cualquier meta como revelación |
| Constancia (célula, discipulados, ensayos) | Gálatas 6:9, 1 Corintios 15:58, Romanos 12:11 |
| Delegar | Éxodo 18:18 (Jetró y Moisés), Hechos 6:3-4 |
| Un día que no salió | Lamentaciones 3:22-23 («nuevas son cada mañana»), Filipenses 3:13-14 |
| Descanso | Salmo 127:2 (habla del afán, no de madrugar a orar), Marcos 6:31, Mateo 11:28 |
| La pausa del mediodía | Salmo 119:105 |
| Cumplir algo grande | Mateo 25:21, Lucas 16:10, 1 Pedro 4:10 |

**Los que no usa como promesa personal**, porque se citan mucho fuera de contexto: Jeremías 29:11 (una carta a los
exiliados en Babilonia, para el pueblo), Filipenses 4:13 (habla de estar contento en la escasez y en la abundancia) y
Proverbios 29:18 («sin profecía», es decir, sin la revelación de Dios; no habla de metas personales).

**Con medida, para que no se vuelva tedioso:**

- **Normal**: en el resumen de la mañana, el cierre, la revisión semanal y al cumplir algo grande. **Poco**: sólo el
  resumen y la revisión. **Nunca**: ninguno. Se cambia en Ajustes.
- **Jamás en un recordatorio ni en «¿la completaste?».**
- **El mismo versículo no se repite en 30 días.**
- **Proverbios 6:6 y 13:4** («el perezoso») sólo hablan de la hormiga o del primer paso de un proyecto, nunca se le
  dirigen a ti.

**Pendiente:** los textos están escritos por mí y marcados «por revisar». Revísalos una vez contra tu Biblia (o dime si
prefieres otra versión, como NVI o NTV).

### Que anime sin volverse pesado

- **Cada mensaje tiene varias formas de decirse** y cambia según el día: no te escribe siempre lo mismo.
- **«¿La completaste?» cambia de tono** cada vez, y la tercera dice «última vez que te pregunto; la dejo en la revisión
  del sábado».
- **El cierre de la noche enseña cinco cosas como mucho**, y del resto sólo cuántas son.
- **Tope de avisos al día, avisos agrupados** y nada durante lo protegido.

Así se ve el resumen de la mañana (lo arma el código con tu día, sin IA):

```
Buenos días, Juan. Un día nuevo.

«Encomienda a Jehová tus obras, Y tus pensamientos serán afirmados.»
— Proverbios 16:3

Si sólo hicieras tres cosas hoy, te propongo:
• Pagar la luz (Personal)
• Enviar la propuesta de pauta a Dcasa (Trabajo)
• Comprar el perfume para mi esposa (Personal)

Agenda:
• 8:00 p. m. Servicio en la iglesia

Quedó una de días anteriores: la vemos en el cierre.
```

---

## 7. Nombre y color

**Queda para el final**, como pediste. Mientras, la aplicación se llama Atalaya. Las opciones siguen aquí.

Los cuatro se pueden probar en el prototipo (Ajustes → Nombre y color), y el nombre se cambia después en un solo sitio
(`src/lib/temas.js`). Ninguno es azul, para no confundirlo con Juancito Ads.

| Nombre | Color | La idea |
|---|---|---|
| **Atalaya** | Oro, `#E8A93A` | El vigía que vela desde temprano. «Sobre mi guarda estaré… Escribe la visión» (Habacuc 2:1-2): la vigilancia y la visión en un nombre |
| **Kairós** | Turquesa, `#22B8B0` | El tiempo oportuno. Es la palabra griega detrás de «aprovechando bien el tiempo» (Efesios 5:16) |
| **Mayordomo** | Cobre, `#E0703F` | El administrador fiel de lo que Dios confía, también del tiempo (Lucas 12:42; 1 Pedro 4:10). En el habla diaria también es el sirviente de una casa |
| **Senda** | Marfil, `#E6DCC3` | «Lámpara es a mis pies tu palabra» (Salmo 119:105). Un camino claro, paso a paso |

Otros nombres posibles: Norte, Talentos, Diligente, Redime, Faro, Primero lo primero.

Mi favorito es **Atalaya**: lo de madrugar a orar y lo de escribir la visión están en el mismo pasaje.

---

## 8. Dónde vive cada cosa (sin cambios de fondo)

| Qué | Dónde vive | En esta aplicación |
|---|---|---|
| Trabajo y clientes | **Juancito Ads**: lo ve tu equipo | Se lee y se marca hecho; se cierra allá |
| Eventos con hora (reuniones, ensayos, servicios) | **Google Calendar** | Se leen; los que crea el asistente van allá |
| Artístico, Iglesia y Personal | **Aquí** | Todo |
| Ideas de contenido para un cliente | **Banco de ideas de Juancito Ads** | No se duplican |

**Con Juancito Ads**, lo mejor sigue siendo una conexión directa entre los dos Workers (Service Binding con RPC de
Cloudflare): `tareasDe(persona)`, `crearTarea(…)`, `completarTarea(id)`. No sale a internet ni tiene llave que se pueda
filtrar, y pide un archivo pequeño en el calendario de marketing que pase por su capa de acceso. Si Juancito Ads no
contesta, «Hoy» enseña lo último que leyó y lo dice.

**Con Google Calendar**: OAuth una vez, el permiso cifrado (como Drive en el calendario de marketing), ida y vuelta con
la sincronización por cambios de Google (`syncToken`) y una marca oculta para no duplicar. La app de Google tiene que
estar «en producción»: «en prueba», el permiso caduca a los 7 días.

**Telegram** es el canal del teléfono: capturas texto y voz, y es el único que te puede avisar con botones («Hecho»,
«Mañana», «Delegar», «Ya no aplica»). Sólo atiende tu chat, el webhook va firmado y la voz se transcribe antes de que
la lea el asistente (Whisper en Workers AI, y Gemini de respaldo). WhatsApp, después.

**Claude** se conecta por MCP con la herramienta principal `capturar`, que pasa tu frase al MISMO asistente: así lo que
entra por Claude se ordena igual que lo de Telegram. Claude no te puede mandar avisos por su cuenta; eso lo hace
Telegram.

---

## 9. Seguimiento, metas y valor (sin cambios de fondo)

- **La escalera de avisos** por importancia (sección 7 de la versión 1), ahora respetando tu ritmo (sección 3).
- **«Pasó a urgente»** lo calcula el código con la fecha límite, una sola vez y sólo si es importante.
- **«¿La completaste?»** como mucho tres veces; luego queda **«atascada»** para la revisión.
- **Visión → meta del año → semestre → mes → semana**: tú escribes la visión y la meta; la IA propone los hitos y tú
  los aceptas.
- **Valor y delegación**: cada tarea con su valor, si se puede delegar y a quién. Nunca se delega solo.

---

## 10. Lo que ya está hecho: el prototipo

Las pantallas funcionan de dos formas. **Sin servidor** (`npm run dev`) es el prototipo: datos de ejemplo sacados de lo
que me contaste, sin IA, guardado en ese navegador. **Con servidor** (desplegada, o `npm run dev:worker` en local) pide
entrar, guarda en D1 y el asistente ordena lo que capturas.

```bash
npm install
npm run dev
```

**La regla de diseño que sale de «Mi día»:** que sea cómodo, intuitivo y atractivo. Cada pantalla tiene que entenderse
sin explicación, lo importante a un toque y nada que haya que mantener a mano. Lo que hoy no lo cumpla se arregla en la
fase 1C (sección 12).

**Las cuatro pantallas:**

- **Hoy**: el saludo con el versículo del día, los avisos (lo que se pasó de fecha, si el día no cabe, lo que espera en
  la Bandeja), **las 3 de hoy** («Es de mis 3»), lo demás de hoy, **Por decidir** (Hoy / Mañana / Algún día / Ya no
  aplica), «Toca preguntar» (lo que esperas de otra persona) y **tu día** como línea de tiempo: lo fijo, lo protegido
  («Sin avisos») y, en punteado, dónde te propone meter cada cosa («Agendar aquí»).
- **Semana**: cómo se reparte tu tiempo entre los sombreros, las **piedras grandes** de cada uno y la semana día por día.
- **Sombreros**: los cuatro, con sus responsabilidades y proyectos, la siguiente acción de cada uno y el aviso de los
  proyectos sin próximo paso.
- **Asistente**: la **Bandeja** con «Aclarar» (las preguntas de GTD, para cuando la IA no esté) y **cómo te escribe**: el
  resumen de la mañana, una captura de ejemplo, «¿la completaste?» y el cierre del día, armados con tu día de verdad.
- **Ajustes**: nombre y color, Claude o Meta (con la advertencia de Contributor), la frecuencia de los versículos y lo
  que falta confirmar de tu semana.
- **Capturar**: el botón de todas las pantallas, escribiendo o dictando.

**La lógica, pura y con pruebas** (`src/lib/`; las pruebas, en `tests/`):

| Archivo | Qué hace |
|---|---|
| `fechas.js` | Fechas y horas en la zona de Panamá, sin `toISOString()` |
| `recurrencia.js` | Las reglas RRULE: leer, escribir, cuándo toca, la siguiente, «después de hacerla» y decirlo en español |
| `metodo.js` | GTD: las listas, «Aclarar», hacer, posponer, soltar, repetir y los proyectos sin siguiente acción |
| `prioridad.js` | Importante y urgente, los cuadrantes y «pasó a urgente» |
| `hoy.js` | El plan del día: lo fijo, los huecos, las 3, los bloques propuestos, por decidir y la sobrecarga |
| `avisos.js` | La escalera, lo protegido, el silencio, el resumen, agrupar, el tope y «¿la completaste?» |
| `sombreros.js` | Los cuatro sombreros y el reparto de la semana |
| `ritmo.js`, `ajustes.js` | Tu semana y tus horarios de partida |
| `versiculos.js` | El banco, el contexto, los que no se usan y cómo se escoge uno |
| `personalidad.js` | Lo que se le dice al modelo, los días con su nombre y la comprobación del día de la semana |
| `mensajes.js` | El resumen, el cierre, los avisos y «¿la completaste?», con variantes |
| `ia.js` | Claude o Meta por función, lo confidencial, la petición para Meta y el costo |
| `temas.js` | Los nombres y colores para probar |
| `agente.js` | Leer lo que devuelve el modelo, comprobarlo, aplicarlo, deshacerlo y la tarjeta de «Esto hice» |
| `api.js` | Lo que la pantalla le pide al servidor, y qué cambió entre dos estados |

---

## 11. Qué se reutiliza del calendario de marketing

**Nada de «Mi día».** Sí, porque no es lógica de tareas:

- **El cerebro** (`conocimiento.js`, `memoria.js`: búsqueda por pasajes y memoria que aprende), cuando crezca.
- **La llamada a Claude y a Meta** (`anthropic.js`, `flujoAnthropic.js`) y el **presupuesto de IA** (`configIA.js`).
- **El acceso** (`sesion.js`: contraseña, cookie, OAuth del MCP), el **servidor MCP** y la **conexión con Google**.
- **El sistema de diseño**: los iconos (`Icon.jsx`, ya copiado) y el hook de diálogos accesibles (ya copiado, como
  `useDialogo.js`).
- **Las lecciones**: `toISOString()`, el tope de PBKDF2 en producción, `if not exists` en las migraciones, `base` fija
  en Vite, `no-undef` en el lint, Google «en prueba», el modelo que se equivoca de día de la semana.

---

## 12. Lo que sigue

**Fase 1A, hecha (falta desplegarla):**

- **El Worker con D1** (`worker/`, `migraciones/d1/`): la base `agenda-personal-db` ya está creada en Cloudflare. Una
  sola cuenta: se crea la primera vez con un código de alta (`CODIGO_ALTA`, secreto del Worker) y después sólo se
  entra. Contraseña con PBKDF2 a 600.000 vueltas en tramos de 100.000 (el tope de Cloudflare), cookie `__Host-` y de la
  sesión sólo se guarda la huella.
- **El asistente que ordena** (`src/lib/agente.js`, `worker/lib/ordenar.js`): lo capturado se guarda TAL CUAL primero
  (si la IA falla, queda en la Bandeja con el motivo y «Que lo ordene el asistente»), y luego el modelo lo convierte en
  acciones, proyectos con subtareas, eventos, esperas, personas, fechas especiales y cambios de horario. **El código
  comprueba todo antes de guardar**: el día de la semana, que la fecha no haya pasado, la regla de repetición, que un
  evento tenga hora. La tarjeta dice qué hizo, con «Deshacer», y si el asistente pregunta algo, tu siguiente frase le
  contesta.
- **Muse Spark o Claude, por la misma puerta** (`worker/lib/modelo.js`): si la cuenta no tiene un modelo, prueba el
  siguiente; si Meta lo rechaza y hay llave de Anthropic, lo hace Claude y lo dice; lo confidencial nunca va a
  Contributor. Cada llamada deja su costo.
- **Dónde vive:** en tu cuenta de Cloudflare, la misma del calendario, pero como Worker aparte, en
  **`agenda.juancitoads.com`**. Separados para que tu equipo nunca vea lo personal y un despliegue no pueda romper el
  otro; en la misma cuenta para poder conectarlos después (fase 2). Las llaves, en Cloudflare, como en el calendario.
- **Desplegar**: Cloudflare se conecta al repositorio y publica cada cambio, sólo si antes pasan las pruebas. No hay
  tokens que crear. Los pasos, sólo de navegador, están en `DEPLOY.md`. La base ya tiene sus tablas.
- **La puerta:** una sola cuenta, contraseña lenta de adivinar, cinco intentos fallidos cierran la entrada 15 minutos y
  los buscadores no la indexan. Cloudflare Access, opcional, como segunda puerta.
- 89 pruebas: también una base D1 de verdad en memoria, que la capa de datos acota por dueño y que ninguna consulta
  vive fuera de ella.

**Lo que necesito de ti para ponerla en línea** (`DEPLOY.md`): conectar el repositorio en Cloudflare (una vez) y
poner en el Worker el código de alta y tu llave nueva de Meta.

**Fase 1B: Telegram.** Hecho lo primero: el bot (que creaste con @BotFather) se conecta desde Ajustes, captura texto
y notas de voz (Whisper en Workers AI), contesta con la tarjeta y «Deshacer», y sólo te atiende a ti. El token va en
Cloudflare como Secret `TELEGRAM_BOT_TOKEN`. Falta: el resumen de la mañana, los avisos con botones («Hecho»,
«Mañana») y el cierre, que necesitan una tarea programada en el Worker.

**Fase 1C: que sea cómodo, intuitivo y atractivo.** Es lo que no te gustó de «Mi día», así que no es un detalle del
final: con la aplicación en tu teléfono, una pasada de diseño sobre lo que uses de verdad. Para guiarla, cuéntame qué
pantalla abres primero, qué te sobra y qué buscas y no encuentras.

**Fase 2:** Google Calendar y Juancito Ads. **Fase 3:** el seguimiento completo. **Fase 4:** visión y metas. **Fase 5:**
el cerebro que aprende.

---

## 13. Decisiones pendientes

1. **Nombre y color**: al final.
2. **Las cuentas de Google**: ¿te sirve lo de compartir tus calendarios personales con la cuenta de la agencia
   (sección 4)? Hace falta para la fase 2.
3. **Los textos de la NVI**: el entorno donde trabajo no deja entrar a Bible Gateway, así que no los he podido traer
   (y no los escribo de memoria). O se permite ese dominio en el acceso a la red del entorno, o me pegas los versículos
   del banco. Mientras, salen en Reina-Valera 1960.
4. **El día de la revisión semanal**: propongo el sábado a las 8:30 a. m.; también se lo puedes cambiar al asistente.
