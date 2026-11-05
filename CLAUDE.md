# Notas del proyecto para Claude

La agenda personal de Juan: tareas, reuniones y recordatorios de sus cuatro
sombreros (Trabajo, Artístico, Iglesia, Personal), con un asistente que ordena
lo que se le dice. La propuesta y las decisiones están en `docs/propuesta.md`:
léela antes de cambiar algo de fondo.

## Cómo trabajar aquí

```bash
npm install
npm run dev        # el prototipo
npm run verificar  # lint (sin errores NI avisos) + pruebas + build: lo que corre CI
```

Hoy es un prototipo SIN servidor: los datos son de ejemplo (`src/datos/demo.js`)
y se guardan en el navegador (`useAlmacen`). El Worker, D1, Telegram, Google y
la IA son la fase 1.

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
