// ============================================================
// Proyectos con fecha: un evento que pide preparación
//
// «El 14 de febrero tengo el evento; necesito ensayos y preparar el
// repertorio»: el proyecto lleva la FECHA del evento (`limite`), el evento
// mismo y los ensayos son eventos ligados (`proyectoId`), y las tareas
// previas son sus pasos. Aquí se calcula lo que se enseña en Plan: cuánto
// falta, cuántos pasos llevas, cuál es el siguiente y los próximos ensayos.
// Todo puro.
// ============================================================

import { diasEntre, sumarDias } from "./fechas.js";
import { eventosDelPeriodo, ordenarPor } from "./agenda.js";

/** «Faltan 3 semanas», «Faltan 5 días», «Es hoy», «Fue hace 2 días». */
export function textoFalta(dias) {
  if (dias === 0) return "Es hoy";
  if (dias === 1) return "Es mañana";
  if (dias < 0) return `Fue hace ${-dias} día${dias === -1 ? "" : "s"}`;
  if (dias < 14) return `Faltan ${dias} días`;
  const semanas = Math.floor(dias / 7);
  return `Faltan ${semanas} semanas`;
}

/**
 * Los proyectos activos con fecha, del más cercano al más lejano: { proyecto, dias, pasos: { hechos, abiertos, total },
 * siguiente, pendientes (abiertas, en orden), ensayos (los eventos ligados que faltan), evento (el del día) }.
 */
export function proyectosConFecha({ proyectos = [], acciones = [], eventos = [], hoy, sombreros = [] }) {
  const ctx = { hoy, proyectos, sombreros };
  return proyectos
    .filter((p) => p.limite && p.estado !== "terminado")
    .sort((a, b) => a.limite.localeCompare(b.limite))
    .map((p) => {
      const suyas = acciones.filter((a) => a.proyectoId === p.id && a.estado !== "soltada");
      const abiertas = suyas.filter((a) => a.estado === "abierta");
      // El siguiente paso: lo que tiene día, por día; luego lo demás por prioridad.
      const conDia = abiertas.filter((a) => a.cuando || a.limite).sort((a, b) => (a.cuando ?? a.limite).localeCompare(b.cuando ?? b.limite));
      const sinDia = ordenarPor(abiertas.filter((a) => !a.cuando && !a.limite), "prioridad", ctx);
      const pendientes = [...conDia, ...sinDia];
      const ligados = eventos.filter((e) => e.proyectoId === p.id);
      const proximos = eventosDelPeriodo(ligados, { desde: hoy, hasta: p.limite });
      const evento = proximos.find((e) => e.dia === p.limite && !e.repite) ?? null;
      return {
        proyecto: p,
        dias: diasEntre(hoy, p.limite),
        pasos: { hechos: suyas.length - abiertas.length, abiertos: abiertas.length, total: suyas.length },
        siguiente: pendientes[0] ?? null,
        pendientes,
        ensayos: proximos.filter((e) => e !== evento),
        evento,
      };
    });
}

/** La regla de un ensayo que se repite, que termina el día antes del evento si no traía final. */
export function hastaElEvento(regla, limite) {
  if (!regla || !limite || /UNTIL=|COUNT=/.test(regla)) return regla;
  return `${regla};UNTIL=${sumarDias(limite, -1).replace(/-/g, "")}`;
}
