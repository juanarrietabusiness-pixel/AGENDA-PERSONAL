// ============================================================
// El método: GTD (David Allen), el estándar de la productividad personal
//
// Cinco pasos: CAPTURAR (sacarlo de la cabeza), ACLARAR (¿qué es y qué hay
// que hacer?), ORGANIZAR (ponerlo en su lista), REFLEXIONAR (la revisión
// semanal) y HACER (escoger con lo que hay delante). El agente hace solo el
// segundo y el tercero; los demás son tuyos.
//
// Las listas son las de GTD, sin inventar otras:
//
//   Bandeja        lo capturado que nadie ha aclarado todavía
//   Siguientes     acciones concretas que puedes hacer ya («Llamar a…»)
//   En espera      lo que delegaste o esperas de otra persona, con su fecha para preguntar
//   Algún día      lo que quizás harás; no avisa, sale en la revisión semanal
//   Referencia     información sin nada que hacer
//
// Y el CALENDARIO, que en GTD es sagrado: sólo lo que tiene que pasar ese
// día o a esa hora. Una fecha «para hacerla» no es una fecha límite.
//
// LO QUE ESTO CAMBIA RESPECTO A LO QUE NO FUNCIONÓ
//
// Nada se apila en rojo por haber pasado su «día planeado». Rojo sólo es lo
// que tenía una FECHA LÍMITE de verdad y se pasó. Lo que planeaste para un
// día y no hiciste se decide en el cierre del día (hoy, otro día, algún día
// o soltar), y si se pospone tres veces, la pregunta cambia: ¿sigue valiendo
// la pena?
// ============================================================

import { esFecha, sumarDias, diasEntre } from "./fechas.js";
import { siguiente, siguienteDespuesDeHecha } from "./recurrencia.js";
import { esIdSombrero } from "./sombreros.js";

export const LISTAS = Object.freeze({
  bandeja: { nombre: "Bandeja", detalle: "Lo capturado que falta aclarar" },
  siguientes: { nombre: "Siguientes acciones", detalle: "Lo que puedes hacer ya" },
  espera: { nombre: "En espera", detalle: "Lo que delegaste o esperas de alguien" },
  "algun-dia": { nombre: "Algún día", detalle: "Quizás; sin avisos" },
  referencia: { nombre: "Referencia", detalle: "Información, sin nada que hacer" },
});
export const IDS_LISTA = Object.freeze(Object.keys(LISTAS));
export const ESTADOS = Object.freeze(["abierta", "hecha", "soltada"]);

/** La regla de los dos minutos de GTD: si cuesta menos, se hace al aclararla. */
export const DOS_MINUTOS = 2;
/** Posponer tres veces cambia la pregunta: ¿sigue valiendo la pena? */
export const MAX_POSPUESTAS = 3;
/** Las duraciones que se estiman, en minutos: suficientes para acomodar el día sin pensar de más. */
export const DURACIONES = Object.freeze([5, 15, 30, 60, 90, 120]);
export const ENERGIAS = Object.freeze(["alta", "media", "baja"]);
export const CLASES_ACCION = Object.freeze(["tarea", "recordatorio"]);
export const VALORES = Object.freeze(["alto", "medio", "bajo"]);

let contador = 0;
export const nuevoId = (prefijo = "a") => `${prefijo}-${Date.now().toString(36)}-${(contador++).toString(36)}`;

/** Una acción con todos sus campos, para no comprobar `undefined` en todas partes. */
export function nuevaAccion(datos = {}, hoy = null) {
  return {
    id: datos.id ?? nuevoId(),
    titulo: limpiarTitulo(datos.titulo),
    notas: String(datos.notas ?? "").slice(0, 4000),
    // Tarea (algo que se HACE) o recordatorio (algo que hay que tener presente a su hora). Se ven aparte.
    clase: CLASES_ACCION.includes(datos.clase) ? datos.clase : "tarea",
    sombrero: esIdSombrero(datos.sombrero) ? datos.sombrero : null,
    proyectoId: datos.proyectoId ?? null,
    lista: IDS_LISTA.includes(datos.lista) ? datos.lista : "bandeja",
    estado: ESTADOS.includes(datos.estado) ? datos.estado : "abierta",
    // Cuándo piensas hacerla (blanda: si pasa, se decide en el cierre del día).
    cuando: esFecha(datos.cuando) ? datos.cuando : null,
    // Fecha límite REAL (dura: si pasa, es rojo). GTD: no se inventan.
    limite: esFecha(datos.limite) ? datos.limite : null,
    // Hora concreta: un recordatorio o un bloque de tiempo.
    hora: /^\d{2}:\d{2}$/.test(datos.hora ?? "") ? datos.hora : null,
    minutos: DURACIONES.includes(datos.minutos) ? datos.minutos : 30,
    energia: ENERGIAS.includes(datos.energia) ? datos.energia : "media",
    // Eisenhower: lo IMPORTANTE lo decides tú (el agente lo propone); lo URGENTE lo calcula el código con `limite`.
    importante: Boolean(datos.importante),
    // «Las 3 de hoy»: la fecha en que la escogiste como una de las tres.
    enfoque: esFecha(datos.enfoque) ? datos.enfoque : null,
    espera: datos.espera ?? null, // { persona, desde, preguntar: AAAA-MM-DD }
    repite: datos.repite ?? null, // { regla: RRULE, modo: "calendario" | "despues", inicio }
    metaId: datos.metaId ?? null,
    personas: Array.isArray(datos.personas) ? datos.personas : [],
    valor: ["alto", "medio", "bajo"].includes(datos.valor) ? datos.valor : null,
    delegable: datos.delegable ?? null, // { a, porque }
    confidencial: Boolean(datos.confidencial),
    pospuesta: Number(datos.pospuesta) || 0,
    origen: datos.origen ?? "app",
    // Lo que viene de Juancito Ads trae su cliente.
    cliente: datos.cliente ?? null,
    // Dónde vive también: { id } en Juancito Ads; { cuenta, lista, id } en Google Tasks.
    juancito: datos.juancito ?? null,
    google: datos.google ?? null,
    creada: datos.creada ?? hoy,
    hechaEl: datos.hechaEl ?? null,
  };
}

export function limpiarTitulo(t) {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

/**
 * ¿Parece una acción física y concreta? GTD pide que una siguiente acción empiece por un verbo
 * («Llamar a Adolfo», no «Adolfo»). Es una pista para la pantalla, no una regla que bloquee.
 */
export function pareceAccion(titulo) {
  const primera = limpiarTitulo(titulo).split(" ")[0]?.toLowerCase().replace(/[^a-záéíóúñü]/g, "") ?? "";
  return /(ar|er|ir|arle|erle|irle|arlo|erlo|irlo|arla|erla|irla|arles|arlas|arlos)$/.test(primera) && primera.length > 3;
}

// ------------------------------------------------------------
// Aclarar: el árbol de decisiones de GTD
// ------------------------------------------------------------

/** Las preguntas de «Aclarar», en orden. La pantalla las hace cuando el agente no está o no supo. */
export const PREGUNTAS_ACLARAR = Object.freeze([
  { id: "accionable", texto: "¿Hay algo que hacer con esto?" },
  { id: "noAccionable", texto: "Entonces, ¿qué es?", si: (r) => r.accionable === false, opciones: ["basura", "referencia", "algun-dia"] },
  { id: "variosPasos", texto: "¿Necesita más de un paso?", si: (r) => r.accionable === true },
  { id: "minutos", texto: "¿Cuánto tarda el siguiente paso?", si: (r) => r.accionable === true },
  { id: "laHagoYo", texto: "¿Te toca a ti hacerlo?", si: (r) => r.accionable === true && r.minutos > DOS_MINUTOS },
  { id: "fechaFija", texto: "¿Tiene que pasar un día o a una hora concreta?", si: (r) => r.accionable === true && r.minutos > DOS_MINUTOS && r.laHagoYo !== false },
]);

/**
 * Las respuestas de «Aclarar» → qué hacer. Puro y sin IA: el agente responde las mismas preguntas.
 *   { destino: "basura" | "referencia" | "algun-dia" | "hazla-ya" | "espera" | "calendario" | "siguientes", proyecto }
 */
export function aclarar(r) {
  if (r.accionable === false) {
    const destino = ["basura", "referencia", "algun-dia"].includes(r.noAccionable) ? r.noAccionable : "referencia";
    return { destino, proyecto: false };
  }
  const proyecto = r.variosPasos === true;
  if (Number(r.minutos) <= DOS_MINUTOS) return { destino: "hazla-ya", proyecto };
  if (r.laHagoYo === false) return { destino: "espera", proyecto };
  if (r.fechaFija === true) return { destino: "calendario", proyecto };
  return { destino: "siguientes", proyecto };
}

/** La lista en que queda una acción según su destino al aclararla. */
export const listaDeDestino = (destino) =>
  ({ "algun-dia": "algun-dia", referencia: "referencia", espera: "espera" }[destino] ?? "siguientes");

// ------------------------------------------------------------
// Hacer, posponer, soltar
// ------------------------------------------------------------

/**
 * Marca hecha. Si se repite, devuelve también la SIGUIENTE (una acción nueva):
 *   · modo «calendario»: la próxima fecha de la regla después de la que tocaba;
 *   · modo «despues»: cuenta desde hoy, el día en que se hizo.
 */
export function completar(accion, hoy) {
  // «enfoque» se queda: lo hecho de tus 3 de hoy sigue a la vista (tachado) el resto del día.
  const hecha = { ...accion, estado: "hecha", hechaEl: hoy };
  if (!accion.repite?.regla) return { hecha, siguiente: null };
  const { regla, modo = "calendario", inicio } = accion.repite;
  const ancla = accion.cuando ?? accion.limite ?? hoy;
  const proxima = modo === "despues" ? siguienteDespuesDeHecha(regla, hoy) : siguiente(regla, inicio ?? ancla, ancla);
  if (!proxima) return { hecha, siguiente: null };
  const salto = accion.cuando && accion.limite ? diasEntre(accion.cuando, accion.limite) : null;
  const siguienteAccion = nuevaAccion({
    ...accion,
    id: undefined,
    estado: "abierta",
    hechaEl: null,
    enfoque: null,
    pospuesta: 0,
    cuando: accion.cuando ? proxima : null,
    limite: accion.limite ? (salto !== null ? sumarDias(proxima, salto) : proxima) : null,
  }, hoy);
  return { hecha, siguiente: siguienteAccion };
}

/** Pasar a otro día. Cuenta cuántas veces se movió: a la tercera, la pregunta es otra. */
export function posponer(accion, nuevoDia) {
  return { ...accion, cuando: nuevoDia, enfoque: null, pospuesta: (accion.pospuesta || 0) + 1 };
}

/** «Ya no aplica»: no se borra (enseña al cerebro qué se suelta), sólo deja de estar abierta. */
export const soltar = (accion, hoy) => ({ ...accion, estado: "soltada", hechaEl: hoy, enfoque: null });

export const pideDecision = (accion) => (accion.pospuesta || 0) >= MAX_POSPUESTAS;

// ------------------------------------------------------------
// Proyectos
// ------------------------------------------------------------

/**
 * Un PROYECTO es todo resultado que pide más de un paso y tiene final («Presentación del 3 de octubre»).
 * Una RESPONSABILIDAD es permanente y no termina («La célula», «Mi matrimonio», «Marca personal»).
 */
export const TIPOS_PROYECTO = Object.freeze(["proyecto", "responsabilidad"]);

/** La regla de oro de la revisión semanal de GTD: todo proyecto activo tiene al menos una siguiente acción. */
export function proyectosSinSiguiente(proyectos, acciones) {
  const conSiguiente = new Set(
    acciones.filter((a) => a.estado === "abierta" && a.lista === "siguientes" && a.proyectoId).map((a) => a.proyectoId),
  );
  return proyectos.filter((p) => p.tipo === "proyecto" && p.estado !== "terminado" && !conSiguiente.has(p.id));
}

/** Lo que espera de otra persona y ya toca preguntar. */
export const esperasPorPreguntar = (acciones, hoy) =>
  acciones.filter((a) => a.estado === "abierta" && a.lista === "espera" && a.espera?.preguntar && a.espera.preguntar <= hoy);
