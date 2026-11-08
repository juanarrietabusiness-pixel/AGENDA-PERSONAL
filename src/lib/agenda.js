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

import { sumarDias, lunesDe, partes, fecha, diasDelMes, diasEntre, MESES, textoCorto, textoHora, esHora, minutos, aHora } from "./fechas.js";
import { nuevaAccion, nuevoId, DURACIONES } from "./metodo.js";
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
export function especialesDelMes(acciones, eventos, dia, externos = [], ajustes = {}) {
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
  for (const x of deGoogleEnRango(externos, { desde, hasta })) {
    if (claseDeGoogle(x, ajustes) !== "especial" || yaEsPropio(eventos, x)) continue;
    out.push({ ...x, tipo: "google", fuente: "google" });
  }
  return out.sort((a, b) => a.dia.localeCompare(b.dia));
}

// ------------------------------------------------------------
// Lo que llega de Google Calendar: reunión, rutina o evento especial
// ------------------------------------------------------------

export const CLASES_GOOGLE = Object.freeze({ reunion: "Reunión o cita", rutina: "Parte de mi rutina", especial: "Evento especial" });

// Palabras que dicen «esto es con alguien» aunque se repita (la mentoría de los sábados es una reunión, no rutina).
const PALABRAS_REUNION = /\b(reuni|mentor|cita|llamad|junta|entrevista|visita|consulta|meet|zoom|almuerzo con|cena con|cafe con|discipulado)/;
const sinTildes = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** La clave con la que se recuerda lo que Juan decidió de un evento: la serie entera si se repite. */
export const claveDeGoogle = (x) => x.serie ?? x.id;

/**
 * Qué es un evento de Google: lo que Juan decidió para su serie, o si no, por lo que se ve:
 *   · de todo el día (feriados, cumpleaños) → especial;
 *   · con más gente, o que dice «reunión», «mentoría», «cita»… → reunión;
 *   · que se repite y es sólo tuyo (la oración, la lectura, el trabajo) → rutina;
 *   · lo demás (algo suelto con hora) → reunión.
 */
export function claseDeGoogle(x, ajustes = {}) {
  const fijada = ajustes?.clasesGoogle?.[claveDeGoogle(x)];
  if (CLASES_GOOGLE[fijada]) return fijada;
  if (x.todoElDia) return "especial";
  if (x.conGente || PALABRAS_REUNION.test(sinTildes(x.titulo))) return "reunion";
  if (x.serie) return "rutina";
  return "reunion";
}

const deGoogleEnRango = (externos, r) => (externos ?? []).filter((x) => x.tipo === "evento" && enRango(x.dia, r));
const yaEsPropio = (eventos, x) => eventos.some((p) => p.google?.id && (p.google.id === x.id || String(x.id).startsWith(`${p.google.id}_`)));

/** Tu rutina de Google Calendar en el periodo (lo que se repite y es sólo tuyo): para Plan, no para Hoy. */
export function rutinaDelPeriodo(externos, r, ajustes = {}, eventos = []) {
  return deGoogleEnRango(externos, r)
    .filter((x) => claseDeGoogle(x, ajustes) === "rutina" && !yaEsPropio(eventos, x))
    .map((x) => ({ ...x, clase: "rutina", fuente: "google" }))
    .sort((a, b) => (a.dia + (a.inicio ?? "00:00")).localeCompare(b.dia + (b.inicio ?? "00:00")));
}

/** Las reuniones y citas del periodo: los eventos propios que no son especiales, y las reuniones de Google Calendar. */
export function reunionesDelPeriodo(eventos, externos, r, ajustes = {}) {
  const propios = eventosDelPeriodo(eventos.filter((e) => e.clase !== "especial"), r);
  const deGoogle = deGoogleEnRango(externos, r)
    .filter((x) => claseDeGoogle(x, ajustes) === "reunion" && !yaEsPropio(eventos, x))
    .map((x) => ({ ...x, clase: "reunion", fuente: "google" }));
  return [...propios, ...deGoogle].sort((a, b) => (a.dia + (a.inicio ?? "00:00")).localeCompare(b.dia + (b.inicio ?? "00:00")));
}

// ------------------------------------------------------------
// Un evento sin hora o sin día no se vuelve una tarea
// ------------------------------------------------------------

/** De todo el día: 00:00–23:59 (un evento especial, o uno con día y la hora por definir). */
export const esTodoElDia = (e) => e?.inicio === "00:00" && e?.fin === "23:59";
/** Por agendar: una reunión o un evento que todavía no tiene día (ni se repite). */
export const porAgendar = (e) => Boolean(e) && !e.fecha && !e.repite?.regla;
/** Lo que está por agendar, para la columna de Reuniones. */
export const eventosPorAgendar = (eventos) => (eventos ?? []).filter(porAgendar);
/** «10:00 a. m.», «Hora por definir», «Todo el día» o «Por agendar». */
export function textoHoraEvento(e) {
  if (porAgendar(e)) return "Por agendar";
  if (e.horaPorDefinir) return "Hora por definir";
  if (esTodoElDia(e) || !e.inicio) return "Todo el día";
  return textoHora(e.inicio);
}

/**
 * Un evento como se guarda, sea cual sea lo que se tocó: sin hora (o con la de «todo el día») va de 00:00 a 23:59 y,
 * si no es especial, con la hora por definir; con hora, dura al menos hasta que termina (una hora si no se dijo); sin
 * día ni repetición, por agendar. Puro.
 */
export function normalizarEvento(e) {
  const x = { ...e };
  const conHora = esHora(x.inicio) && !(x.inicio === "00:00" && x.fin === "23:59");
  if (porAgendar(x)) {
    if (!conHora) Object.assign(x, { inicio: null, fin: null });
    x.horaPorDefinir = false;
    return x;
  }
  if (!conHora) return { ...x, inicio: "00:00", fin: "23:59", horaPorDefinir: x.clase !== "especial" };
  x.horaPorDefinir = false;
  if (!esHora(x.fin) || x.fin <= x.inicio) x.fin = aHora(Math.min(minutos(x.inicio) + 60, 23 * 60 + 59));
  return x;
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

// ------------------------------------------------------------
// Cambiar QUÉ ES algo, a mano: tarea, recordatorio, reunión, evento o evento especial
// ------------------------------------------------------------

export const QUE_ES = Object.freeze({ tarea: "Tarea", recordatorio: "Recordatorio", reunion: "Reunión o cita", evento: "Evento", especial: "Evento especial" });
export const esDeAccion = (clase) => clase === "tarea" || clase === "recordatorio";

/**
 * Convierte una acción en un evento o al revés, conservando lo que se puede (título, notas, sombrero, personas, el día,
 * la hora, lo que dura y si se repite). Puro. Devuelve { tipo: "accion" | "evento", obj } (con id nuevo si cambia de
 * tipo: el de antes se borra).
 */
export function convertir(obj, tipo, clase, hoy) {
  if (!QUE_ES[clase]) return { tipo, obj };
  if (tipo === "accion" && esDeAccion(clase)) return { tipo, obj: { ...obj, clase } };
  if (tipo === "evento" && !esDeAccion(clase)) {
    return { tipo, obj: normalizarEvento({ ...obj, clase }) };
  }
  const comunes = { titulo: obj.titulo, notas: obj.notas ?? "", sombrero: obj.sombrero ?? null, personas: Array.isArray(obj.personas) ? obj.personas : [] };
  if (tipo === "accion") {
    const dia = obj.cuando ?? obj.limite ?? hoy;
    const repite = obj.repite?.regla ? { regla: obj.repite.regla, inicio: obj.repite.inicio ?? dia } : null;
    // Sin hora no se inventa una: queda de todo el día (con la hora por definir si no es especial).
    const inicio = clase !== "especial" && esHora(obj.hora) ? obj.hora : null;
    const fin = inicio ? aHora(Math.min(minutos(inicio) + (Number(obj.minutos) || 60), 23 * 60 + 59)) : null;
    return { tipo: "evento", obj: normalizarEvento({ id: nuevoId("e"), ...comunes, clase, fecha: repite ? null : dia, repite, inicio, fin, protegido: false, fuente: "app" }) };
  }
  const dia = obj.fecha ?? obj.repite?.inicio ?? hoy;
  const dura = obj.inicio && obj.fin ? minutos(obj.fin) - minutos(obj.inicio) : 30;
  const minutosMasCerca = DURACIONES.reduce((a, b) => (Math.abs(b - dura) < Math.abs(a - dura) ? b : a), 30);
  return {
    tipo: "accion",
    obj: nuevaAccion(
      {
        ...comunes,
        clase,
        lista: "siguientes",
        cuando: obj.repite?.regla ? null : dia,
        hora: obj.inicio && obj.inicio !== "00:00" ? obj.inicio : null,
        minutos: minutosMasCerca,
        repite: obj.repite?.regla ? { regla: obj.repite.regla, modo: "calendario", inicio: obj.repite.inicio ?? dia } : null,
        origen: "app",
      },
      hoy,
    ),
  };
}

// ------------------------------------------------------------
// Tus 3 de hoy (y 2 de reserva)
// ------------------------------------------------------------

export const TRES = 3;
export const RESERVA = 2;

/**
 * El enfoque del día. Las que fijaste (★) van primero —también las que ya hiciste hoy, para que veas lo logrado—, y si
 * faltan, la agenda propone hasta completar 3: lo que vence o ya venció (fecha límite real), lo planeado para hoy o
 * antes, y lo de valor alto sin fecha; en orden de prioridad (valor, urgencia, el sombrero que va primero). Sólo tareas
 * (los recordatorios tienen su columna), sin lo delegable ni lo que dijiste «hoy no».
 * Devuelve { tres, reserva, todasHechas }: si terminas las 3, la reserva sigue proponiendo lo siguiente.
 */
export function enfoqueDelDia(acciones, { hoy, proyectos = [], sombreros = [] }) {
  const ctx = { hoy, proyectos, sombreros };
  const fijadas = acciones.filter((a) => a.enfoque === hoy && (a.estado === "abierta" || (a.estado === "hecha" && a.hechaEl === hoy)));
  const ids = new Set(fijadas.map((a) => a.id));
  const candidatas = acciones.filter(
    (a) =>
      a.estado === "abierta" &&
      a.lista === "siguientes" &&
      (a.clase ?? "tarea") === "tarea" &&
      !ids.has(a.id) &&
      a.noHoy !== hoy &&
      !a.delegable?.a &&
      ((a.cuando && a.cuando <= hoy) || (a.limite && a.limite <= sumarDias(hoy, 2)) || (!a.cuando && valorDe(a, ctx) === "alto")),
  );
  const ordenadas = ordenarPor(candidatas, "prioridad", ctx);
  const sugeridas = ordenadas.slice(0, Math.max(0, TRES - fijadas.length));
  const tres = [...fijadas, ...sugeridas];
  const todasHechas = tres.length > 0 && tres.every((a) => a.estado === "hecha");
  return { tres, reserva: ordenadas.slice(sugeridas.length, sugeridas.length + RESERVA), todasHechas };
}
