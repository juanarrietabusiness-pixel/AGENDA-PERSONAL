// ============================================================
// La semana con horas: cada cosa del alto de lo que dura
//
// Para ver el día como es: los bloques (con sus tareas dentro), los
// compromisos y reuniones, lo que tiene hora y los HUECOS LIBRES, que es
// donde caben las tareas que no tienen bloque (lo personal, lo que se
// repite cada semana, los pendientes por agendar). Lo que se cruza se pone
// lado a lado (carriles). Todo puro: lo usan la rejilla de la computadora y la
// lista del teléfono.
// ============================================================

import { minutos, aHora, diaSemana } from "./fechas.js";
import { esTodoElDia } from "./agenda.js";

export const DIA_BASE = Object.freeze({ despierta: "06:00", duerme: "22:00" });
/** Un hueco más corto que esto no se ofrece. */
export const HUECO_MIN = 30;

const fin = (inicio, min) => aHora(Math.min(minutos(inicio) + min, 23 * 60 + 59));

/** Cuándo empieza y termina el día de esa fecha (lo que dice Ajustes → tus horarios). */
export const ventanaDelDia = (dia, ajustes) => ({ ...DIA_BASE, ...(ajustes?.dias?.[diaSemana(dia)] ?? {}) });

/**
 * Un día (lo de `diaEnBloques` más sus eventos) como piezas: `conHora` (con inicio y fin, para la rejilla) y `delDia`
 * (lo de todo el día, lo de hora por definir y las tareas sin hora). Cada pieza: { tipo: "bloque" | "evento" | "tarea" |
 * "recordatorio", clave, titulo, inicio, fin, sombrero, color?, obj, … }.
 */
export function piezasDelDia({ bloques = [], recordatorios = [], tareas = [], eventos = [] }) {
  const conHora = [];
  const delDia = [];
  for (const b of bloques) {
    conHora.push({ tipo: "bloque", clave: `b:${b.bloque.id}`, titulo: String(b.bloque.titulo).trim(), inicio: b.bloque.inicio, fin: b.bloque.fin, sombrero: b.bloque.sombrero, obj: b.bloque, tareas: b.tareas, recordatorios: b.recordatorios });
  }
  for (const r of recordatorios) {
    const p = { tipo: "recordatorio", clave: `r:${r.id}`, titulo: r.titulo, sombrero: r.sombrero, obj: r };
    if (r.inicio && r.inicio !== "99") conHora.push({ ...p, inicio: r.inicio, fin: fin(r.inicio, 15) });
    else delDia.push(p);
  }
  for (const a of tareas) {
    const p = { tipo: "tarea", clave: `t:${a.id}`, titulo: a.titulo, sombrero: a.sombrero, obj: a };
    if (a.hora) conHora.push({ ...p, inicio: a.hora, fin: fin(a.hora, Number(a.minutos) || 30) });
    else delDia.push(p);
  }
  for (const e of eventos) {
    const p = { tipo: "evento", clave: `e:${e.fuente ?? "agenda"}:${e.id}`, titulo: e.titulo, sombrero: e.sombrero, color: e.color, obj: e };
    if (e.inicio && !e.todoElDia && !esTodoElDia(e)) conHora.push({ ...p, inicio: e.inicio, fin: e.fin && e.fin > e.inicio ? e.fin : fin(e.inicio, 30) });
    else delDia.push(p);
  }
  conHora.sort((a, b) => a.inicio.localeCompare(b.inicio) || b.fin.localeCompare(a.fin));
  return { conHora, delDia };
}

/**
 * Lo que se cruza va lado a lado: a cada pieza, su carril y en cuántos carriles se parte su grupo. Devuelve un Map
 * clave → { carril, de }.
 */
export function carriles(piezas) {
  const out = new Map();
  let grupo = [];
  let finGrupo = "";
  const cerrar = () => {
    const de = Math.max(...grupo.map((g) => g.carril)) + 1;
    for (const g of grupo) out.set(g.p.clave, { carril: g.carril, de });
    grupo = [];
    finGrupo = "";
  };
  const orden = [...piezas].sort((a, b) => a.inicio.localeCompare(b.inicio) || b.fin.localeCompare(a.fin));
  for (const p of orden) {
    if (grupo.length && p.inicio >= finGrupo) cerrar();
    const ocupados = grupo.filter((g) => g.p.fin > p.inicio).map((g) => g.carril);
    let c = 0;
    while (ocupados.includes(c)) c++;
    grupo.push({ p, carril: c });
    if (p.fin > finGrupo) finGrupo = p.fin;
  }
  if (grupo.length) cerrar();
  return out;
}

/**
 * Los huecos libres de un día entre `desde` y `hasta` (su despertar y su dormir): lo que no ocupa un bloque, un evento
 * o una tarea con hora (los recordatorios no ocupan). Con `ahora`, lo que ya pasó no se ofrece. [{ inicio, fin, minutos }]
 */
export function huecos(piezas, { desde = DIA_BASE.despierta, hasta = DIA_BASE.duerme, ahora = null, min = HUECO_MIN } = {}) {
  const ocupa = piezas.filter((p) => p.tipo !== "recordatorio");
  const a = Math.max(minutos(desde), ahora ? Math.ceil(minutos(ahora) / 15) * 15 : 0);
  const b = minutos(hasta);
  const tramos = ocupa
    .map((p) => [Math.max(minutos(p.inicio), a), Math.min(minutos(p.fin), b)])
    .filter(([x, y]) => y > x)
    .sort((x, y) => x[0] - y[0]);
  const out = [];
  let cursor = a;
  for (const [x, y] of tramos) {
    if (x - cursor >= min) out.push({ inicio: aHora(cursor), fin: aHora(x), minutos: x - cursor });
    cursor = Math.max(cursor, y);
  }
  if (b - cursor >= min) out.push({ inicio: aHora(cursor), fin: aHora(b), minutos: b - cursor });
  return out;
}

/** Las horas que enseña la rejilla de la semana: del despertar más temprano a lo último que termina (horas enteras). */
export function rangoDeLaRejilla(dias, ajustes) {
  let a = 24 * 60;
  let b = 0;
  for (const { dia, conHora } of dias) {
    const v = ventanaDelDia(dia, ajustes);
    a = Math.min(a, minutos(v.despierta), ...conHora.map((p) => minutos(p.inicio)));
    b = Math.max(b, minutos(v.duerme), ...conHora.map((p) => minutos(p.fin)));
  }
  const desde = Math.max(0, Math.floor(a / 60));
  const hasta = Math.min(24, Math.max(desde + 1, Math.ceil(b / 60)));
  return { desde, hasta };
}
