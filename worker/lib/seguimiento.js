// ============================================================
// El seguimiento: lo que el asistente te escribe por su cuenta
//
// Una tarea programada del Worker (cada minuto) mira la hora en Panamá y, si
// toca, manda por Telegram:
//
//   · el RESUMEN de la mañana (después de la oración);
//   · los AVISOS de la escalera (recordatorio a su hora, «se acerca», «vence
//     hoy», «en una hora», «¿ya te respondió…?»), juntos si caen cerca y con
//     un tope diario; nada durante lo protegido ni en el silencio (avisos.js);
//   · media hora antes de cada REUNIÓN;
//   · el CIERRE del día y, después, «¿LA COMPLETASTE?» de lo que se pasó, con
//     botones (Hecho, Mañana, Ya no aplica);
//   · la REVISIÓN SEMANAL.
//
// Cada parte se enciende o se apaga en Ajustes → Seguimiento. Un aviso se
// RESERVA antes de mandarlo (`avisos_enviados`): dos vueltas a la vez, o una
// que se repite, no lo mandan dos veces. Si el Worker estuvo caído, lo que se
// pasó de su ventana no se manda tarde (un resumen a mediodía no sirve).
// ============================================================

import { crearAlmacen } from "./almacen.js";
import { duenos, chatDe } from "./sesion.js";
import { llamar, hayTelegram } from "./telegram.js";
import * as juancito from "./juancito.js";
import * as google from "./google.js";
import { hoyEn, horaEn, diaSemana, minutos, aHora, textoHora, sumarDias } from "../../src/lib/fechas.js";
import { planDelDia, deHoy, eventosDelDia } from "../../src/lib/hoy.js";
import { planDeAvisos, avisosDelDia, horaDelCierre, preguntasDeHoy, preguntada } from "../../src/lib/avisos.js";
import { resumenDeLaManana, cierreDelDia, textoDeAviso, preguntaCompletaste, bloqueVersiculo } from "../../src/lib/mensajes.js";
import { elegirVersiculo } from "../../src/lib/versiculos.js";
import { seguimientoDe, diasParaBorrar } from "../../src/lib/ajustes.js";
import { reunionesDelPeriodo, enfoqueDelDia } from "../../src/lib/agenda.js";
import { sombrerosDe } from "../../src/lib/sombreros.js";
import { RITMO_BASE } from "../../src/lib/ritmo.js";

export const APP = "https://agenda.juancitoads.com";
/** Minutos después de su hora en que un mensaje todavía sirve. */
const VENTANA = { resumen: 60, aviso: 20, reunion: 10, cierre: 60, revision: 90 };
const MAX_PREGUNTAS_POR_CIERRE = 3;

/** ¿Es su hora (o pasó hace poco)? */
export const enVentana = (ahora, objetivo, margen) => {
  if (!objetivo) return false;
  const d = minutos(ahora) - minutos(objetivo);
  return d >= 0 && d <= margen;
};

/** Los botones de decidir sobre una acción. */
export const botonesDe = (id) => [[{ text: "Hecho", callback_data: `h:${id}` }, { text: "Mañana", callback_data: `m:${id}` }, { text: "Ya no aplica", callback_data: `s:${id}` }]];

const enviar = (env, chat, texto, botones) =>
  llamar(env, "sendMessage", { chat_id: chat, text: String(texto).slice(0, 4000), link_preview_options: { is_disabled: true }, ...(botones ? { reply_markup: { inline_keyboard: botones } } : {}) });

/**
 * Qué toca mandar ahora a una persona. Puro: devuelve [{ clave, texto, botones?, marcar? }] (lo que hay que reservar y
 * mandar) sin mandar nada. `marcar` son acciones que se apuntan como preguntadas.
 */
export function queToca({ estado, ahora, hoy }) {
  const aj = estado.ajustes;
  const seg = seguimientoDe(aj);
  if (!seg.activo) return [];
  const todos = [...(estado.ritmo ?? RITMO_BASE), ...(estado.eventos ?? [])];
  const acciones = estado.acciones ?? [];
  const out = [];
  const nombre = aj.nombre ?? "Juan";

  // El resumen de la mañana.
  const horaResumen = aj.avisos?.resumen?.[diaSemana(hoy)];
  const avisosHoy = acciones.flatMap((a) => planDeAvisos(a, { hoy, ajustes: aj, esProyecto: (estado.proyectos ?? []).some((p) => p.id === a.proyectoId && p.limite === a.limite) }));
  const { resumen, mensajes } = avisosDelDia(avisosHoy, { dia: hoy, ajustes: aj, eventos: todos });
  if (seg.resumen && enVentana(ahora, horaResumen, VENTANA.resumen)) {
    const plan = planDelDia({ dia: hoy, eventos: todos, acciones, ajustes: aj });
    // Tus 3 de hoy, con la misma regla que la pantalla.
    const enfoque = enfoqueDelDia(acciones, { hoy, proyectos: estado.proyectos ?? [], sombreros: sombrerosDe(aj) });
    plan.tres = { escogidas: enfoque.tres.filter((a) => a.enfoque === hoy), sugeridas: enfoque.tres.filter((a) => a.enfoque !== hoy) };
    const versiculo = elegirVersiculo({ momento: "manana", hoy, frecuencia: aj.frecuenciaVersiculos });
    const extra = resumen.map((a) => {
      const acc = acciones.find((x) => x.id === a.accionId);
      return acc ? `• ${textoDeAviso(a, acc, hoy)}` : null;
    }).filter(Boolean);
    // Las propias y las de Google Calendar (también las de los calendarios compartidos).
    const reuniones = reunionesDelPeriodo(estado.eventos ?? [], estado.externos ?? [], { desde: hoy, hasta: hoy }, aj);
    const texto = [
      resumenDeLaManana({ nombre, plan, versiculo }),
      ...(reuniones.length ? [["Reuniones y citas de hoy:", ...reuniones.map((e) => `• ${textoHora(e.inicio)} ${e.titulo}`)].join("\n")] : []),
      ...(extra.length ? [["Para tener presente:", ...extra].join("\n")] : []),
    ].join("\n\n");
    out.push({ clave: `resumen:${hoy}`, texto });
  }

  // Los avisos sueltos de la escalera.
  if (seg.avisos) {
    for (const m of mensajes) {
      if (!enVentana(ahora, m.hora, VENTANA.aviso)) continue;
      const lineas = m.avisos.map((a) => ({ a, acc: acciones.find((x) => x.id === a.accionId) })).filter((x) => x.acc);
      if (!lineas.length) continue;
      const texto = lineas.length === 1 ? textoDeAviso(lineas[0].a, lineas[0].acc, hoy) : ["Para tener presente:", ...lineas.map((x) => `• ${textoDeAviso(x.a, x.acc, hoy)}`)].join("\n");
      out.push({ clave: `aviso:${m.avisos.map((a) => a.id).join(",")}`, texto, botones: lineas.length === 1 ? botonesDe(lineas[0].acc.id) : undefined });
    }
  }

  // Media hora antes de cada reunión (las propias; las de Google ya avisan solas).
  if (seg.reuniones) {
    for (const e of eventosDelDia(estado.eventos ?? [], hoy)) {
      if (e.clase !== "reunion" || e.protegido) continue;
      const antes = aHora(Math.max(0, minutos(e.inicio) - 30));
      if (enVentana(ahora, antes, VENTANA.reunion)) out.push({ clave: `reunion:${e.id}:${hoy}`, texto: `En media hora: ${e.titulo} (${textoHora(e.inicio)}).${e.notas ? `\n${e.notas}` : ""}` });
    }
  }

  // El cierre y «¿la completaste?».
  const horaCierre = horaDelCierre(hoy, { ajustes: aj, eventos: todos });
  if (enVentana(ahora, horaCierre, VENTANA.cierre)) {
    if (seg.cierre) {
      const hechas = acciones.filter((a) => a.estado === "hecha" && a.hechaEl === hoy);
      const pendientes = deHoy(acciones, hoy).filter((a) => a.lista === "siguientes");
      const base = hechas.length || pendientes.length ? cierreDelDia({ dia: hoy, hechas, pendientes, versiculo: elegirVersiculo({ momento: "descanso", hoy, frecuencia: aj.frecuenciaVersiculos }) }) : "Hoy no quedó nada pendiente. Descansa bien.";
      const tres = acciones.filter((a) => a.enfoque === hoy);
      const deTus3 = tres.length ? `De tus ${tres.length} de hoy hiciste ${tres.filter((a) => a.estado === "hecha").length}.` : "";
      const texto = [deTus3, base].filter(Boolean).join("\n\n");
      out.push({ clave: `cierre:${hoy}`, texto });
    }
    if (seg.preguntas) {
      for (const p of preguntasDeHoy(acciones, hoy).slice(0, MAX_PREGUNTAS_POR_CIERRE)) {
        const acc = acciones.find((x) => x.id === p.accionId);
        out.push({ clave: `pregunta:${p.accionId}:${hoy}`, texto: preguntaCompletaste(acc, p.intento, hoy), botones: botonesDe(acc.id), marcar: [acc] });
      }
    }
  }

  // La revisión semanal.
  if (seg.revision && aj.revision && diaSemana(hoy) === aj.revision.dia && enVentana(ahora, aj.revision.hora, VENTANA.revision)) {
    const desde = sumarDias(hoy, -7);
    const hechas = acciones.filter((a) => a.estado === "hecha" && a.hechaEl > desde).length;
    const abiertas = acciones.filter((a) => a.estado === "abierta" && a.lista === "siguientes").length;
    const v = elegirVersiculo({ momento: "revision", hoy, frecuencia: aj.frecuenciaVersiculos });
    out.push({
      clave: `revision:${hoy}`,
      texto: [`${nombre}, es hora de tu revisión semanal (${aj.revision.minutos ?? 30} min).`, `Esta semana cerraste ${hechas} y tienes ${abiertas} abiertas.`, "Vacía la bandeja, mira cada sombrero y escoge las piedras grandes de la semana que viene.", `${APP}/#plan`, ...(v ? [bloqueVersiculo(v.id)] : [])].join("\n\n"),
    });
  }
  return out;
}

/** Una vuelta del cron para todas las cuentas: sincroniza y manda lo que toca. */
export async function vuelta(env, momento = new Date()) {
  const db = env.DB;
  const resultado = { enviados: 0, errores: [] };
  for (const owner of await duenos(db)) {
    const almacen = crearAlmacen(db, owner);
    let estado = await almacen.estado();
    const zona = estado.ajustes?.zona;
    const hoy = hoyEn(zona, momento);
    const ahora = horaEn(zona, momento);
    // Lo de fuera primero, para que el resumen ya sepa lo que se marcó allá.
    await juancito.sincronizar(env, almacen, { hoy }).catch(() => null);
    await google.sincronizar(env, almacen, { hoy }).catch(() => null);
    // Una vez al día, de madrugada: lo viejo se borra (los avisos ya mandados y lo hecho hace más de N días).
    if (ahora >= "03:00" && (await almacen.reclamarAviso(`purga:${hoy}`).catch(() => false))) {
      await almacen.purgarAvisos().catch(() => null);
      const dias = diasParaBorrar(estado.ajustes);
      if (dias > 0) await almacen.purgarHechas(sumarDias(hoy, -dias)).catch(() => null);
    }
    if (!hayTelegram(env)) continue;
    const chat = await chatDe(db, owner);
    if (!chat) continue;
    estado = { ...(await almacen.estado()), externos: await almacen.externosEntre(hoy, hoy).catch(() => []) };
    for (const m of queToca({ estado, ahora, hoy })) {
      if (!(await almacen.reclamarAviso(m.clave))) continue;
      try {
        await enviar(env, chat, m.texto, m.botones);
        resultado.enviados++;
        if (m.marcar?.length) await almacen.lote(m.marcar.map((a) => almacen.sentenciaElemento("accion", preguntada(a, hoy))));
      } catch (e) {
        // No salió: se suelta para que la siguiente vuelta lo intente (dentro de su ventana).
        await almacen.soltarAviso(m.clave);
        resultado.errores.push(e.message);
      }
    }
  }
  return resultado;
}
