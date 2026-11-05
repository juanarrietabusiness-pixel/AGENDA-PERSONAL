// ============================================================
// El plan del día
//
// Se arma como lo piden los métodos más usados, en este orden:
//
//   1. Lo FIJO (el calendario de GTD): eventos, servicios, la célula, la
//      oración. No se mueve.
//   2. LAS 3 DE HOY (la «regla de tres» y las MIT): pocas cosas que, si se
//      hacen, el día valió. Las escoges tú; el agente sugiere.
//   3. Los HUECOS que deja lo fijo, y una PROPUESTA de bloques de tiempo
//      (time blocking) para meter ahí lo de hoy: lo de Trabajo dentro de la
//      jornada, lo demás fuera. Es una propuesta: no se aplica sola.
//   4. Si lo planeado no cabe en lo libre, se dice («sobrecarga») en vez de
//      dejar que el día se rompa en silencio.
//
// Lo que se planeó para un día anterior y no se hizo NO se pinta de rojo:
// va a «Por decidir», que se resuelve en el cierre del día. Rojo sólo es
// una fecha límite de verdad que se pasó.
// ============================================================

import { minutos, aHora, diaSemana } from "./fechas.js";
import { tocaEl } from "./recurrencia.js";
import { ordenar, esUrgente, urgencia } from "./prioridad.js";
import { esperasPorPreguntar } from "./metodo.js";

/** Huecos de menos de esto no se ofrecen para trabajar en algo. */
export const HUECO_MINIMO = 15;

/** Los eventos que tocan ese día (sueltos o por su regla), con su duración y en orden. */
export function eventosDelDia(eventos, dia) {
  return eventos
    .filter((e) => (e.fecha ? e.fecha === dia : e.repite?.regla ? tocaEl(e.repite.regla, e.repite.inicio, dia) : false))
    .map((e) => ({ ...e, minutos: Math.max(0, minutos(e.fin) - minutos(e.inicio)) }))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** Las acciones con hora puesta (un bloque o un recordatorio) son fijas ese día. */
const accionesConHora = (acciones, dia) =>
  acciones
    .filter((a) => a.estado === "abierta" && a.hora && (a.cuando === dia || a.limite === dia))
    .map((a) => ({
      id: a.id,
      titulo: a.titulo,
      sombrero: a.sombrero,
      inicio: a.hora,
      fin: aHora(minutos(a.hora) + (a.minutos || 30)),
      minutos: a.minutos || 30,
      accionId: a.id,
    }));

/** Lo libre entre `desde` y `hasta` que no tapa nada fijo. */
export function huecos(fijos, { desde, hasta, minimo = HUECO_MINIMO }) {
  const ocupados = fijos
    .map((f) => [minutos(f.inicio), minutos(f.fin)])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const libres = [];
  let cursor = minutos(desde);
  const fin = minutos(hasta);
  for (const [a, b] of ocupados) {
    if (a > cursor) libres.push([cursor, Math.min(a, fin)]);
    cursor = Math.max(cursor, b);
    if (cursor >= fin) break;
  }
  if (cursor < fin) libres.push([cursor, fin]);
  return libres
    .filter(([a, b]) => b - a >= minimo)
    .map(([a, b]) => ({ inicio: aHora(a), fin: aHora(b), minutos: b - a }));
}

/**
 * Las partes de un hueco en las que puede ir algo de ese sombrero, en orden: Trabajo, dentro de la jornada; lo demás,
 * fuera. Un día sin jornada (fin de semana) es todo de los demás sombreros.
 */
export function ventanasPara(sombrero, hueco, dia, ajustes) {
  const j = ajustes?.jornadas?.trabajo;
  const hayJornada = j && j.dias.includes(diaSemana(dia));
  const a = minutos(hueco.inicio);
  const b = minutos(hueco.fin);
  const valen = (vs) => vs.filter((v) => v.b - v.a >= HUECO_MINIMO);
  if (!hayJornada) return sombrero === "trabajo" ? [] : valen([{ a, b }]);
  const ja = minutos(j.desde);
  const jb = minutos(j.hasta);
  if (sombrero === "trabajo") return valen([{ a: Math.max(a, ja), b: Math.min(b, jb) }]);
  return valen([{ a, b: Math.min(b, ja) }, { a: Math.max(a, jb), b }]);
}

/** Lo que se planeó para hoy, se escogió para hoy o vence hoy o antes. */
export const deHoy = (acciones, hoy) =>
  acciones.filter(
    (a) => a.estado === "abierta" && a.lista === "siguientes" && (a.cuando === hoy || a.enfoque === hoy || (a.limite && a.limite <= hoy)),
  );

/** Lo planeado para un día que ya pasó y que nadie decidió: se resuelve en el cierre, no se acumula en rojo. */
export const porDecidir = (acciones, hoy) =>
  acciones.filter(
    (a) => a.estado === "abierta" && a.lista === "siguientes" && a.cuando && a.cuando < hoy && a.enfoque !== hoy && !(a.limite && a.limite <= hoy),
  );

/** Las 3 de hoy: las escogidas y, si faltan, una sugerencia (lo urgente e importante primero, luego lo importante). */
export function lasTres(acciones, hoy) {
  const abiertas = acciones.filter((a) => a.estado === "abierta" && a.lista === "siguientes");
  const escogidas = abiertas.filter((a) => a.enfoque === hoy).slice(0, 3);
  const ids = new Set(escogidas.map((a) => a.id));
  const candidatas = abiertas.filter(
    (a) => !ids.has(a.id) && (a.cuando === hoy || esUrgente(a, hoy) || (a.importante && (!a.cuando || a.cuando <= hoy))),
  );
  const sugeridas = ordenar(candidatas, hoy).slice(0, Math.max(0, 3 - escogidas.length));
  return { escogidas, sugeridas };
}

/**
 * Bloques de tiempo propuestos: cada acción de hoy (en orden de prioridad) en el primer hueco donde quepa y donde
 * le toca a su sombrero. Lo que no cabe se devuelve aparte: es la señal de que el día está sobrecargado.
 */
export function proponerBloques(acciones, libres, dia, ajustes) {
  const capacidad = libres.map((h) => ({ a: minutos(h.inicio), b: minutos(h.fin), ocupado: [] }));
  const bloques = [];
  const noCaben = [];
  for (const accion of acciones) {
    const dura = accion.minutos || 30;
    const sitio = buscarSitio(capacidad, accion.sombrero, dura, dia, ajustes);
    if (!sitio) {
      noCaben.push(accion);
      continue;
    }
    sitio.hueco.ocupado.push([sitio.inicio, sitio.inicio + dura]);
    bloques.push({
      accionId: accion.id,
      titulo: accion.titulo,
      sombrero: accion.sombrero,
      inicio: aHora(sitio.inicio),
      fin: aHora(sitio.inicio + dura),
      minutos: dura,
    });
  }
  return { bloques: bloques.sort((x, y) => x.inicio.localeCompare(y.inicio)), noCaben };
}

/** Lo que queda libre de un hueco después de lo ya propuesto. */
function libresDe(h) {
  const out = [];
  let c = h.a;
  for (const [x, y] of [...h.ocupado].sort((p, q) => p[0] - q[0])) {
    if (x > c) out.push([c, x]);
    c = Math.max(c, y);
  }
  if (c < h.b) out.push([c, h.b]);
  return out;
}

function buscarSitio(capacidad, sombrero, dura, dia, ajustes) {
  for (const hueco of capacidad) {
    for (const [x, y] of libresDe(hueco)) {
      const v = ventanasPara(sombrero, { inicio: aHora(x), fin: aHora(y) }, dia, ajustes).find((w) => w.b - w.a >= dura);
      if (v) return { hueco, inicio: v.a };
    }
  }
  return null;
}

/**
 * El plan completo de un día. Puro: lo usan la pantalla, el resumen de Telegram y el agente. Con `ahora` (HH:MM), lo
 * que ya pasó del día no se ofrece: a las siete de la noche no se propone nada para las nueve de la mañana.
 */
export function planDelDia({ dia, eventos = [], acciones = [], ajustes, ahora: horaActual = null }) {
  const conf = ajustes?.dias?.[diaSemana(dia)] ?? { despierta: "06:00", duerme: "22:00" };
  const fijosEventos = eventosDelDia(eventos, dia);
  const fijosAcciones = accionesConHora(acciones, dia);
  const fijos = [...fijosEventos, ...fijosAcciones].sort((a, b) => a.inicio.localeCompare(b.inicio));
  // Se planea desde el resumen de la mañana (después de la oración), no desde que suena el despertador.
  const resumen = ajustes?.avisos?.resumen?.[diaSemana(dia)] ?? conf.despierta;
  // Lo que queda del día empieza en el próximo múltiplo de cinco minutos.
  const yaPaso = horaActual ? aHora(Math.ceil(minutos(horaActual) / 5) * 5) : null;
  const desde = [conf.despierta, resumen, yaPaso].filter(Boolean).sort().pop();
  const libres = huecos(fijos, { desde, hasta: conf.duerme });
  const hoyLista = ordenar(deHoy(acciones, dia).filter((a) => !a.hora), dia);
  const { bloques, noCaben } = proponerBloques(hoyLista, libres, dia, ajustes);
  const minutosLibres = libres.reduce((s, h) => s + h.minutos, 0);
  const minutosPlaneados = hoyLista.reduce((s, a) => s + (a.minutos || 30), 0);
  return {
    dia,
    fijos,
    libres,
    tres: lasTres(acciones, dia),
    deHoy: hoyLista,
    porDecidir: ordenar(porDecidir(acciones, dia), dia),
    vencen: ordenar(acciones.filter((a) => urgencia(a, dia)), dia),
    esperas: esperasPorPreguntar(acciones, dia),
    propuesta: bloques,
    noCaben,
    minutosLibres,
    minutosPlaneados,
    sobrecarga: noCaben.length > 0,
  };
}

/** Qué está pasando a la `hora` dada y qué viene después (para «Ahora» y para el aviso de lo siguiente). */
export function ahora(plan, hora) {
  const m = minutos(hora);
  const todo = [...plan.fijos, ...plan.propuesta].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const actual = todo.find((x) => minutos(x.inicio) <= m && m < minutos(x.fin)) ?? null;
  const siguiente = todo.find((x) => minutos(x.inicio) > m) ?? null;
  return { actual, siguiente };
}
