// ============================================================
// Importante y urgente (la matriz de Eisenhower)
//
// No los decide el mismo:
//   · IMPORTANTE lo propone el agente con tu visión delante y lo decides tú.
//   · URGENTE lo calcula el código con la fecha límite real. La IA nunca
//     decide que algo es urgente: si no hay fecha límite, no lo es.
// ============================================================

import { diasEntre } from "./fechas.js";

export const CUADRANTES = Object.freeze({
  1: { nombre: "Hazla tú, ya", detalle: "Importante y urgente" },
  2: { nombre: "Agéndala", detalle: "Importante, sin prisa: aquí se construye la visión" },
  3: { nombre: "Delégala", detalle: "Urgente, pero no necesita que seas tú" },
  4: { nombre: "Suéltala", detalle: "Ni importante ni urgente" },
});

/** «vencida», «hoy», «mañana», «pronto» (2–3 días) o null. Sólo con fecha límite. */
export function urgencia(accion, hoy) {
  if (!accion?.limite || accion.estado !== "abierta") return null;
  const d = diasEntre(hoy, accion.limite);
  if (d < 0) return "vencida";
  if (d === 0) return "hoy";
  if (d === 1) return "mañana";
  if (d <= 3) return "pronto";
  return null;
}

/** Urgente es vencida, o vence hoy o mañana. */
export const esUrgente = (accion, hoy) => ["vencida", "hoy", "mañana"].includes(urgencia(accion, hoy));

export function cuadrante(accion, hoy) {
  const u = esUrgente(accion, hoy);
  if (accion.importante) return u ? 1 : 2;
  return u ? 3 : 4;
}

/** ¿Pasó HOY a urgente? Es el aviso «esto pasó a urgente», que se manda una sola vez y sólo si es importante. */
export const pasoAUrgente = (accion, ayer, hoy) =>
  Boolean(accion.importante) && esUrgente(accion, hoy) && !esUrgente(accion, ayer);

/**
 * El orden en que conviene mirar las acciones: las escogidas para hoy, luego por cuadrante (1, 2, 3, 4),
 * luego por fecha límite y por lo que lleva más tiempo esperando.
 */
export function ordenar(acciones, hoy) {
  return [...acciones].sort((a, b) => {
    const ea = a.enfoque === hoy ? 0 : 1;
    const eb = b.enfoque === hoy ? 0 : 1;
    if (ea !== eb) return ea - eb;
    const ca = cuadrante(a, hoy);
    const cb = cuadrante(b, hoy);
    if (ca !== cb) return ca - cb;
    const la = a.limite ?? "9999-99-99";
    const lb = b.limite ?? "9999-99-99";
    if (la !== lb) return la < lb ? -1 : 1;
    return String(a.creada ?? "").localeCompare(String(b.creada ?? ""));
  });
}
