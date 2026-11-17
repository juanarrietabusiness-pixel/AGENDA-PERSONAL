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
import { minutos, aHora, diaSemana, sumarDias as sumarDiasLocal } from "./fechas.js";

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

// ------------------------------------------------------------
// Cada tarea en su bloque, sola
//
// Una tarea planeada para un día (y la que vence pronto sin día) cae SOLA en un bloque de ese día: el que se le
// asignó; si no, el que se llama como su empresa, una etiqueta o su proyecto («57DMC»); si no, uno de su sombrero
// (primero el que se llama como el sombrero). Si el bloque se llena, lo que no cabe va al siguiente posible del día.
// ------------------------------------------------------------

/** Días hacia delante en que una tarea sin día que vence pronto entra sola en un bloque. */
export const VENCE_PRONTO = 2;
const palabras = (t) => ` ${plano(t).replace(/[^a-z0-9ñ]+/g, " ").trim()} `;
const corta = (t) => t.trim().length < 3;
const minutosDe = (a) => Number(a.minutos) || 30;

/** ¿El bloque se llama como la empresa, una etiqueta o el proyecto de la tarea? («57DMC») */
export function nombraAlBloque(a, bloque, proyectos = []) {
  const b = palabras(bloque?.titulo);
  if (corta(b)) return false;
  const proyecto = a.proyectoId ? proyectos.find((p) => p.id === a.proyectoId)?.titulo : null;
  return [a.cliente, ...(a.etiquetas ?? []), proyecto].map(palabras).some((t) => !corta(t) && (b.includes(t) || t.includes(b)));
}

/** Los bloques de ese día donde puede ir una tarea, en orden de preferencia (vacío: ninguno). */
export function bloquesPosibles(a, bloques, { proyectos = [], sombreros = [] } = {}) {
  const asignado = a.bloque && bloques.find((b) => b.id === a.bloque);
  if (asignado) return [asignado];
  const nombrados = bloques.filter((b) => nombraAlBloque(a, b, proyectos));
  if (nombrados.length) return nombrados;
  if (!a.sombrero) return [];
  const delSombrero = bloques.filter((b) => b.sombrero === a.sombrero);
  const nombreS = palabras(sombreros.find((x) => x.id === a.sombrero)?.nombre ?? a.sombrero);
  return [...delSombrero.filter((b) => palabras(b.titulo) === nombreS), ...delSombrero.filter((b) => palabras(b.titulo) !== nombreS)];
}

/**
 * Los bloques de un día a los que se puede MOVER una tarea (al pasarla o al ponerla sola): si en la semana hay un bloque
 * que se llama como ella («57DMC»), sólo los que se llaman así; si no, los de `bloquesPosibles`.
 */
export function destinosPosibles(a, ritmo, bloques, opciones = {}) {
  const { proyectos = [] } = opciones;
  const tieneSuyo = (ritmo ?? []).some((e) => claseDeRitmo(e) === "bloque" && nombraAlBloque(a, e, proyectos));
  if (tieneSuyo && !(a.bloque && bloques.some((b) => b.id === a.bloque))) return bloques.filter((b) => nombraAlBloque(a, b, proyectos));
  return bloquesPosibles(a, bloques, opciones);
}

/** ¿Va en bloques? Sólo las tareas abiertas de «Siguientes» (no lo que espera a otros ni «Algún día»). */
const vaEnBloque = (a) => a.estado === "abierta" && (a.clase ?? "tarea") === "tarea" && a.lista === "siguientes";

/** El día en que una tarea SIN día que vence pronto entra sola: el primero desde hoy con un bloque para ella. */
export function diaAutomatico(a, ritmo, hoy, opciones = {}) {
  if (a.cuando || !a.limite || a.limite > sumarDiasLocal(hoy, VENCE_PRONTO)) return null;
  const hasta = a.limite < hoy ? hoy : a.limite;
  for (let d = hoy; d <= hasta; d = sumarDiasLocal(d, 1)) {
    if (destinosPosibles(a, ritmo, semanaDelDia(ritmo, d).bloques, opciones).length) return d;
  }
  return null;
}

/**
 * Las tareas que van en los bloques de un día: las planeadas para ese día, las escogidas para ese día sin plan y las
 * que vencen pronto sin día (en su `diaAutomatico`). Lo que se planeó para un día que ya pasó no: eso se pasa solo al
 * siguiente bloque por la noche (`rodarPendientes`) o va a «Por decidir».
 */
export function tareasDelDia(acciones, ritmo, dia, { hoy = dia, ...opciones } = {}) {
  return acciones.filter(
    (a) => vaEnBloque(a) && (a.cuando === dia || (!a.cuando && a.enfoque === dia) || (!a.cuando && a.enfoque !== dia && diaAutomatico(a, ritmo, hoy, opciones) === dia)),
  );
}

/** En qué orden se reparten: lo que preparaste para ese día (su orden), luego tus 3, luego como vengan. */
const ordenDelDia = (dia) => (a, b) => {
  const pa = a.planDia?.dia === dia ? a.planDia.n : Infinity;
  const pb = b.planDia?.dia === dia ? b.planDia.n : Infinity;
  if (pa !== pb) return pa - pb;
  return Number(b.enfoque === dia) - Number(a.enfoque === dia);
};

/**
 * Las tareas de un día repartidas en sus bloques sin pasar de lo que cabe en cada uno mientras haya otro posible.
 * Devuelve { porBloque: Map(id → tareas), fuera: tareas sin bloque }. Las asignadas a mano van primero.
 */
export function repartir(tareas, bloques, { dia = null, ...opciones } = {}) {
  const porBloque = new Map(bloques.map((b) => [b.id, []]));
  const usado = new Map(bloques.map((b) => [b.id, 0]));
  const fuera = [];
  const orden = [...tareas].sort((a, b) => Number(Boolean(b.bloque)) - Number(Boolean(a.bloque)) || (dia ? ordenDelDia(dia)(a, b) : 0));
  for (const a of orden) {
    const posibles = bloquesPosibles(a, bloques, opciones);
    if (!posibles.length) {
      fuera.push(a);
      continue;
    }
    const b = posibles.find((x) => usado.get(x.id) + minutosDe(a) <= duracion(x)) ?? posibles[0];
    porBloque.get(b.id).push(a);
    usado.set(b.id, usado.get(b.id) + minutosDe(a));
  }
  // Dentro de cada bloque, el orden que preparaste.
  if (dia) for (const lista of porBloque.values()) lista.sort(ordenDelDia(dia));
  return { porBloque, fuera };
}

/**
 * Las tareas de un bloque ese día (con `ritmo`, `hoy`, `proyectos` y `sombreros` para saber todo lo del día). `todos`
 * son los bloques de ese día; sin `ritmo`, se usan ellos.
 */
export function tareasDelBloque(acciones, bloque, dia, { todos = [], ritmo = null, hoy = dia, ...opciones } = {}) {
  const r = ritmo ?? (todos.length ? todos : [bloque]);
  const bloques = semanaDelDia(r, dia).bloques;
  const lista = bloques.some((b) => b.id === bloque.id) ? bloques : [...bloques, bloque];
  return repartir(tareasDelDia(acciones, r, dia, { hoy, ...opciones }), lista, { dia, ...opciones }).porBloque.get(bloque.id) ?? [];
}

// ------------------------------------------------------------
// Lo que no se hizo en su bloque pasa al siguiente
// ------------------------------------------------------------

/** Veces que una tarea se pasa sola al siguiente bloque; a la siguiente, va a «Por decidir». */
export const MAX_PASADAS = 3;
const BUSCAR_DIAS = 14;

/**
 * Por la noche (decisión de Juan: «no quiero que quede nada pendiente ni perderme»): lo planeado para un bloque que
 * terminó y no se hizo pasa al siguiente bloque que le toca (el mismo, uno que se llame igual o uno de su sombrero),
 * en el primer día que tenga sitio. La fecha LÍMITE no se toca: no se pasa más allá de ella. Lo que se repite sigue su
 * regla, y lo que ya se pasó `MAX_PASADAS` veces se queda para «Por decidir» (hacerlo, delegarlo o soltarlo).
 *
 * `hasta`: el último día que se mira (hoy, por la noche); `ahora`: la hora, para no pasar lo de un bloque que sigue.
 * Devuelve { movidas: [{ antes, despues, bloque, dia }], aDecidir: [tareas de `hasta` que ya no se pasan], sinSitio }.
 */
export function rodarPendientes(acciones, ritmo, { hasta, ahora = "23:59", ...opciones } = {}) {
  const movidas = [];
  const aDecidir = [];
  const sinSitio = [];
  const actual = new Map(acciones.map((a) => [a.id, a]));
  const usoDe = new Map(); // «día|bloque» → minutos ya puestos
  const uso = (d, bloques) => {
    if (!usoDe.has(d)) {
      const { porBloque } = repartir(tareasDelDia([...actual.values()], ritmo, d, { hoy: d, ...opciones }), bloques, { dia: d, ...opciones });
      for (const [id, ts] of porBloque) usoDe.set(`${d}|${id}`, ts.reduce((t, a) => t + minutosDe(a), 0));
      usoDe.set(d, true);
    }
    return (id) => usoDe.get(`${d}|${id}`) ?? 0;
  };
  const candidatas = acciones
    .filter((a) => vaEnBloque(a) && a.cuando && a.cuando <= hasta && !a.repite?.regla)
    .sort((a, b) => a.cuando.localeCompare(b.cuando) || ordenDelDia(a.cuando)(a, b));
  for (const a of candidatas) {
    const delDia = semanaDelDia(ritmo, a.cuando).bloques;
    const suyos = bloquesPosibles(a, delDia, opciones);
    if (!suyos.length) continue; // no estaba en un bloque: sigue la regla de siempre («Por decidir»)
    if (a.cuando === hasta && suyos.some((b) => b.fin > ahora)) continue; // su bloque no ha terminado
    if ((a.pasadas ?? 0) >= MAX_PASADAS) {
      if (a.cuando === hasta) aDecidir.push(a);
      continue;
    }
    let destino = null;
    for (let i = 1; i <= BUSCAR_DIAS && !destino; i++) {
      const d = sumarDiasLocal(hasta, i);
      if (a.limite && d > a.limite) break;
      const bloques = semanaDelDia(ritmo, d).bloques;
      const usado = uso(d, bloques);
      const b = destinosPosibles({ ...a, bloque: null }, ritmo, bloques, opciones).find((x) => usado(x.id) + minutosDe(a) <= duracion(x));
      if (b) destino = { d, b };
    }
    if (!destino) {
      sinSitio.push(a);
      continue;
    }
    const { d, b } = destino;
    const despues = { ...a, cuando: d, bloque: b.id, pasadas: (a.pasadas ?? 0) + 1, vieneDe: a.vieneDe ?? a.cuando, enfoque: null, planDia: null };
    actual.set(a.id, despues);
    usoDe.set(`${d}|${b.id}`, (usoDe.get(`${d}|${b.id}`) ?? 0) + minutosDe(a));
    movidas.push({ antes: a, despues, bloque: b, dia: d });
  }
  return { movidas, aDecidir, sinSitio };
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
 * (las tareas y los recordatorios con hora). Las tareas se reparten solas (`repartir`): el bloque asignado, el que se
 * llama como su empresa, etiqueta o proyecto, o uno de su sombrero, sin pasar de lo que cabe. Devuelve { bloques: [{ bloque, recordatorios, tareas }], recordatorios, tareas }.
 */
export function diaEnBloques(ritmo, dia, tareas = [], { tipo = false, soloAsignadas = false, ...opciones } = {}) {
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
  const lasTareas = tareas.filter((x) => (x.clase ?? "tarea") === "tarea");
  if (soloAsignadas) {
    // Sólo en el bloque que se le puso; las demás, arriba del día.
    for (const a of lasTareas) (a.bloque && dentro.has(a.bloque) ? dentro.get(a.bloque).tareas : sueltos.tareas).push(a);
  } else {
    // Cada una en su bloque, sola (`repartir`): las abiertas de «Siguientes»; lo demás, arriba del día.
    const { porBloque, fuera } = repartir(lasTareas.filter(vaEnBloque), bloques, { dia, ...opciones });
    for (const [id, ts] of porBloque) dentro.get(id).tareas.push(...ts);
    sueltos.tareas.push(...fuera, ...lasTareas.filter((a) => !vaEnBloque(a)));
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
