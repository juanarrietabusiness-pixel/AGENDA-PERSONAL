// ============================================================
// Cuándo avisar, y cuándo NO
//
// Un asistente que avisa de todo se termina silenciando. Por eso:
//
//   · El CÓDIGO decide cuándo se avisa; la IA sólo escribe el mensaje.
//   · Hay una ESCALERA según la importancia y la fecha límite real.
//   · Nada interrumpe lo PROTEGIDO (oración, Palabra, servicios, célula,
//     estudio): sale al terminar.
//   · Nada suelto sale antes del resumen de la mañana: va dentro de él.
//   · En las horas de SILENCIO nada sale: pasa al resumen del día siguiente.
//   · Los avisos cercanos se JUNTAN en un mensaje, y hay un TOPE diario.
//   · «¿La completaste?» se pregunta como mucho tres veces; luego la acción
//     queda «atascada» y se ve en la revisión semanal, sin más avisos.
// ============================================================

import { sumarDias, minutos, aHora, diaSemana, esHora } from "./fechas.js";
import { eventosDelDia } from "./hoy.js";

export const CLASES = Object.freeze({
  recordatorio: "A su hora",
  empezar: "Empezar con tiempo",
  "se-acerca": "Se acerca",
  "vence-hoy": "Vence hoy",
  "en-una-hora": "En una hora",
  espera: "Preguntar a quien esperas",
});

export const MAX_PREGUNTAS = 3;
const LISTAS_SIN_AVISO = ["bandeja", "algun-dia", "referencia"];

const resumenDe = (dia, ajustes) => ajustes.avisos.resumen[diaSemana(dia)] ?? "07:00";

/**
 * Los avisos que le tocan a una acción, según la escalera:
 *   · importante con fecha límite: 7 días antes si es un proyecto («¿empezaste?»), 2 días antes, el mismo día (en el
 *     resumen) y una hora antes si tiene hora;
 *   · sin importancia marcada: un día antes;
 *   · con hora (un recordatorio): a su hora;
 *   · en espera: el día de preguntar.
 * Sólo los de hoy en adelante.
 */
export function planDeAvisos(accion, { hoy, ajustes, esProyecto = false }) {
  if (!accion || accion.estado !== "abierta" || LISTAS_SIN_AVISO.includes(accion.lista)) return [];
  const out = [];
  const pon = (dia, hora, clase, extra = {}) => out.push({ id: `${accion.id}:${clase}:${dia}`, accionId: accion.id, dia, hora, clase, ...extra });

  if (accion.hora && accion.cuando && !accion.limite) pon(accion.cuando, accion.hora, "recordatorio");
  if (accion.limite) {
    const L = accion.limite;
    if (accion.importante) {
      if (esProyecto) pon(sumarDias(L, -7), resumenDe(sumarDias(L, -7), ajustes), "empezar");
      pon(sumarDias(L, -2), resumenDe(sumarDias(L, -2), ajustes), "se-acerca");
      pon(L, resumenDe(L, ajustes), "vence-hoy", { alResumen: true });
      if (accion.hora) pon(L, aHora(minutos(accion.hora) - 60), "en-una-hora");
    } else {
      pon(sumarDias(L, -1), resumenDe(sumarDias(L, -1), ajustes), "se-acerca");
      if (accion.hora) pon(L, accion.hora, "recordatorio");
    }
  }
  if (accion.lista === "espera" && accion.espera?.preguntar) {
    pon(accion.espera.preguntar, resumenDe(accion.espera.preguntar, ajustes), "espera");
  }
  return out.filter((a) => a.dia >= hoy);
}

/**
 * Dónde cae de verdad un aviso: fuera de lo protegido, después del resumen y antes del silencio.
 * Devuelve el aviso con su `hora` final, o con `alResumen: true` (y el `dia` en que sale) si va dentro de un resumen.
 */
export function ubicar(aviso, { ajustes, eventos = [] }) {
  if (aviso.alResumen) return { ...aviso, hora: resumenDe(aviso.dia, ajustes) };
  const resumen = resumenDe(aviso.dia, ajustes);
  if (!esHora(aviso.hora) || aviso.hora <= resumen) return { ...aviso, hora: resumen, alResumen: true };
  let m = minutos(aviso.hora);
  const protegidos = eventosDelDia(eventos, aviso.dia).filter((e) => e.protegido);
  // Si cae dentro de algo protegido, sale al terminar (y si justo empieza otro, al terminar ese).
  for (let vueltas = 0; vueltas < protegidos.length; vueltas++) {
    const dentro = protegidos.find((e) => minutos(e.inicio) <= m && m < minutos(e.fin));
    if (!dentro) break;
    m = minutos(dentro.fin);
  }
  const silencio = minutos(ajustes.avisos.silencio.desde);
  if (m >= silencio) {
    const manana = sumarDias(aviso.dia, 1);
    return { ...aviso, dia: manana, hora: resumenDe(manana, ajustes), alResumen: true, movido: true };
  }
  return { ...aviso, hora: aHora(m), movido: aHora(m) !== aviso.hora };
}

/**
 * Los avisos de un día ya ubicados, repartidos en: lo que va en el RESUMEN y los MENSAJES sueltos (cada uno puede
 * llevar varios avisos). Los cercanos se juntan; si hay más mensajes que el tope, se juntan los dos más cercanos hasta
 * que quepan (saliendo a la hora del primero: un aviso temprano molesta menos que uno tarde).
 */
export function avisosDelDia(avisos, { dia, ajustes, eventos = [] }) {
  const ubicados = avisos.map((a) => ubicar(a, { ajustes, eventos })).filter((a) => a.dia === dia);
  const resumen = ubicados.filter((a) => a.alResumen);
  const sueltos = ubicados.filter((a) => !a.alResumen).sort((a, b) => a.hora.localeCompare(b.hora));
  const mensajes = [];
  for (const a of sueltos) {
    const ultimo = mensajes[mensajes.length - 1];
    if (ultimo && minutos(a.hora) - minutos(ultimo.hora) <= ajustes.avisos.agrupar) ultimo.avisos.push(a);
    else mensajes.push({ hora: a.hora, avisos: [a] });
  }
  while (mensajes.length > Math.max(1, ajustes.avisos.tope)) {
    let mejor = 0;
    for (let i = 1; i < mensajes.length - 1; i++) {
      const d = minutos(mensajes[i + 1].hora) - minutos(mensajes[i].hora);
      if (d < minutos(mensajes[mejor + 1].hora) - minutos(mensajes[mejor].hora)) mejor = i;
    }
    const [x, y] = mensajes.splice(mejor, 2);
    mensajes.splice(mejor, 0, { hora: x.hora, avisos: [...x.avisos, ...y.avisos] });
  }
  return { resumen, mensajes };
}

/** La hora del cierre del día: al terminar lo protegido que lo tape; null si se cae al silencio (va al resumen de mañana). */
export function horaDelCierre(dia, { ajustes, eventos = [] }) {
  const u = ubicar({ id: "cierre", dia, hora: ajustes.avisos.cierre }, { ajustes, eventos });
  return u.dia === dia && !u.alResumen ? u.hora : null;
}

// ------------------------------------------------------------
// «¿La completaste?»
// ------------------------------------------------------------

/** Atascada: se preguntó tres veces sin respuesta. Ya no se pregunta; sale en la revisión semanal. */
export const atascada = (accion) => (accion.preguntas || 0) >= MAX_PREGUNTAS;

/**
 * Qué se pregunta hoy: lo que tenía fecha límite y se pasó, y lo planeado para un día anterior que nadie decidió. Una
 * vez al día por acción y como mucho tres veces en total.
 */
export function preguntasDeHoy(acciones, hoy) {
  return acciones
    .filter((a) => a.estado === "abierta" && a.lista === "siguientes" && !atascada(a) && a.ultimaPregunta !== hoy)
    .filter((a) => (a.limite && a.limite < hoy) || (a.cuando && a.cuando < hoy))
    .map((a) => ({ accionId: a.id, intento: (a.preguntas || 0) + 1, vencida: Boolean(a.limite && a.limite < hoy) }));
}

/** Se apunta que se preguntó (sin respuesta todavía). */
export const preguntada = (accion, hoy) => ({ ...accion, preguntas: (accion.preguntas || 0) + 1, ultimaPregunta: hoy });
