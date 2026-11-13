// ============================================================
// Kairos como PRINCIPAL y Google como copia (decisión de Juan)
//
// Tres momentos, todo puro aquí (las llamadas a Google están en google.js):
//
//   1. TRAER (`planDeTraspaso`): lo que hoy se ve en Kairos y vive en Google
//      pasa a vivir en Kairos, tal cual se ve. Lo que se repite cada semana y
//      es sólo suyo va a la semana tipo como fijo en gris; lo demás que es suyo
//      (de una vez, o que se repite de otra forma) pasa a ser un evento de
//      Kairos LIGADO a su original de Google (no se duplica allá). Lo que es con
//      otras personas, lo de calendarios ajenos y lo especial de Google
//      (cumpleaños de contactos, fuera de la oficina) se queda en Google.
//   2. Juan borra en Google con calma (el TRASPASO: mientras dura, lo que se
//      borra allá no se borra aquí) y COPIAR rehace allá todo lo de Kairos.
//   3. Los DOS SENTIDOS (`vueltaDeEventos`, `vueltaDeTareas`): lo que se cambia
//      o se borra en Google vuelve a Kairos; lo que se cambió en Kairos y no
//      llegó, se sube. Quién cambió último lo dicen las fechas: la de Google
//      (`updated`) y la de la fila de Kairos (`actualizado`, la pone el
//      servidor en cada guardado). Si las dos son casi iguales, gana Kairos.
//      La rutina (la semana tipo) no vuelve: se cambia sólo en Kairos.
// ============================================================

import { normalizarEvento, pareceReunion, CLASES_GOOGLE } from "../../src/lib/agenda.js";
import { nuevoId } from "../../src/lib/metodo.js";
import { sombreroPorTitulo } from "../../src/lib/semana.js";
import { sombrerosDe } from "../../src/lib/sombreros.js";
import { ocurrencias, leerRegla } from "../../src/lib/recurrencia.js";
import { sumarDias, diaSemana } from "../../src/lib/fechas.js";

/** Lo que Kairos escribe al final de la descripción de lo que crea en Google. */
export const SUFIJO = "— Agenda personal";
export const sinSufijo = (t) => String(t ?? "").replace(/\s*— Agenda personal\s*$/, "").trim();
/** La línea «A las 09:30» que Kairos añade a las notas de una tarea en Google Tasks. */
export const sinHoraEnNotas = (t) => String(t ?? "").replace(/\n?A las \d{2}:\d{2}\s*$/, "").trim();

/** Margen entre las fechas de Google y de Kairos: dentro de él, gana Kairos (es la subida que acaba de hacer). */
export const MARGEN_MS = 2000;

const CODIGOS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** ¿Una regla que cabe en la semana tipo? Cada semana (o cada día), sin saltos, sin fin. */
export function esSemanalSimple(regla) {
  const r = String(regla ?? "").replace(/^RRULE:/i, "").toUpperCase();
  if (!/^FREQ=(WEEKLY|DAILY)(;|$)/.test(r)) return false;
  return !/(^|;)(INTERVAL=(?!1(;|$))\d+|COUNT=|UNTIL=)/.test(r);
}

/** Los días (0 = domingo) de una regla semanal; sin BYDAY, el día de su primera vez. */
export function diasDeRegla(regla, primera) {
  const r = String(regla ?? "").replace(/^RRULE:/i, "").toUpperCase();
  if (/FREQ=DAILY/.test(r)) return [0, 1, 2, 3, 4, 5, 6];
  const m = /BYDAY=([A-Z,]+)/.exec(r);
  const dias = m ? m[1].split(",").map((c) => CODIGOS.indexOf(c)).filter((d) => d >= 0) : [];
  return dias.length ? dias : [diaSemana(primera)];
}

/** El sombrero de un calendario: el que se guarda en él (Ajustes → Google), si hay uno. */
export function sombreroDeCalendario(guardarEn, calendario) {
  return Object.entries(guardarEn ?? {}).find(([, cal]) => cal === calendario)?.[0] ?? null;
}

/** Qué es un evento suyo de Google al pasar a Kairos: lo que Juan fijó, de todo el día especial, si dice «reunión»… reunión. */
export function claseAlTraer(x, ajustes = {}) {
  const fijada = ajustes?.clasesGoogle?.[x.serie ?? x.id];
  if (CLASES_GOOGLE[fijada] && fijada !== "rutina") return fijada;
  if (x.todoElDia) return "especial";
  return pareceReunion(x.titulo) ? "reunion" : "evento";
}

/** ¿Es suyo y de nadie más? (en un calendario suyo, lo creó él, sin invitados y es un evento normal) */
export const esSuyo = (x) => Boolean(x.calPropio && x.propio && !x.conGente && (x.tipoGoogle ?? "default") === "default");

/** Un evento de Google (ya leído con `deEventoGoogle`) → un evento de Kairos LIGADO a su original. */
export function eventoDeGoogle(x, { servicio, sombreros = [], ajustes = {}, guardarEn = {}, repite = null }) {
  const sombrero = sombreroDeCalendario(guardarEn, x.calendario) ?? sombreroPorTitulo(x.titulo, sombreros);
  const todo = Boolean(x.todoElDia);
  return normalizarEvento({
    id: nuevoId("e"),
    titulo: String(x.titulo ?? "").slice(0, 200),
    sombrero,
    clase: claseAlTraer(x, ajustes),
    protegido: false,
    fuente: "app",
    origen: "google",
    notas: sinSufijo(x.notas),
    personas: [],
    ...(x.lugar ? { lugar: x.lugar } : {}),
    // Sin sombrero, conserva el color de su calendario: se ve igual que antes.
    ...(!sombrero && x.color ? { color: x.color } : {}),
    fecha: repite ? null : x.dia,
    repite: repite ?? null,
    inicio: todo ? "00:00" : x.inicio,
    fin: todo ? "23:59" : x.fin,
    google: { cuenta: x.cuenta, servicio, calendario: x.calendario, id: repite ? x.serie : x.id },
  });
}

/** Una serie semanal suya → un fijo en gris de la semana tipo (como se veía: rutina). */
export function ritmoDeSerie(x, m, sombreros = []) {
  const sombrero = sombreroPorTitulo(m.titulo ?? x.titulo, sombreros);
  const dias = diasDeRegla(m.regla, m.fecha ?? x.dia);
  const inicio = m.inicio ?? x.inicio;
  const fin = m.fin && m.fin > inicio ? m.fin : x.fin && x.fin > inicio ? x.fin : inicio;
  return {
    id: `g-${String(x.serie).replace(/[^A-Za-z0-9]/g, "").slice(-12) || nuevoId("g")}`,
    titulo: String(m.titulo ?? x.titulo).slice(0, 80),
    sombrero,
    clase: "compromiso",
    inicio,
    fin,
    repite: { regla: `FREQ=WEEKLY;BYDAY=${[...dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => CODIGOS[d]).join(",")}`, inicio: "2026-01-05" },
    protegido: sombrero === "reino",
    devocional: sombrero === "reino",
    avisar: false,
    google: x.serie,
    porConfirmar: false,
  };
}

/**
 * Qué pasa a Kairos al «Guardar en Kairos lo que viene de Google». `instancias`: lo leído (con `deEventoGoogle`, más
 * `calPropio` y `servicio`); `maestros`: Map serie → { regla, fecha, inicio, fin, todoElDia, titulo } (la regla de
 * cada serie, leída de su evento principal). No toca nada: devuelve { ritmo, eventos, fuera }.
 */
export function planDeTraspaso({ instancias = [], maestros = new Map(), eventos = [], ritmo = [], ajustes = {}, guardarEnDe = () => ({}) }) {
  const sombreros = sombrerosDe(ajustes);
  const ligados = new Set(eventos.map((e) => e.google?.id).filter(Boolean));
  const enRitmo = new Set((ritmo ?? []).map((e) => e.google).filter(Boolean));
  const ya = (x) => ligados.has(x.id) || (x.serie && (ligados.has(x.serie) || enRitmo.has(x.serie))) || [...ligados].some((id) => String(x.id).startsWith(`${id}_`));
  const fuera = { conGente: new Set(), ajenos: new Set(), otros: new Set() };
  const series = new Map();
  const nuevosEventos = [];
  const nuevoRitmo = [];
  for (const x of instancias) {
    const clave = x.serie ?? x.id;
    if (ya(x)) continue;
    if ((x.tipoGoogle ?? "default") !== "default") fuera.otros.add(clave);
    else if (!x.calPropio) fuera.ajenos.add(clave);
    else if (x.conGente || !x.propio) fuera.conGente.add(clave);
    else if (x.serie) {
      if (!series.has(x.serie)) series.set(x.serie, x);
    } else nuevosEventos.push(eventoDeGoogle(x, { servicio: x.servicio, sombreros, ajustes, guardarEn: guardarEnDe(x.servicio) }));
  }
  for (const [serie, x] of series) {
    const m = maestros.get(serie);
    try {
      if (!m?.regla) throw new Error("sin regla");
      leerRegla(m.regla);
    } catch {
      fuera.otros.add(serie);
      continue;
    }
    if (!x.todoElDia && !m.todoElDia && esSemanalSimple(m.regla)) nuevoRitmo.push(ritmoDeSerie(x, m, sombreros));
    else {
      const base = { ...x, titulo: m.titulo ?? x.titulo, dia: m.fecha ?? x.dia, inicio: m.inicio ?? x.inicio, fin: m.fin ?? x.fin, todoElDia: m.todoElDia ?? x.todoElDia };
      nuevosEventos.push(eventoDeGoogle(base, { servicio: x.servicio, sombreros, ajustes, guardarEn: guardarEnDe(x.servicio), repite: { regla: String(m.regla).replace(/^RRULE:/i, ""), inicio: m.fecha ?? x.dia } }));
    }
  }
  return { ritmo: nuevoRitmo, eventos: nuevosEventos, fuera: { conGente: fuera.conGente.size, ajenos: fuera.ajenos.size, otros: fuera.otros.size } };
}

// ------------------------------------------------------------
// Copiar todo a Google
// ------------------------------------------------------------

/** Lo que «Copiar todo a Google» tiene que tener allá: eventos con día (de una semana atrás en adelante) o que se repiten, y tareas abiertas. */
export function candidatosACopiar({ eventos = [], acciones = [], hoy, sombreroJuancito = null }) {
  const desde = sumarDias(hoy, -7);
  const ev = eventos
    .filter((e) => e.fuente !== "google" && (e.repite?.regla ? !e.fecha : e.fecha && e.fecha >= desde))
    .map((e) => ({ tipo: "evento", id: e.id }));
  const ac = acciones
    .filter((a) => a.estado === "abierta" && a.lista === "siguientes" && (!sombreroJuancito || a.sombrero !== sombreroJuancito))
    .map((a) => ({ tipo: "accion", id: a.id }));
  return [...ev, ...ac].sort((a, b) => `${a.tipo}:${a.id}`.localeCompare(`${b.tipo}:${b.id}`));
}

// ------------------------------------------------------------
// Los dos sentidos
// ------------------------------------------------------------

const tiempo = (iso) => {
  const t = Date.parse(iso ?? "");
  return Number.isFinite(t) ? t : 0;
};
/** ¿Lo de Google es más nuevo que lo de Kairos? (si no se sabe, no) */
export const googleMasNuevo = (googleIso, kairosIso) => tiempo(googleIso) > tiempo(kairosIso) + MARGEN_MS;

/** Lo que importa de un evento, igual de escrito en los dos lados (para saber si son distintos). */
const huellaDeKairos = (k) => [String(k.titulo ?? "").trim().slice(0, 200), k.fecha, k.inicio ?? "00:00", k.fin ?? "23:59", sinSufijo(k.notas).slice(0, 1000)].join("|");
const huellaDeGoogle = (x) => [String(x.titulo ?? "").trim().slice(0, 200), x.dia, x.todoElDia ? "00:00" : x.inicio, x.todoElDia ? "23:59" : x.fin, sinSufijo(x.notas).slice(0, 1000)].join("|");

/** Lo de Google puesto en el evento de Kairos (sin tocar lo que sólo existe aquí: sombrero, clase, proyecto…). */
export function aplicarDeGoogle(k, x) {
  return normalizarEvento({
    ...k,
    titulo: String(x.titulo ?? "").slice(0, 200),
    fecha: x.dia,
    inicio: x.todoElDia ? "00:00" : x.inicio,
    fin: x.todoElDia ? "23:59" : x.fin,
    notas: sinSufijo(x.notas),
    google: { ...k.google, calendario: x.calendario ?? k.google?.calendario },
  });
}

const tieneVezEntre = (k, desde, hasta) => {
  try {
    return ocurrencias(k.repite.regla, k.repite.inicio, desde, hasta, { max: 1 }).length > 0;
  } catch {
    return false;
  }
};

/**
 * Los eventos, de Google a Kairos y al revés. `leidos`: lo leído en esta vuelta (todas las cuentas, con `calPropio`);
 * `leidosCal`: los calendarios que se leyeron sin error; `eventos`: TODOS los de Kairos; `vigencias`: Map id → la fecha
 * de su último guardado en Kairos. Devuelve qué hacer (google.js lo hace):
 *   actualizar: eventos de Kairos con lo de Google (cambiaron allá);
 *   subir:      eventos de Kairos que cambiaron aquí y allá siguen como antes;
 *   verificar:  ligados que no aparecieron (¿se borraron allá o se movieron fuera de la ventana?);
 *   adoptar:    lo nuevo y suyo de Google (de una vez), que pasa a Kairos;
 *   borrarEnGoogle: lo que Kairos creó allá y aquí ya no existe (un borrado que no llegó).
 */
export function vueltaDeEventos({ leidos = [], leidosCal = new Set(), eventos = [], vigencias = new Map(), desde, hasta, hoy }) {
  const porId = new Map(leidos.map((x) => [x.id, x]));
  const kairosPorId = new Map(eventos.map((k) => [k.id, k]));
  const ligados = new Set();
  const actualizar = [];
  const subir = [];
  const verificar = [];
  for (const k of eventos) {
    const g = k.google;
    if (!g?.id) continue;
    ligados.add(g.id);
    const calLeido = leidosCal.has(`${g.servicio}|${g.calendario ?? "primary"}`);
    if (k.repite?.regla && !k.fecha) {
      // Lo que se repite sólo se mira por si se borró allá (lo demás se cambia aquí).
      const alguna = leidos.some((x) => x.serie === g.id || String(x.id).startsWith(`${g.id}_`));
      if (!alguna && calLeido && tieneVezEntre(k, desde, hasta)) verificar.push(k);
      continue;
    }
    if (!k.fecha || k.fecha < desde || k.fecha > hasta) continue;
    const x = porId.get(g.id);
    if (!x) {
      if (calLeido) verificar.push(k);
      continue;
    }
    const movido = x.calendario && x.calendario !== g.calendario;
    if (huellaDeKairos(k) === huellaDeGoogle(x)) {
      if (movido) actualizar.push({ ...k, google: { ...g, calendario: x.calendario } });
      continue;
    }
    if (googleMasNuevo(x.actualizado, vigencias.get(k.id))) actualizar.push(aplicarDeGoogle(k, x));
    else subir.push(k);
  }
  const adoptar = [];
  const borrarEnGoogle = new Map();
  for (const x of leidos) {
    if (ligados.has(x.id) || (x.serie && ligados.has(x.serie))) continue;
    if (x.kairos) {
      // Lo creó Kairos: si aquí ya no existe (o es otra copia), es un borrado que no llegó allá. De una serie se borra
      // la serie entera (su evento principal), una vez.
      const k = kairosPorId.get(x.kairos);
      const id = x.serie ?? x.id;
      if (k && !k.google?.id && !x.serie) actualizar.push({ ...k, google: { cuenta: x.cuenta, servicio: x.servicio, calendario: x.calendario, id: x.id } });
      else borrarEnGoogle.set(`${x.servicio}|${id}`, { ...x, id });
      continue;
    }
    if (!x.serie && esSuyo(x) && x.dia >= hoy) adoptar.push(x);
  }
  return { actualizar, subir, verificar, adoptar, borrarEnGoogle: [...borrarEnGoogle.values()] };
}

/** Una tarea de Google → los campos de Kairos que cambia (título, notas, fecha, hecha). */
export function tareaDeGoogle(k, t, hoy) {
  const due = t.due ? String(t.due).slice(0, 10) : null;
  const hecha = t.status === "completed";
  const fecha = k.limite ? { limite: due } : { cuando: due };
  return {
    ...k,
    titulo: String(t.title ?? k.titulo).trim().slice(0, 300) || k.titulo,
    notas: sinHoraEnNotas(t.notes),
    ...fecha,
    ...(hecha && k.estado !== "hecha" ? { estado: "hecha", hechaEl: hoy, enfoque: null } : {}),
    ...(!hecha && k.estado === "hecha" ? { estado: "abierta", hechaEl: null } : {}),
  };
}

const huellaTareaKairos = (k) => [String(k.titulo ?? "").trim(), sinHoraEnNotas(k.notas), k.limite ?? k.cuando ?? null, k.estado === "hecha"].join("|");
const huellaTareaGoogle = (t) => [String(t.title ?? "").trim(), sinHoraEnNotas(t.notes), t.due ? String(t.due).slice(0, 10) : null, t.status === "completed"].join("|");

/**
 * Las tareas ligadas de una lista de Google Tasks, en los dos sentidos. `tareas`: lo que devolvió Google (con las
 * borradas: showDeleted). Devuelve { actualizar, borrar (ids de Kairos), subir }.
 */
export function vueltaDeTareas({ tareas = [], acciones = [], vigencias = new Map(), hoy }) {
  const porGoogle = new Map(acciones.filter((a) => a.google?.id).map((a) => [a.google.id, a]));
  const actualizar = [];
  const borrar = [];
  const subir = [];
  for (const t of tareas) {
    const k = porGoogle.get(t?.id);
    if (!k) continue;
    const masNuevo = googleMasNuevo(t.updated, vigencias.get(k.id));
    if (t.deleted) {
      if (masNuevo) borrar.push(k.id);
      continue;
    }
    if (huellaTareaKairos(k) === huellaTareaGoogle(t)) continue;
    if (masNuevo) actualizar.push(tareaDeGoogle(k, t, hoy));
    else subir.push(k);
  }
  return { actualizar, borrar, subir };
}
