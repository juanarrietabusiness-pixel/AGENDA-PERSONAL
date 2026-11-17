// ============================================================
// Prepara tu día (o el de mañana)
//
// La rutina de Juan: la noche antes (o temprano) revisa lo que viene, lo pone
// en una lista y va una por una. Aquí eso es un paso: escoger TUS 3 (lo que, si
// se hace, el día valió) y ORDENAR lo demás. Hoy abre con eso: tus 3 arriba y
// las otras en ese orden. Lo que quedó de antes, lo que vence pronto y lo que
// no tiene día se SUMAN a mano: nada entra solo en el plan que preparas.
//
// Todo puro: la pantalla lo pinta y lo aplica con `cambiar`.
// ============================================================

import { sumarDias } from "./fechas.js";
import { enfoqueDelDia, ordenarPor, TRES } from "./agenda.js";
import { tareasDelDia, repartir, semanaDelDia, carga } from "./semana.js";

const esTarea = (a) => a.estado === "abierta" && (a.clase ?? "tarea") === "tarea" && a.lista === "siguientes";
const MAX_SIN_DIA = 12;

/**
 * Lo de partida para preparar un día: { tres: [ids], orden: [ids], sumar: { antes, vencen, sinDia } }.
 *   · tres: las escogidas para ese día o, si no hay, las que propone `enfoqueDelDia`;
 *   · orden: lo que ya va ese día (planeado, en un bloque o que vence pronto), en el orden que preparaste o por prioridad;
 *   · sumar: lo que quedó de días anteriores, lo que vence pronto y lo que no tiene día (lo más importante primero).
 */
export function inicioDePreparar(acciones, ritmo, dia, { hoy, proyectos = [], sombreros = [] } = {}) {
  const ctx = { hoy, proyectos, sombreros };
  const abiertas = acciones.filter(esTarea);
  const tres = enfoqueDelDia(acciones, { hoy: dia, proyectos, sombreros }).tres.filter((a) => a.estado === "abierta").slice(0, TRES).map((a) => a.id);
  const enTres = new Set(tres);
  const delDia = tareasDelDia(acciones, ritmo, dia, { hoy, proyectos, sombreros }).filter((a) => !enTres.has(a.id));
  const plan = (a) => (a.planDia?.dia === dia ? a.planDia.n : Infinity);
  const orden = [...ordenarPor(delDia, "prioridad", ctx)].sort((a, b) => plan(a) - plan(b)).map((a) => a.id);
  const ya = new Set([...tres, ...orden]);
  const fuera = abiertas.filter((a) => !ya.has(a.id));
  const antes = ordenarPor(fuera.filter((a) => a.cuando && a.cuando < dia && a.cuando < hoy), "prioridad", ctx);
  const vencen = ordenarPor(fuera.filter((a) => !antes.includes(a) && a.limite && a.limite <= sumarDias(dia, 2) && (!a.cuando || a.cuando <= dia)), "limite", ctx);
  const sinDia = ordenarPor(fuera.filter((a) => !a.cuando && !vencen.includes(a)), "prioridad", ctx).slice(0, MAX_SIN_DIA);
  return { tres, orden, sumar: { antes, vencen, sinDia } };
}

/**
 * Lo preparado, aplicado a las acciones (puro): tus 3 quedan escogidas para ese día y en su orden; lo de después,
 * planeado ese día en su orden (`planDia`); lo que se quitó del día vuelve a «sin día». Lo que venía de antes cuenta
 * como decidido (deja de pasarse solo).
 */
export function aplicarPreparacion(acciones, { dia, tres = [], orden = [], quitadas = [] }) {
  const pos = new Map([...tres.map((id, i) => [id, i - TRES]), ...orden.map((id, i) => [id, i])]);
  const enTres = new Set(tres);
  const fuera = new Set(quitadas);
  return acciones.map((a) => {
    if (pos.has(a.id)) {
      const decidida = a.cuando && a.cuando < dia ? { pasadas: 0, vieneDe: null } : {};
      return { ...a, ...decidida, cuando: dia, planDia: { dia, n: pos.get(a.id) }, enfoque: enTres.has(a.id) ? dia : a.enfoque === dia ? null : a.enfoque, noHoy: enTres.has(a.id) ? null : a.noHoy };
    }
    if (fuera.has(a.id)) return { ...a, cuando: a.cuando === dia ? null : a.cuando, bloque: a.cuando === dia ? null : a.bloque, planDia: null, enfoque: a.enfoque === dia ? null : a.enfoque };
    if (a.enfoque === dia || a.planDia?.dia === dia) return { ...a, enfoque: a.enfoque === dia ? null : a.enfoque, planDia: a.planDia?.dia === dia ? null : a.planDia };
    return a;
  });
}

/** Cómo quedan los bloques de ese día con lo preparado: [{ bloque, tareas, ocupado, cabe, sobra }] y lo que va fuera. */
export function bloquesPreparados(acciones, ritmo, dia, ids, opciones = {}) {
  const porId = new Map(acciones.map((a) => [a.id, a]));
  const tareas = ids.map((id) => porId.get(id)).filter(Boolean).map((a) => ({ ...a, cuando: dia }));
  const { bloques } = semanaDelDia(ritmo, dia);
  const { porBloque, fuera } = repartir(tareas, bloques, opciones);
  return { bloques: bloques.map((b) => ({ bloque: b, tareas: porBloque.get(b.id), ...carga(porBloque.get(b.id), b) })), fuera };
}
