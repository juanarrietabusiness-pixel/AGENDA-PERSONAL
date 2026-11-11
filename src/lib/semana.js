// ============================================================
// Tu semana por bloques
//
// La semana tipo de Juan vive en Kairos (es el «ritmo» del perfil): BLOQUES con
// su sombrero (Reino 6–8, Trabajo 8–12, Trabajo 13–18) y RECORDATORIOS dentro
// (la oración a las 6:00, la lectura a las 7:15, Proverbios a las 11:45). Con
// eso la agenda sabe qué toca AHORA, qué tareas van en cada bloque, cuántas
// horas tiene cada sombrero y cuándo avisar.
//
// Reino es un sombrero aparte de Iglesia: la intimidad con Dios va separada de
// las tareas de la iglesia, y va PRIMERO.
//
// Todo aquí es puro: lo usan la pantalla, el servidor y el seguimiento.
// ============================================================

import { REINO, sombrerosDe } from "./sombreros.js";
import { RITMO_BASE } from "./ritmo.js";
import { tocaEl } from "./recurrencia.js";
import { minutos, aHora, diaSemana } from "./fechas.js";

const CODIGOS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const INICIALES = ["D", "L", "M", "X", "J", "V", "S"];
const plano = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** ¿Bloque, compromiso fijo o recordatorio? Lo de antes, sin `clase`, es un bloque. */
export const claseDeRitmo = (e) => (e?.clase === "recordatorio" || e?.clase === "compromiso" ? e.clase : "bloque");

/** ¿Avisa? Un bloque, al empezar (menos los de Reino, que no se interrumpen); un recordatorio, sí; un compromiso, no. */
export const avisa = (e) =>
  e.avisar !== undefined ? Boolean(e.avisar) : claseDeRitmo(e) === "recordatorio" || (claseDeRitmo(e) === "bloque" && e.sombrero !== "reino" && !e.devocional);

/** Los días de un bloque como números (0 = domingo). */
export const diasDe = (e) => (/BYDAY=([A-Z,]+)/.exec(e?.repite?.regla ?? "")?.[1]?.split(",") ?? []).map((c) => CODIGOS.indexOf(c)).filter((n) => n >= 0);

/** «L–V», «L, X, V», «Todos los días». */
export function textoDias(e) {
  const d = [...new Set(diasDe(e))].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (d.length === 7) return "Todos los días";
  const orden = d.map((n) => (n + 6) % 7);
  const seguidos = orden.length > 2 && orden.every((n, i) => i === 0 || n === orden[i - 1] + 1);
  return seguidos ? `${INICIALES[d[0]]}–${INICIALES[d[d.length - 1]]}` : d.map((n) => INICIALES[n]).join(", ");
}

export const duracion = (e) => Math.max(0, minutos(e.fin) - minutos(e.inicio));

/** «1 h 45», «3 h», «20 min». */
export function textoHoras(min) {
  const n = Math.max(0, Math.round(Number(min) || 0));
  const h = Math.floor(n / 60);
  const m = n % 60;
  return h ? `${h} h${m ? ` ${m}` : ""}` : `${m} min`;
}

/**
 * Lo de la semana que toca ese día, en orden: { bloques, recordatorios, compromisos }. Con lo cambiado SÓLO ese día
 * (`cambios`): movido de hora, quitado o puesto ahí una vez. `{ tipo: true }` da la semana tipo, sin esos cambios.
 */
export function semanaDelDia(ritmo, dia, { tipo = false } = {}) {
  const del = [];
  for (const e of ritmo ?? []) {
    const c = tipo ? null : e.cambios?.[dia];
    const toca = e.repite?.regla && tocaEl(e.repite.regla, e.repite.inicio, dia);
    if (c?.extra || (toca && !c?.quitado)) del.push(c?.inicio ? { ...e, inicio: c.inicio, fin: c.fin ?? e.fin, unDia: true } : e);
  }
  del.sort((a, b) => a.inicio.localeCompare(b.inicio));
  return {
    bloques: del.filter((e) => claseDeRitmo(e) === "bloque"),
    recordatorios: del.filter((e) => claseDeRitmo(e) === "recordatorio"),
    compromisos: del.filter((e) => claseDeRitmo(e) === "compromiso"),
  };
}

/**
 * Mover para SIEMPRE un bloque (o compromiso) que estaba un día de la semana a otro día y hora: el cambio para
 * `aplicarRitmo` (sus horas y, si cambió de día, ese día de la semana por el nuevo).
 */
export function moverSiempre(e, { desde, a, inicio, fin }) {
  const cambio = { accion: "cambiar", id: e.id, inicio, fin };
  const de = diaSemana(desde);
  const hacia = diaSemana(a);
  if (de !== hacia) cambio.dias = [...new Set([...diasDe(e).filter((d) => d !== de), hacia])];
  return cambio;
}

/** El bloque en el que estás a esa hora (el más corto si se pisan) y lo que sigue hoy. */
export function ahoraYDespues(ritmo, dia, hora) {
  const { bloques, recordatorios } = semanaDelDia(ritmo, dia);
  const m = minutos(hora);
  const ahora = bloques.filter((b) => minutos(b.inicio) <= m && m < minutos(b.fin)).sort((a, b) => duracion(a) - duracion(b))[0] ?? null;
  const despues = [...bloques, ...recordatorios].filter((e) => minutos(e.inicio) > m).sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(0, 3);
  return { ahora, despues };
}

/**
 * Las tareas de un bloque ese día: las que le asignaste (`accion.bloque`) y, si es del sombrero, las de ese sombrero
 * planeadas para ese día o antes que no van en otro bloque. Sólo abiertas.
 */
export function tareasDelBloque(acciones, bloque, dia, { todos = [] } = {}) {
  const deOtro = (a) => a.bloque && a.bloque !== bloque.id && todos.some((b) => b.id === a.bloque);
  return acciones.filter(
    (a) =>
      a.estado === "abierta" &&
      (a.clase ?? "tarea") === "tarea" &&
      ((a.bloque === bloque.id && a.cuando === dia) ||
        (bloque.sombrero && a.sombrero === bloque.sombrero && !deOtro(a) && a.lista === "siguientes" && ((a.cuando && a.cuando <= dia) || (a.limite && a.limite <= dia)))),
  );
}

/** Minutos de tareas en un bloque frente a lo que dura: { ocupado, cabe, sobra }. */
export function carga(tareas, bloque) {
  const ocupado = tareas.reduce((s, a) => s + (Number(a.minutos) || 30), 0);
  const cabe = duracion(bloque);
  return { ocupado, cabe, sobra: ocupado - cabe };
}

/** Horas de la semana por sombrero, desde los bloques y los compromisos fijos. [{ id, minutos }] */
export function horasPorSombrero(ritmo, sombreros) {
  const min = Object.fromEntries(sombreros.map((s) => [s.id, 0]));
  for (const e of ritmo ?? []) {
    if (claseDeRitmo(e) === "recordatorio" || !(e.sombrero in min)) continue;
    min[e.sombrero] += duracion(e) * new Set(diasDe(e)).size;
  }
  const total = Object.values(min).reduce((a, b) => a + b, 0);
  return sombreros.map((s) => ({ id: s.id, minutos: min[s.id], porcentaje: total ? Math.round((min[s.id] / total) * 100) : 0 }));
}

/** Minutos de la semana en bloques SIN sombrero (no cuentan para ninguno). */
export function minutosSinSombrero(ritmo, sombreros) {
  const ids = new Set(sombreros.map((s) => s.id));
  return (ritmo ?? []).filter((e) => claseDeRitmo(e) === "bloque" && !ids.has(e.sombrero)).reduce((t, e) => t + duracion(e) * new Set(diasDe(e)).size, 0);
}

/** El bloque que contiene esa hora ese día (el más corto si se pisan). */
const bloqueDeLaHora = (bloques, hora) => {
  if (!hora) return null;
  const m = minutos(hora);
  return bloques.filter((b) => minutos(b.inicio) <= m && m < minutos(b.fin)).sort((a, b) => duracion(a) - duracion(b))[0] ?? null;
};

/**
 * Un día de la semana con su jerarquía, para que se vea qué es cada cosa: los BLOQUES (tramos de tiempo) con sus
 * RECORDATORIOS y sus TAREAS dentro, y lo que no cae en ningún bloque aparte. `tareas` son las acciones de ese día
 * (las tareas y los recordatorios con hora). Una tarea va al bloque que se le asignó o, si no, al primero de su
 * sombrero ese día. Devuelve { bloques: [{ bloque, recordatorios, tareas }], recordatorios, tareas }.
 */
export function diaEnBloques(ritmo, dia, tareas = [], { tipo = false } = {}) {
  const { bloques, recordatorios, compromisos } = semanaDelDia(ritmo, dia, { tipo });
  const dentro = new Map(bloques.map((b) => [b.id, { bloque: b, recordatorios: [], tareas: [] }]));
  const sueltos = { recordatorios: [], tareas: [] };
  const recs = [
    ...recordatorios.map((r) => ({ ...r, tipo: "ritmo" })),
    ...tareas.filter((a) => a.clase === "recordatorio").map((a) => ({ ...a, tipo: "accion", inicio: a.hora ?? null })),
  ].sort((a, b) => (a.inicio ?? "99").localeCompare(b.inicio ?? "99"));
  for (const r of recs) {
    const b = bloqueDeLaHora(bloques, r.inicio);
    (b ? dentro.get(b.id).recordatorios : sueltos.recordatorios).push(r);
  }
  for (const a of tareas.filter((x) => (x.clase ?? "tarea") === "tarea")) {
    const b = (a.bloque && dentro.has(a.bloque) && dentro.get(a.bloque).bloque) || (a.sombrero && bloques.find((x) => x.sombrero === a.sombrero)) || null;
    (b ? dentro.get(b.id).tareas : sueltos.tareas).push(a);
  }
  return { bloques: [...dentro.values()], ...sueltos, compromisos };
}

/** Bloques que se cruzan el mismo día: [{ a, b, dias }]. Con dos a la vez, «Ahora» no sabe cuál toca. */
export function choques(ritmo) {
  const bloques = (ritmo ?? []).filter((e) => claseDeRitmo(e) === "bloque" && e.inicio && e.fin);
  const salida = [];
  for (let i = 0; i < bloques.length; i++) {
    for (let j = i + 1; j < bloques.length; j++) {
      const [a, b] = [bloques[i], bloques[j]];
      const dias = diasDe(a).filter((d) => diasDe(b).includes(d));
      if (dias.length && a.inicio < b.fin && b.inicio < a.fin) salida.push({ a, b, dias });
    }
  }
  return salida;
}

/** Lo que conviene revisar de la semana tipo: bloques sin sombrero, los que se cruzan y los «por confirmar». */
export function porRevisar(ritmo, sombreros) {
  const ids = new Set(sombreros.map((s) => s.id));
  return {
    sinSombrero: (ritmo ?? []).filter((e) => claseDeRitmo(e) === "bloque" && !ids.has(e.sombrero)),
    choques: choques(ritmo),
    porConfirmar: (ritmo ?? []).filter((e) => e.porConfirmar),
  };
}

// ------------------------------------------------------------
// Reino, una vez
// ------------------------------------------------------------

/**
 * Pone Reino como primer sombrero (si no lo hay) y le pasa lo devocional de la semana (la oración, la Palabra). Una sola
 * vez: deja `ajustes.reino`. Devuelve { perfil, cambio }.
 */
export function conReino(perfil) {
  const ajustes = perfil?.ajustes ?? {};
  if (ajustes.reino) return { perfil, cambio: false };
  const lista = sombrerosDe(ajustes);
  const sombreros = lista.some((s) => s.id === REINO.id || plano(s.nombre) === "reino") ? lista : [{ ...REINO }, ...lista].slice(0, 10);
  const ritmo = (perfil?.ritmo ?? RITMO_BASE).map((e) => (e.devocional && !e.sombrero ? { ...e, sombrero: REINO.id } : e));
  return { perfil: { ...perfil, ajustes: { ...ajustes, sombreros, reino: true }, ritmo }, cambio: true };
}

// ------------------------------------------------------------
// Traer la rutina de Google Calendar a la semana de Kairos
// ------------------------------------------------------------

const PISTAS = [
  ["iglesia", /\b(estudio biblico)\b/],
  ["reino", /\b(oracion|orar|palabra|biblia|biblica|devocional|proverbios|salmos|ayuno|adoracion|intimidad|lectura|intercesion)\b/],
  ["iglesia", /\b(celula|servicio|culto|iglesia|discipulado|lideres|ministerio|retiro)\b/],
  ["artistico", /\b(ensayo|musica|cancion|estudio de grabacion|grabacion|compon|presentacion|show|concierto)\b/],
  ["trabajo", /\b(trabajo|oficina|agencia|juancito|clientes|reunion de equipo|equipo)\b/],
  ["personal", /\b(familia|esposa|matrimonio|hogar|gimnasio|gym|ejercicio|almuerzo|cena|descanso|casa)\b/],
];

/** El sombrero que sugiere un título (si existe entre los de la persona). */
export function sombreroPorTitulo(titulo, sombreros) {
  const t = plano(titulo);
  for (const [id, re] of PISTAS) if (re.test(t) && sombreros.some((s) => s.id === id)) return id;
  return null;
}

/**
 * La rutina de Google (eventos que se repiten, clase «rutina») como bloques de la semana: una entrada por serie, con
 * los días en que salió, su hora y un sombrero sugerido por el título. Lo corto (menos de 30 min) es un recordatorio.
 * No trae lo que ya se trajo (`google` = la serie). Devuelve { nuevos, quitar } (los «por confirmar» de partida que
 * caen a la misma hora el mismo día, que la rutina de Google sustituye).
 */
export function rutinaDeGoogle(externos, ritmo, { ajustes = {}, esRutina = () => true, todas = false }) {
  const sombreros = sombrerosDe(ajustes);
  const ya = new Set((ritmo ?? []).map((e) => e.google).filter(Boolean));
  const series = new Map();
  for (const x of externos ?? []) {
    if (x.tipo !== "evento" || !x.serie || !x.inicio || x.todoElDia || ya.has(x.serie)) continue;
    // Con `todas`: todo lo que se repite y es SÓLO tuyo (lo de otras personas se queda en Google, que es suyo).
    if (todas ? x.conGente : !esRutina(x)) continue;
    const s = series.get(x.serie) ?? { x, dias: new Set() };
    s.dias.add(diaSemana(x.dia));
    series.set(x.serie, s);
  }
  const nuevos = [];
  for (const [serie, { x, dias }] of series) {
    const corto = minutos(x.fin ?? x.inicio) - minutos(x.inicio) < 30;
    const codigos = [...dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => CODIGOS[d]);
    const sombrero = sombreroPorTitulo(x.titulo, sombreros);
    nuevos.push({
      id: `g-${String(serie).replace(/[^A-Za-z0-9]/g, "").slice(-12) || nuevos.length}`,
      titulo: String(x.titulo).slice(0, 80),
      sombrero,
      clase: corto ? "recordatorio" : todas ? claseParaTraer(x.titulo, sombrero) : "bloque",
      inicio: x.inicio,
      fin: x.fin && x.fin > x.inicio ? x.fin : aHora(Math.min(minutos(x.inicio) + 5, 23 * 60 + 59)),
      repite: { regla: `FREQ=WEEKLY;BYDAY=${codigos.join(",")}`, inicio: "2026-01-05" },
      protegido: sombrero === "reino",
      devocional: sombrero === "reino",
      ...(corto ? { antes: 0 } : {}),
      google: serie,
      porConfirmar: false,
    });
  }
  const quitar = (ritmo ?? [])
    .filter((e) => e.porConfirmar && nuevos.some((n) => diasDe(n).some((d) => diasDe(e).includes(d)) && Math.abs(minutos(n.inicio) - minutos(e.inicio)) <= 30))
    .map((e) => e.id);
  return { nuevos, quitar };
}

/** Lo que llega de Google: un BLOQUE si es para meter tareas (el trabajo, «task», un proyecto); si no, un compromiso fijo. */
export function claseParaTraer(titulo, sombrero) {
  const t = plano(titulo);
  if (/\b(trabajo|task|tasks|tareas|oficina|enfoque|proyecto|proyectos|grabar|edicion|produccion|57dmc|bloque)\b/.test(t)) return "bloque";
  return sombrero === "trabajo" ? "bloque" : "compromiso";
}

/** Las series de Google que ya viven en la semana de Kairos (para no enseñarlas dos veces). */
export const seriesTraidas = (ritmo) => new Set((ritmo ?? []).map((e) => e.google).filter(Boolean));
