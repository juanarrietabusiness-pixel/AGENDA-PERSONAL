// ============================================================
// Los ajustes de la persona, con los valores de partida
//
// Salen de lo que Juan contó de su semana. Lo que es una suposición mía
// (la hora exacta a la que madruga, cuándo termina la jornada) va marcado
// en `porConfirmar` para que la pantalla lo pregunte en vez de darlo por
// hecho. Todo se puede mover.
// ============================================================

import { ZONA } from "./fechas.js";

// 0 = domingo … 6 = sábado.
export const AJUSTES_BASE = Object.freeze({
  nombre: "Juan",
  zona: ZONA,

  // Despertar y dormir: el día que se puede planear. Miércoles y sábado se madruga menos.
  dias: {
    0: { despierta: "06:30", duerme: "22:00" },
    1: { despierta: "04:45", duerme: "22:00" },
    2: { despierta: "04:45", duerme: "22:00" },
    3: { despierta: "06:00", duerme: "22:30" },
    4: { despierta: "04:45", duerme: "22:00" },
    5: { despierta: "04:45", duerme: "22:00" },
    6: { despierta: "06:15", duerme: "22:30" },
  },

  // Cuándo se trabaja en Juancito Ads. Lo del sombrero Trabajo se propone dentro; lo demás, fuera.
  jornadas: {
    trabajo: { dias: [1, 2, 3, 4, 5], desde: "09:00", hasta: "18:00" },
  },

  avisos: {
    // El resumen de la mañana sale DESPUÉS de la oración, nunca durante.
    resumen: { 0: "08:00", 1: "06:15", 2: "06:15", 3: "07:30", 4: "06:15", 5: "06:15", 6: "07:30" },
    // El cierre del día. Si cae dentro de algo protegido (la célula, un servicio), sale al terminar.
    cierre: "21:00",
    silencio: { desde: "22:00", hasta: "04:45" },
    // Ningún aviso suelto sale antes del resumen de ese día: lo que caiga antes, va dentro del resumen.
    // Avisos sueltos al día, como mucho. Lo que pase de ahí va al resumen.
    tope: 8,
    // Avisos a menos de estos minutos se juntan en un mensaje.
    agrupar: 10,
    // Domingo: sólo Iglesia y Personal (opcional).
    domingoSoloIglesiaYPersonal: false,
  },

  // El seguimiento por Telegram: qué te escribe el asistente por su cuenta. Todo se apaga desde Ajustes.
  seguimiento: { activo: true, resumen: true, avisos: true, cierre: true, preguntas: true, revision: true, reuniones: true, bloques: true },

  // Lo hecho (y lo que «ya no aplica») se borra solo pasados estos días. 0 = nunca. Sólo de la agenda: no de Google Tasks
  // ni de Juancito Ads.
  borrarHechas: 7,

  // La revisión semanal (GTD). El sábado, que no se madruga tanto.
  revision: { dia: 6, hora: "08:30", minutos: 30 },

  // «normal»: en el resumen, el cierre, la revisión y al cumplir algo grande. «poco»: sólo resumen y revisión.
  frecuenciaVersiculos: "normal",
  // Juan escogió la NVI. Hasta que estén sus textos exactos, el banco enseña la RVR1960 (ver versiculos.js).
  versionBiblia: "NVI",

  // Lo que supuse y falta confirmar. Cada cosa se va sola cuando se ajusta (también hablándole al asistente).
  porConfirmar: [
    { clave: "despierta", texto: "La hora a la que madrugas (puse 4:45 los lunes, martes, jueves y viernes; 6:00 los miércoles y 6:15 los sábados)." },
    { clave: "ritmo:oracion-madrugada", texto: "Cuánto dura tu oración de la mañana (puse una hora)." },
    { clave: "jornada_hasta", texto: "A qué hora termina tu jornada (puse 6:00 p. m.)." },
    { clave: "ritmo:planificacion-celula", texto: "La hora de la planificación de la célula de los lunes (puse 8:00 p. m.)." },
    { clave: "ritmo:servicios", texto: "Cuánto duran los servicios y la célula (puse entre hora y media y dos horas y media)." },
    { clave: "ritmo:grabacion-estudio", texto: "La hora de la grabación de los jueves (puse de 3:00 a 6:30 p. m.)." },
  ],
});

// ------------------------------------------------------------
// Cambiar un ajuste, también hablándole al asistente
// ------------------------------------------------------------
//
// El asistente NO escribe los ajustes: dice qué cambio quiere con una de
// estas claves y el código lo comprueba y lo aplica. Una clave que no está
// aquí, un día que no existe o una hora mal escrita se rechazan diciendo
// por qué.

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIAS_VALIDOS = [0, 1, 2, 3, 4, 5, 6];

export const CLAVES_AJUSTE = Object.freeze({
  despierta: "A qué hora te despiertas (por día)",
  duerme: "A qué hora te acuestas (por día)",
  resumen: "A qué hora llega el resumen de la mañana (por día)",
  cierre: "A qué hora llega el cierre del día",
  silencio_desde: "Desde qué hora no llega nada",
  silencio_hasta: "Hasta qué hora no llega nada",
  jornada_desde: "A qué hora empiezas a trabajar",
  jornada_hasta: "A qué hora terminas de trabajar",
  jornada_dias: "Qué días trabajas",
  revision_dia: "Qué día es la revisión semanal",
  revision_hora: "A qué hora es la revisión semanal",
  frecuencia_versiculos: "Cada cuánto van versículos (normal, poco o nunca)",
  nombre: "Cómo te llamo",
});

export class ErrorAjuste extends Error {}

const diasDe = (dias) => {
  const lista = dias == null ? DIAS_VALIDOS : (Array.isArray(dias) ? dias : [dias]).map(Number);
  if (!lista.length || lista.some((d) => !DIAS_VALIDOS.includes(d))) throw new ErrorAjuste("Los días van de 0 (domingo) a 6 (sábado).");
  return [...new Set(lista)];
};

const hora = (valor) => {
  if (!HORA.test(String(valor ?? ""))) throw new ErrorAjuste(`«${valor}» no es una hora (HH:MM).`);
  return valor;
};

/** Los ajustes con un cambio aplicado. Puro: devuelve otros ajustes y no toca los que recibe. */
export function aplicarAjuste(ajustes, { clave, valor, dias } = {}) {
  if (!(clave in CLAVES_AJUSTE)) throw new ErrorAjuste(`No conozco el ajuste «${clave}».`);
  const a = structuredClone(ajustes);
  const porDia = (campo) => {
    for (const d of diasDe(dias)) a.dias[d] = { ...a.dias[d], [campo]: hora(valor) };
  };
  if (clave === "despierta") porDia("despierta");
  else if (clave === "duerme") porDia("duerme");
  else if (clave === "resumen") for (const d of diasDe(dias)) a.avisos.resumen[d] = hora(valor);
  else if (clave === "cierre") a.avisos.cierre = hora(valor);
  else if (clave === "silencio_desde") a.avisos.silencio.desde = hora(valor);
  else if (clave === "silencio_hasta") a.avisos.silencio.hasta = hora(valor);
  else if (clave === "jornada_desde") a.jornadas.trabajo.desde = hora(valor);
  else if (clave === "jornada_hasta") a.jornadas.trabajo.hasta = hora(valor);
  else if (clave === "jornada_dias") a.jornadas.trabajo.dias = diasDe(valor).sort();
  else if (clave === "revision_dia") a.revision.dia = diasDe(valor)[0];
  else if (clave === "revision_hora") a.revision.hora = hora(valor);
  else if (clave === "frecuencia_versiculos") {
    if (!["normal", "poco", "nunca"].includes(valor)) throw new ErrorAjuste("La frecuencia es normal, poco o nunca.");
    a.frecuenciaVersiculos = valor;
  } else if (clave === "nombre") {
    const n = String(valor ?? "").trim().slice(0, 40);
    if (!n) throw new ErrorAjuste("Falta el nombre.");
    a.nombre = n;
  }
  if (clave === "jornada_desde" || clave === "jornada_hasta") {
    if (a.jornadas.trabajo.desde >= a.jornadas.trabajo.hasta) throw new ErrorAjuste("La jornada tiene que empezar antes de terminar.");
  }
  a.porConfirmar = (a.porConfirmar ?? []).filter((p) => p.clave !== clave);
  return a;
}

/** Lo que se le cuenta al asistente de los horarios de ahora, para que sepa qué está cambiando. */
export function horariosParaLaIA(a) {
  const n = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  return [
    `Se despierta: ${DIAS_VALIDOS.map((d) => `${n[d]} ${a.dias[d].despierta}`).join(", ")}.`,
    `Se acuesta: ${DIAS_VALIDOS.map((d) => `${n[d]} ${a.dias[d].duerme}`).join(", ")}.`,
    `Resumen de la mañana: ${DIAS_VALIDOS.map((d) => `${n[d]} ${a.avisos.resumen[d]}`).join(", ")}.`,
    `Cierre del día: ${a.avisos.cierre}. Silencio de ${a.avisos.silencio.desde} a ${a.avisos.silencio.hasta}.`,
    `Jornada de trabajo: ${a.jornadas.trabajo.dias.map((d) => n[d]).join(", ")} de ${a.jornadas.trabajo.desde} a ${a.jornadas.trabajo.hasta}.`,
    `Revisión semanal: ${n[a.revision.dia]} a las ${a.revision.hora}.`,
  ].join("\n");
}

/** Lo que se puede encender o apagar del seguimiento, con su explicación (la pantalla de Ajustes). */
export const PARTES_SEGUIMIENTO = Object.freeze({
  resumen: "El resumen de la mañana, después de tu oración: lo de hoy, lo que vence y lo que quedó.",
  avisos: "Los avisos a su hora: recordatorios, lo que se acerca, lo que vence y a quién le esperas respuesta.",
  reuniones: "Media hora antes de cada reunión.",
  bloques: "Al empezar cada bloque de tu semana, con sus tareas (menos Reino), y tus recordatorios fijos con su anticipación.",
  cierre: "El cierre del día: lo que hiciste y qué hacemos con lo que quedó.",
  preguntas: "«¿La completaste?» con lo que se pasó (como mucho tres veces por cosa).",
  revision: "La revisión semanal, el día y la hora que escojas.",
});

/** El seguimiento con sus valores de partida (para ajustes guardados antes de que existiera). */
export const seguimientoDe = (a) => ({ ...AJUSTES_BASE.seguimiento, ...(a?.seguimiento ?? {}) });

/** Cuántos días se guarda lo hecho (0 = siempre). */
export const DIAS_BORRAR = Object.freeze({ 1: "Al día siguiente", 7: "A la semana", 30: "Al mes", 90: "A los tres meses", 0: "Nunca" });
export const diasParaBorrar = (a) => (Object.hasOwn(a ?? {}, "borrarHechas") && Number(a.borrarHechas) in DIAS_BORRAR ? Number(a.borrarHechas) : AJUSTES_BASE.borrarHechas);
