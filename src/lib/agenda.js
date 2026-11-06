// ============================================================
// La agenda: el día, la semana o el mes, por columnas
//
// Lo que Juan pidió para «Hoy»: no saturar con la rutina fija de cada día
// (oración, servicios… ya los sabe), y ver en cambio las TAREAS por
// prioridad, las REUNIONES, los RECORDATORIOS y los EVENTOS ESPECIALES del
// mes, de todos los sombreros, en el día, la semana o el mes que escoja, y
// ordenados por prioridad, urgencia o fecha límite.
//
// Y el mentor: el VALOR de cada tarea (alto, medio, bajo) lo propone el
// asistente con la vida de Juan delante; si no lo puso, lo deduce el código
// de lo que Juan decidió (importante, la prioridad del sombrero y la del
// proyecto). Nada se delega ni se suelta solo: se sugiere.
// ============================================================

import { sumarDias, lunesDe, partes, fecha, diasDelMes, diasEntre, MESES, textoCorto } from "./fechas.js";
import { ocurrencias, tocaEl } from "./recurrencia.js";
import { urgencia } from "./prioridad.js";
import { prioridadDe } from "./sombreros.js";

export const PERIODOS = Object.freeze({ dia: "Día", semana: "Semana", mes: "Mes" });
export const ORDENES = Object.freeze({ prioridad: "Prioridad", urgencia: "Urgencia", limite: "Fecha límite" });
export const CLASES_EVENTO = Object.freeze({ reunion: "Reunión", evento: "Evento", especial: "Evento especial" });

/** El rango de fechas de un periodo que contiene `dia`. */
export function rango(periodo, dia) {
  if (periodo === "semana") {
    const desde = lunesDe(dia);
    return { desde, hasta: sumarDias(desde, 6) };
  }
  if (periodo === "mes") {
    const { anio, mes } = partes(dia);
    return { desde: fecha(anio, mes, 1), hasta: fecha(anio, mes, diasDelMes(anio, mes)) };
  }
  return { desde: dia, hasta: dia };
}

/** Moverse al periodo anterior o siguiente. */
export function mover(periodo, dia, n) {
  if (periodo === "semana") return sumarDias(dia, 7 * n);
  if (periodo === "mes") {
    const { anio, mes } = partes(dia);
    const total = anio * 12 + (mes - 1) + n;
    return fecha(Math.floor(total / 12), (total % 12) + 1, 1);
  }
  return sumarDias(dia, n);
}

/** El nombre del periodo: «hoy», «semana del 2 al 8», «noviembre 2026». */
export function tituloDe(periodo, dia, hoy) {
  const { desde, hasta } = rango(periodo, dia);
  if (periodo === "mes") return `${MESES[partes(dia).mes - 1]} ${partes(dia).anio}`;
  if (periodo === "semana") return `Semana del ${partes(desde).dia} al ${partes(hasta).dia}${partes(desde).mes !== partes(hasta).mes ? ` de ${MESES[partes(hasta).mes - 1]}` : ""}`;
  return textoCorto(dia, hoy);
}

const enRango = (f, { desde, hasta }) => Boolean(f) && f >= desde && f <= hasta;

// ------------------------------------------------------------
// El valor y la prioridad
// ------------------------------------------------------------

const PESO_VALOR = { alto: 3, medio: 2, bajo: 1 };
const PESO_PRIORIDAD_PROYECTO = { alta: 2, media: 1, baja: 0 };

/** El valor de una acción: el que propuso el asistente (o Juan), o el que sale de lo que Juan decidió. */
export function valorDe(accion, { proyectos = [], sombreros } = {}) {
  if (PESO_VALOR[accion.valor]) return accion.valor;
  const p = proyectos.find((x) => x.id === accion.proyectoId);
  if (accion.importante || p?.prioridad === "alta") return "alto";
  if (p?.prioridad === "baja" || accion.lista === "algun-dia") return "bajo";
  if (sombreros && prioridadDe(accion.sombrero, sombreros) === 1) return "alto";
  return "medio";
}

/**
 * Un número para ordenar por PRIORIDAD (más alto primero): el valor, lo importante, la urgencia real (la fecha
 * límite), la prioridad del sombrero y la del proyecto.
 */
export function puntaje(accion, { proyectos = [], sombreros = [], hoy }) {
  const v = PESO_VALOR[valorDe(accion, { proyectos, sombreros })] * 10;
  const u = { vencida: 9, hoy: 8, mañana: 6, pronto: 4 }[urgencia(accion, hoy)] ?? 0;
  const imp = accion.importante ? 6 : 0;
  const s = Math.max(0, (sombreros.length || 4) - prioridadDe(accion.sombrero, sombreros) + 1);
  const p = PESO_PRIORIDAD_PROYECTO[proyectos.find((x) => x.id === accion.proyectoId)?.prioridad] ?? 1;
  return v + u + imp + s + p;
}

/** Ordena según el criterio escogido. Puro. */
export function ordenarPor(lista, criterio, ctx) {
  const limite = (a) => a.limite ?? a.cuando ?? "9999-12-31";
  const real = (a) => a.limite ?? "9999-12-31";
  const cuando = (a) => a.cuando ?? "9999-12-31";
  const hora = (a) => a.hora ?? "99:99";
  const copia = [...lista];
  // Por fecha límite: primero lo que tiene una fecha límite REAL (la más cercana arriba); después, por el día planeado.
  if (criterio === "limite") return copia.sort((a, b) => real(a).localeCompare(real(b)) || cuando(a).localeCompare(cuando(b)) || hora(a).localeCompare(hora(b)));
  if (criterio === "urgencia") {
    const u = (a) => ({ vencida: 0, hoy: 1, mañana: 2, pronto: 3 }[urgencia(a, ctx.hoy)] ?? 4);
    return copia.sort((a, b) => u(a) - u(b) || limite(a).localeCompare(limite(b)) || puntaje(b, ctx) - puntaje(a, ctx));
  }
  return copia.sort((a, b) => puntaje(b, ctx) - puntaje(a, ctx) || limite(a).localeCompare(limite(b)));
}

// ------------------------------------------------------------
// Las columnas
// ------------------------------------------------------------

/**
 * Las acciones (tareas o recordatorios) de un periodo: las que caen dentro (por «cuándo» o por fecha límite), lo
 * hecho dentro, y —si el periodo incluye hoy— lo que se pasó sin hacerse. Las de «Algún día» y «Referencia», no.
 */
export function accionesDelPeriodo(acciones, { desde, hasta, hoy, clase = "tarea" }) {
  const r = { desde, hasta };
  const incluyeHoy = hoy >= desde && hoy <= hasta;
  const deLaClase = acciones.filter((a) => (a.clase ?? "tarea") === clase && !["algun-dia", "referencia", "bandeja"].includes(a.lista));
  const abiertas = deLaClase.filter((a) => a.estado === "abierta" && (enRango(a.cuando, r) || enRango(a.limite, r) || (incluyeHoy && ((a.cuando && a.cuando < hoy) || (a.limite && a.limite < hoy)))));
  const hechas = deLaClase.filter((a) => a.estado === "hecha" && enRango(a.hechaEl, r));
  return { abiertas, hechas };
}

/** Lo abierto sin fecha: lo que se puede hacer cuando haya un hueco. */
export const sinFecha = (acciones) =>
  acciones.filter((a) => a.estado === "abierta" && (a.clase ?? "tarea") === "tarea" && a.lista === "siguientes" && !a.cuando && !a.limite);

const claseDe = (e) => (CLASES_EVENTO[e.clase] ? e.clase : /reuni[oó]n|cita|llamada|junta/i.test(e.titulo ?? "") ? "reunion" : "evento");

/**
 * Los eventos de un periodo, cada vez que tocan (los que se repiten salen en cada día), SIN la rutina fija (el
 * ritmo no se pasa aquí). Devuelve [{ ...evento, dia, clase }] en orden.
 */
export function eventosDelPeriodo(eventos, { desde, hasta }) {
  const out = [];
  for (const e of eventos) {
    if (e.fecha) {
      if (e.fecha >= desde && e.fecha <= hasta) out.push({ ...e, dia: e.fecha, clase: claseDe(e) });
    } else if (e.repite?.regla) {
      try {
        for (const dia of ocurrencias(e.repite.regla, e.repite.inicio, desde, hasta, { max: 62 })) out.push({ ...e, dia, clase: claseDe(e), clave: `${e.id}:${dia}` });
      } catch {
        /* una regla dañada no tumba la pantalla */
      }
    }
  }
  return out.sort((a, b) => (a.dia + (a.inicio ?? "")).localeCompare(b.dia + (b.inicio ?? "")));
}

/**
 * Los eventos especiales del mes: cumpleaños y aniversarios (acciones que se repiten cada año), los eventos
 * marcados «especial» y lo de todo el día de Google Calendar. Siempre del MES, aunque se mire un día: es lo que Juan quiere tener presente.
 */
export function especialesDelMes(acciones, eventos, dia, externos = []) {
  const { desde, hasta } = rango("mes", dia);
  const out = [];
  for (const a of acciones) {
    if (a.estado === "soltada" || !/FREQ=YEARLY/.test(a.repite?.regla ?? "")) continue;
    try {
      for (const d of ocurrencias(a.repite.regla, a.repite.inicio ?? a.limite ?? desde, desde, hasta, { max: 2 })) {
        out.push({ id: a.id, titulo: a.titulo, sombrero: a.sombrero, dia: d, tipo: "accion", notas: a.notas });
      }
    } catch {
      if (enRango(a.limite, { desde, hasta })) out.push({ id: a.id, titulo: a.titulo, sombrero: a.sombrero, dia: a.limite, tipo: "accion" });
    }
  }
  for (const e of eventosDelPeriodo(eventos.filter((x) => x.clase === "especial"), { desde, hasta })) out.push({ ...e, tipo: "evento" });
  // Lo de todo el día de Google Calendar (feriados, cumpleaños, un viaje) también es «especial», no una reunión.
  for (const x of externos ?? []) {
    if (x.tipo !== "evento" || !x.todoElDia || !enRango(x.dia, { desde, hasta })) continue;
    if (eventos.some((p) => p.google?.id && (p.google.id === x.id || String(x.id).startsWith(`${p.google.id}_`)))) continue;
    out.push({ ...x, tipo: "google", fuente: "google" });
  }
  return out.sort((a, b) => a.dia.localeCompare(b.dia));
}

/** Las reuniones y citas del periodo: los eventos que no son especiales, y los de Google Calendar con hora. */
export function reunionesDelPeriodo(eventos, externos, r) {
  const propios = eventosDelPeriodo(eventos.filter((e) => e.clase !== "especial"), r);
  const deGoogle = (externos ?? [])
    .filter((x) => x.tipo === "evento" && !x.todoElDia && enRango(x.dia, r) && !propios.some((p) => p.google?.id && (p.google.id === x.id || String(x.id).startsWith(`${p.google.id}_`))))
    .map((x) => ({ ...x, clase: "reunion", fuente: "google" }));
  return [...propios, ...deGoogle].sort((a, b) => (a.dia + (a.inicio ?? "00:00")).localeCompare(b.dia + (b.inicio ?? "00:00")));
}

/** ¿Toca este evento ese día? (para la vista de un día) */
export const tocaElDia = (e, dia) => (e.fecha ? e.fecha === dia : e.repite?.regla ? tocaEl(e.repite.regla, e.repite.inicio, dia) : false);

// ------------------------------------------------------------
// El mentor
// ------------------------------------------------------------

/** Lo que más vale ahora: abiertas de valor alto, por prioridad (sin lo que se puede delegar: eso va aparte). */
export function loQueMasVale(acciones, ctx, n = 7) {
  return ordenarPor(acciones.filter((a) => a.estado === "abierta" && a.lista === "siguientes" && !a.delegable?.a && valorDe(a, ctx) === "alto"), "prioridad", ctx).slice(0, n);
}

/** Lo que otra persona puede hacer (el asistente lo propuso o Juan lo marcó). */
export const porDelegar = (acciones) => acciones.filter((a) => a.estado === "abierta" && a.lista === "siguientes" && a.delegable?.a);

/** Lo de valor bajo que sigue abierto: ¿vale la pena? */
export function bajoValor(acciones, ctx) {
  return acciones.filter((a) => a.estado === "abierta" && a.lista === "siguientes" && valorDe(a, ctx) === "bajo");
}

/**
 * Cómo se reparte lo abierto entre los sombreros frente a su prioridad: si el que va primero tiene casi nada y el
 * último lo tiene casi todo, el mentor lo dice.
 */
export function repartoAbierto(acciones, sombreros) {
  const abiertas = acciones.filter((a) => a.estado === "abierta" && a.lista === "siguientes");
  const total = abiertas.length || 1;
  return sombreros.map((s, i) => {
    const n = abiertas.filter((a) => a.sombrero === s.id).length;
    const altos = abiertas.filter((a) => a.sombrero === s.id && (a.valor === "alto" || a.importante)).length;
    return { id: s.id, nombre: s.nombre, prioridad: i + 1, abiertas: n, altos, porcentaje: Math.round((n / total) * 100) };
  });
}

/** Días que lleva sin moverse algo (desde que se creó o se pospuso), para «¿sigue valiendo la pena?». */
export const diasParada = (a, hoy) => (a.creada ? Math.max(0, diasEntre(a.creada, hoy)) : 0);
