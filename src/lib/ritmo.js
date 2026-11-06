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

import { esHora } from "./fechas.js";
import { esIdSombrero } from "./sombreros.js";

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

// ------------------------------------------------------------
// Cambiar el ritmo, también hablándole al asistente
// ------------------------------------------------------------
//
// «La célula ahora es a las 7:30», «el ensayo de los viernes de 7 a 9»,
// «ya no voy a la grabación de los jueves». El asistente dice el cambio y el
// código lo comprueba: horas que existen, el final después del inicio, días
// de la semana de verdad. Lo que no cuadra se rechaza diciendo por qué.


export class ErrorRitmo extends Error {}

const CODIGOS_DIA = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const sinTildes = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Días como números (0 = domingo) o códigos («TH») → los códigos en orden de lunes a domingo. */
function codigosDe(dias) {
  const lista = (Array.isArray(dias) ? dias : [dias]).map((d) => (typeof d === "number" ? CODIGOS_DIA[d] : String(d).toUpperCase()));
  if (!lista.length || lista.some((c) => !CODIGOS_DIA.includes(c))) throw new ErrorRitmo("Los días van de 0 (domingo) a 6 (sábado), o como MO, TU, WE…");
  return [...new Set(lista)].sort((a, b) => ((CODIGOS_DIA.indexOf(a) + 6) % 7) - ((CODIGOS_DIA.indexOf(b) + 6) % 7));
}

function comprobado(cambio, base = {}) {
  const e = { ...base };
  if (cambio.titulo !== undefined) {
    const t = String(cambio.titulo ?? "").trim().slice(0, 80);
    if (!t) throw new ErrorRitmo("Falta el nombre.");
    e.titulo = t;
  }
  if (cambio.sombrero !== undefined) {
    if (cambio.sombrero !== null && !esIdSombrero(cambio.sombrero)) throw new ErrorRitmo(`«${cambio.sombrero}» no es un sombrero.`);
    e.sombrero = cambio.sombrero;
  }
  if (cambio.devocional !== undefined) e.devocional = Boolean(cambio.devocional);
  if (cambio.inicio !== undefined) {
    if (!esHora(cambio.inicio)) throw new ErrorRitmo(`«${cambio.inicio}» no es una hora (HH:MM).`);
    e.inicio = cambio.inicio;
  }
  if (cambio.fin !== undefined) {
    if (!esHora(cambio.fin)) throw new ErrorRitmo(`«${cambio.fin}» no es una hora (HH:MM).`);
    e.fin = cambio.fin;
  }
  if (cambio.dias !== undefined || cambio.cadaDosSemanas !== undefined) {
    const anterior = /BYDAY=([A-Z,]+)/.exec(base.repite?.regla ?? "")?.[1]?.split(",") ?? [];
    const dias = cambio.dias !== undefined ? codigosDe(cambio.dias) : anterior;
    if (!dias.length) throw new ErrorRitmo("Falta qué días.");
    const intervalo = cambio.cadaDosSemanas ?? /INTERVAL=2/.test(base.repite?.regla ?? "") ? ";INTERVAL=2" : "";
    e.repite = { regla: `FREQ=WEEKLY${intervalo};BYDAY=${dias.join(",")}`, inicio: base.repite?.inicio ?? "2026-01-05" };
  }
  if (cambio.protegido !== undefined) e.protegido = Boolean(cambio.protegido);
  // Un BLOQUE es un tramo de tu semana con su sombrero (Trabajo 8–12); un RECORDATORIO es un momento dentro de él
  // (la lectura de Proverbios a las 11:45). El bloque avisa al empezar (con sus tareas); el recordatorio, `antes`
  // minutos antes de su hora.
  if (cambio.clase !== undefined) e.clase = cambio.clase === "recordatorio" ? "recordatorio" : "bloque";
  if (cambio.avisar !== undefined) e.avisar = Boolean(cambio.avisar);
  if (cambio.antes !== undefined) {
    const n = Number(cambio.antes);
    if (!Number.isInteger(n) || n < 0 || n > 120) throw new ErrorRitmo("El aviso va de 0 a 120 minutos antes.");
    e.antes = n;
  }
  if (cambio.google !== undefined) e.google = cambio.google ? String(cambio.google).slice(0, 200) : null;
  if (e.clase === "recordatorio" && e.inicio && (!e.fin || e.fin <= e.inicio)) {
    const [h, m] = e.inicio.split(":").map(Number);
    const fin = Math.min(h * 60 + m + 5, 23 * 60 + 59);
    e.fin = `${String(Math.floor(fin / 60)).padStart(2, "0")}:${String(fin % 60).padStart(2, "0")}`;
  }
  if (!e.titulo || !e.inicio || !e.fin || !e.repite) throw new ErrorRitmo("Un bloque fijo necesita nombre, hora de inicio, hora de fin y días.");
  if (e.fin <= e.inicio) throw new ErrorRitmo("El final tiene que ser después del inicio.");
  e.porConfirmar = false;
  return e;
}

/** Qué «por confirmar» se resuelve al tocar ese bloque. */
const clavesDe = (id) => [`ritmo:${id}`, ...(/^(servicio|celula)/.test(id) ? ["ritmo:servicios"] : [])];

/**
 * El ritmo con un cambio aplicado: { accion: "agregar" | "cambiar" | "quitar", id, …campos }.
 * Devuelve { ritmo, bloque, claves } (las claves de «por confirmar» que ya quedaron resueltas). Puro.
 */
export function aplicarRitmo(ritmo, cambio = {}) {
  const { accion, id } = cambio;
  if (accion === "quitar" || accion === "cambiar") {
    const actual = ritmo.find((e) => e.id === id);
    if (!actual) throw new ErrorRitmo(`No encuentro el bloque «${id}».`);
    if (accion === "quitar") return { ritmo: ritmo.filter((e) => e.id !== id), bloque: actual, claves: clavesDe(id) };
    const bloque = comprobado(cambio, actual);
    return { ritmo: ritmo.map((e) => (e.id === id ? bloque : e)), bloque, claves: clavesDe(id) };
  }
  if (accion === "agregar") {
    const base = sinTildes(cambio.titulo).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bloque";
    let nuevoId = base;
    for (let n = 2; ritmo.some((e) => e.id === nuevoId); n++) nuevoId = `${base}-${n}`;
    const bloque = comprobado({ protegido: false, sombrero: null, ...cambio }, { id: nuevoId });
    return { ritmo: [...ritmo, bloque], bloque, claves: [] };
  }
  throw new ErrorRitmo("El cambio del ritmo es agregar, cambiar o quitar.");
}
