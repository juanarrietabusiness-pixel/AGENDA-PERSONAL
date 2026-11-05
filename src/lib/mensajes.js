// ============================================================
// Los mensajes del día, escritos por el código
//
// El resumen de la mañana, el cierre, los avisos y «¿la completaste?» no
// necesitan IA: se arman con el plan del día. Así no cuestan nada, salen
// siempre (aunque la IA falle) y no inventan. Para que no se vuelvan
// pesados, cada mensaje tiene VARIAS formas de decirse y se escoge una
// distinta según el día; y son cortos.
// ============================================================

import { textoLargo, textoHora, textoFecha } from "./fechas.js";
import { sombrero } from "./sombreros.js";
import { versiculo as porId } from "./versiculos.js";

function hash(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Una de las variantes, la misma para la misma semilla (el mismo día y el mismo mensaje). */
export const variante = (opciones, semilla) => opciones[hash(String(semilla)) % opciones.length];

const SALUDOS = [
  (n) => `Buenos días, ${n}.`,
  (n) => `¡Buen día, ${n}!`,
  (n) => `${n}, arrancamos.`,
  (n) => `Buenos días, ${n}. Un día nuevo.`,
];

const linea = (a) => `• ${a.titulo}${a.sombrero ? ` (${sombrero(a.sombrero)?.nombre ?? a.sombrero})` : ""}`;

/** El bloque de un versículo: el texto exacto del banco, nunca uno escrito por la IA. */
export function bloqueVersiculo(id) {
  const v = porId(id);
  return v ? `«${v.texto}»\n— ${v.ref}` : "";
}

/** El resumen de la mañana. Sale después de la oración. */
export function resumenDeLaManana({ nombre, plan, versiculo = null }) {
  const partes = [variante(SALUDOS, `${plan.dia}|saludo`)(nombre)];
  if (versiculo) partes.push(bloqueVersiculo(versiculo.id ?? versiculo));
  const tres = [...plan.tres.escogidas, ...plan.tres.sugeridas].slice(0, 3);
  if (tres.length) {
    const titulo = plan.tres.escogidas.length ? "Tus 3 de hoy:" : "Si sólo hicieras tres cosas hoy, te propongo:";
    partes.push([titulo, ...tres.map(linea)].join("\n"));
  }
  const fijos = plan.fijos.filter((f) => !f.devocional);
  if (fijos.length) partes.push(["Agenda:", ...fijos.map((f) => `• ${textoHora(f.inicio)} ${f.titulo}`)].join("\n"));
  // Lo que ya va en las 3 no se repite.
  const urgentes = plan.vencen.filter((a) => a.limite <= plan.dia && !tres.some((t) => t.id === a.id));
  if (urgentes.length) partes.push(["Vence hoy o ya se pasó:", ...urgentes.map(linea)].join("\n"));
  const n = plan.porDecidir.length;
  if (n) partes.push(n === 1 ? "Quedó una de días anteriores: la vemos en el cierre." : `Quedaron ${n} de días anteriores: las vemos en el cierre.`);
  if (plan.sobrecarga) partes.push(`Hoy hay más planeado (${horas(plan.minutosPlaneados)}) que tiempo libre (${horas(plan.minutosLibres)}). ¿Movemos algo?`);
  return partes.join("\n\n");
}

const horas = (min) => (min < 60 ? `${min} min` : `${Math.round((min / 60) * 10) / 10} h`.replace(".", ","));

const CIERRES = [
  (h, t) => `Hoy cerraste ${h} de ${t}.`,
  (h, t) => `${h} de ${t} terminadas hoy.`,
  (h, t) => `Balance del día: ${h} de ${t}.`,
];

export const MAX_EN_CIERRE = 5;

/** El cierre del día: lo hecho, y una decisión por cada cosa que quedó. */
export function cierreDelDia({ dia, hechas = [], pendientes = [], versiculo = null }) {
  const total = hechas.length + pendientes.length;
  const partes = [];
  if (total) partes.push(variante(CIERRES, `${dia}|cierre`)(hechas.length, total));
  if (!pendientes.length && hechas.length) partes.push("No quedó nada pendiente. Descansa bien.");
  // Una lista larga de noche cansa: las cinco primeras, y el resto se cuenta.
  if (pendientes.length) {
    const resto = pendientes.length - MAX_EN_CIERRE;
    partes.push(["¿Qué hacemos con lo que quedó?", ...pendientes.slice(0, MAX_EN_CIERRE).map(linea), ...(resto > 0 ? [`… y ${resto} más`] : [])].join("\n"));
  }
  if (versiculo) partes.push(bloqueVersiculo(versiculo.id ?? versiculo));
  return partes.join("\n\n");
}

/** Los botones de una acción que quedó o se pasó. */
export const BOTONES_DECIDIR = Object.freeze([
  { id: "hecha", texto: "Hecho" },
  { id: "manana", texto: "Mañana" },
  { id: "otro-dia", texto: "Otro día" },
  { id: "delegar", texto: "Delegar" },
  { id: "soltar", texto: "Ya no aplica" },
]);

const PRIMERA = [
  (a) => `¿Pudiste con «${a.titulo}»?`,
  (a) => `«${a.titulo}»: ¿quedó hecha?`,
  (a) => `Una pregunta rápida: ¿terminaste «${a.titulo}»?`,
];
const SEGUNDA = [
  (a) => `Te pregunto otra vez por «${a.titulo}». ¿La hacemos o la movemos?`,
  (a) => `«${a.titulo}» sigue abierta. ¿Qué hacemos con ella?`,
];

/** «¿La completaste?», con un tono distinto en cada intento; el tercero avisa de que ya no se pregunta más. */
export function preguntaCompletaste(accion, intento, dia) {
  const base =
    intento <= 1
      ? variante(PRIMERA, `${dia}|${accion.id}`)(accion)
      : intento === 2
        ? variante(SEGUNDA, `${dia}|${accion.id}`)(accion)
        : `Última vez que te pregunto por «${accion.titulo}». Si no me dices nada, la dejo en la revisión del sábado.`;
  const vence = accion.limite && accion.limite < dia ? ` Vencía ${textoFecha(accion.limite, dia)}.` : "";
  return `${base}${vence}`;
}

/** A la tercera vez que se pospone, la pregunta es otra. */
export const preguntaDeValor = (accion) =>
  `Ya moviste «${accion.titulo}» tres veces. ¿Sigue valiendo la pena? Puedes hacerla, delegarla o soltarla sin culpa.`;

const LOGROS = [
  (a) => `Hecho: «${a.titulo}». Bien.`,
  (a) => `«${a.titulo}», terminada.`,
  (a) => `Listo «${a.titulo}». Uno menos.`,
];

/** Al terminar algo. Sólo lleva versículo si era importante y grande (lo decide quien llama). */
export function celebracion(accion, { dia, versiculo = null } = {}) {
  const base = variante(LOGROS, `${dia}|${accion.id}|logro`)(accion);
  return versiculo ? `${base}\n\n${bloqueVersiculo(versiculo.id ?? versiculo)}` : base;
}

/** Los textos de cada aviso de la escalera. */
export function textoDeAviso(aviso, accion, dia) {
  const cuando = accion.limite ? textoFecha(accion.limite, dia) : "";
  switch (aviso.clase) {
    case "empezar":
      return `«${accion.titulo}» vence ${cuando}. Es buen momento para empezar: ¿cuál es el primer paso?`;
    case "se-acerca":
      return `«${accion.titulo}» vence ${cuando}.`;
    case "vence-hoy":
      return `Hoy vence «${accion.titulo}».`;
    case "en-una-hora":
      return `En una hora: «${accion.titulo}».`;
    case "espera":
      return `¿Ya te respondió ${accion.espera?.persona ?? "la persona"} sobre «${accion.titulo}»?`;
    default:
      return accion.hora ? `${textoHora(accion.hora)} · ${accion.titulo}` : accion.titulo;
  }
}

/** La cabecera del día en la pantalla de Hoy. */
export const titularDelDia = (dia, nombre) => `${variante(SALUDOS, `${dia}|saludo`)(nombre)} Hoy es ${textoLargo(dia)}.`;
