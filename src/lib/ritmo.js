// ============================================================
// El ritmo de la semana: lo fijo que ya vive en Google Calendar
//
// Es el «paisaje duro» de GTD: lo que pasa sí o sí, alrededor de lo cual se
// acomoda todo lo demás. En producción se LEE de Google Calendar (ahí está
// casi todo); esto es el punto de partida del prototipo, con lo que Juan
// contó. Al conectar Google, cada evento recurrente se casa con su sombrero
// y se pregunta cuál es PROTEGIDO.
//
// PROTEGIDO = sin avisos mientras dura. La oración, la Palabra, los
// servicios, la célula y la grabación en el estudio no se interrumpen con
// una notificación: lo que caiga ahí sale al terminar.
//
// DEVOCIONAL va aparte de los sombreros: no es un rol más, es lo primero
// (Mateo 6:33). No cuenta en el balance de la semana.
// ============================================================

export const RITMO_BASE = Object.freeze([
  {
    id: "oracion-madrugada",
    titulo: "Oración",
    devocional: true,
    sombrero: null,
    inicio: "05:00",
    fin: "06:00",
    repite: { regla: "FREQ=WEEKLY;BYDAY=MO,TU,TH,FR", inicio: "2026-01-05" },
    protegido: true,
    porConfirmar: true,
  },
  {
    id: "oracion-tranquila",
    titulo: "Oración",
    devocional: true,
    sombrero: null,
    inicio: "06:30",
    fin: "07:15",
    repite: { regla: "FREQ=WEEKLY;BYDAY=WE,SA", inicio: "2026-01-07" },
    protegido: true,
    porConfirmar: true,
  },
  {
    id: "palabra-mediodia",
    titulo: "Pausa: leer la Palabra",
    devocional: true,
    sombrero: null,
    inicio: "12:00",
    fin: "12:30",
    repite: { regla: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", inicio: "2026-01-05" },
    protegido: true,
    porConfirmar: true,
  },
  {
    id: "planificacion-celula",
    titulo: "Planificación de la célula",
    sombrero: "iglesia",
    inicio: "20:00",
    fin: "21:00",
    repite: { regla: "FREQ=WEEKLY;BYDAY=MO", inicio: "2026-01-05" },
    protegido: true,
    porConfirmar: true,
  },
  {
    id: "servicio-martes",
    titulo: "Servicio en la iglesia",
    sombrero: "iglesia",
    inicio: "18:30",
    fin: "20:30",
    repite: { regla: "FREQ=WEEKLY;BYDAY=TU", inicio: "2026-01-06" },
    protegido: true,
    porConfirmar: true,
  },
  {
    id: "servicio-miercoles",
    titulo: "Servicio en la iglesia",
    sombrero: "iglesia",
    inicio: "20:00",
    fin: "21:30",
    repite: { regla: "FREQ=WEEKLY;BYDAY=WE", inicio: "2026-01-07" },
    protegido: true,
    porConfirmar: true,
  },
  {
    id: "grabacion-estudio",
    titulo: "Grabación en el estudio",
    sombrero: "artistico",
    inicio: "15:00",
    fin: "18:30",
    repite: { regla: "FREQ=WEEKLY;BYDAY=TH", inicio: "2026-01-08" },
    protegido: true,
    porConfirmar: true,
  },
  {
    id: "celula",
    titulo: "Célula",
    sombrero: "iglesia",
    inicio: "20:00",
    fin: "21:30",
    repite: { regla: "FREQ=WEEKLY;BYDAY=TH", inicio: "2026-01-08" },
    protegido: true,
    porConfirmar: false,
  },
  {
    id: "servicio-domingo",
    titulo: "Servicio dominical",
    sombrero: "iglesia",
    inicio: "10:00",
    fin: "12:30",
    repite: { regla: "FREQ=WEEKLY;BYDAY=SU", inicio: "2026-01-04" },
    protegido: true,
    porConfirmar: true,
  },
]);
