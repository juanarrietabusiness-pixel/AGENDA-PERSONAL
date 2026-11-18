// ============================================================
// Lo que pinta Hoy, calculado aparte (puro)
//
// Hoy pone en el CENTRO el bloque de ahora y tus 3; a la izquierda, la AGENDA
// del día en orden de hora (reuniones, eventos y recordatorios: no tu rutina),
// con lo especial arriba y una raya en «ahora», y luego lo que viene; a la
// derecha, las demás tareas del día agrupadas por el bloque en que caen.
// ============================================================

import { semanaDelDia, repartir } from "./semana.js";
import { reunionesDelPeriodo, rutinaDelPeriodo, especialesDelMes, accionesDelPeriodo } from "./agenda.js";

const deTodoElDia = (e) => !e.inicio || (e.inicio === "00:00" && e.fin === "23:59") || Boolean(e.horaPorDefinir);
const PESO = { bloque: 0, compromiso: 1, rutina: 1, reunion: 2, evento: 2, fijo: 3, recordatorio: 3 };

/**
 * La agenda de un día, SIN tu rutina (salvo con `conRutina`): { especiales, sinHora, linea, proximosEspeciales }.
 *   · especiales: lo especial de ese día (cumpleaños, fechas), arriba;
 *   · sinHora: reuniones con la hora por definir y recordatorios sin hora;
 *   · linea: lo que tiene hora, en orden: { clave, tipo, inicio, fin, titulo, obj, sombrero, color, fuente, pasado };
 *     `tipo` es bloque, compromiso, rutina (de Google), reunion, evento, fijo (recordatorio de tu semana) o recordatorio;
 *   · proximosEspeciales: lo especial que queda del mes.
 * `hora` (sólo si el día es hoy) marca lo que ya pasó.
 */
export function agendaDelDia({ dia, hoy, hora = null, ritmo = [], eventos = [], externos = [], acciones = [], ajustes = {}, conRutina = false }) {
  const r = { desde: dia, hasta: dia };
  const linea = [];
  const sinHora = [];
  const pon = (x) => linea.push(x);
  // Tu rutina (tus bloques, compromisos y recordatorios fijos, y lo que se repite y es sólo tuyo) no va en la agenda de
  // Hoy (decisión de Juan: «eso me lo sé de memoria»): está en el centro, en el «Después» y en Plan.
  if (conRutina) {
    const sd = semanaDelDia(ritmo, dia);
    for (const b of sd.bloques) pon({ clave: `b:${b.id}`, tipo: "bloque", inicio: b.inicio, fin: b.fin, titulo: b.titulo, obj: b, sombrero: b.sombrero, fuente: "kairos" });
    for (const c of sd.compromisos) pon({ clave: `c:${c.id}`, tipo: "compromiso", inicio: c.inicio, fin: c.fin, titulo: c.titulo, obj: c, sombrero: c.sombrero, fuente: "kairos" });
    for (const f of sd.recordatorios) pon({ clave: `f:${f.id}`, tipo: "fijo", inicio: f.inicio, fin: null, titulo: f.titulo, obj: f, sombrero: f.sombrero, fuente: "kairos" });
    for (const g of rutinaDelPeriodo(externos, r, ajustes, eventos)) pon({ clave: `g:${g.id}`, tipo: "rutina", inicio: g.inicio, fin: g.fin, titulo: g.titulo, obj: g, color: g.color, fuente: "google" });
  }
  for (const e of reunionesDelPeriodo(eventos, externos, r, ajustes)) {
    // Un evento tuyo que se repite cada semana (sin otras personas) también es rutina.
    if (!conRutina && e.fuente !== "google" && e.clase !== "reunion" && /FREQ=(WEEKLY|DAILY)/.test(e.repite?.regla ?? "")) continue;
    const x = { clave: `e:${e.fuente ?? "aqui"}:${e.id}`, tipo: e.clase === "reunion" || e.fuente === "google" ? "reunion" : "evento", inicio: e.inicio, fin: e.fin, titulo: e.titulo, obj: e, sombrero: e.sombrero, color: e.color, fuente: e.fuente ?? "kairos" };
    (deTodoElDia(e) ? sinHora : linea).push(x);
  }
  for (const a of accionesDelPeriodo(acciones, { ...r, hoy, clase: "recordatorio" }).abiertas) {
    const x = { clave: `a:${a.id}`, tipo: "recordatorio", inicio: a.hora ?? null, fin: null, titulo: a.titulo, obj: a, sombrero: a.sombrero, fuente: "kairos" };
    (a.hora ? linea : sinHora).push(x);
  }
  const ya = dia < hoy ? "99:99" : dia === hoy && hora ? hora : null;
  linea.sort((a, b) => a.inicio.localeCompare(b.inicio) || PESO[a.tipo] - PESO[b.tipo]);
  for (const x of linea) x.pasado = Boolean(ya && (x.fin ?? x.inicio) <= ya);
  const delMes = especialesDelMes(acciones, eventos, dia, externos, ajustes);
  return { especiales: delMes.filter((e) => e.dia === dia), sinHora, linea, proximosEspeciales: delMes.filter((e) => e.dia > dia) };
}

/** Dónde va la raya de «ahora» en la línea: el índice del primero que todavía no empezó (null si no es hoy). */
export function indiceAhora(linea, { dia, hoy, hora }) {
  if (dia !== hoy || !hora) return null;
  const i = linea.findIndex((x) => x.inicio > hora);
  return i < 0 ? linea.length : i;
}

/**
 * Las tareas de un día (ya ordenadas como se quieran) en grupos para leerlas como un plan: primero lo que quedó de días
 * anteriores (para decidir), luego cada bloque del día en su hora con lo que cae en él (`repartir`) y al final lo que no
 * va en ningún bloque. `fuera`: ids que no se pintan aquí (lo del bloque de ahora, que va en el centro).
 * Devuelve [{ clave, tipo: "decidir" | "bloque" | "suelta", bloque, tareas }], sin grupos vacíos.
 */
export function gruposDeTareas(tareas, ritmo, dia, { hoy, fuera = new Set(), ...opciones } = {}) {
  const resto = tareas.filter((a) => !fuera.has(a.id));
  const decidir = resto.filter((a) => a.cuando && a.cuando < hoy);
  const delDia = resto.filter((a) => !decidir.includes(a));
  const { bloques } = semanaDelDia(ritmo, dia);
  const { porBloque, fuera: sueltas } = repartir(delDia, bloques, { dia, ...opciones });
  // `repartir` reordena por lo preparado; dentro de cada grupo se respeta el orden en que llegaron.
  const enOrden = (lista) => delDia.filter((a) => lista.includes(a));
  return [
    { clave: "decidir", tipo: "decidir", bloque: null, tareas: decidir },
    ...bloques.map((b) => ({ clave: `b:${b.id}`, tipo: "bloque", bloque: b, tareas: enOrden(porBloque.get(b.id)) })),
    { clave: "sueltas", tipo: "suelta", bloque: null, tareas: enOrden(sueltas) },
  ].filter((g) => g.tareas.length);
}

/** Cuánto del bloque ya pasó (0–1) y cuántos minutos quedan, a esa hora. */
export function avanceDelBloque(bloque, hora) {
  const m = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const total = Math.max(1, m(bloque.fin) - m(bloque.inicio));
  const pasado = Math.min(total, Math.max(0, m(hora) - m(bloque.inicio)));
  return { parte: pasado / total, quedan: total - pasado };
}
