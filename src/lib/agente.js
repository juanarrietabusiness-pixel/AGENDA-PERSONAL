// ============================================================
// Lo que el asistente dice que hay que hacer, comprobado por el código
//
// El modelo lee la captura y devuelve un JSON (FORMA_DE_ORDENAR en
// personalidad.js). Aquí no se le cree nada sin mirarlo:
//
//   · un tipo, un sombrero, una fecha o una hora que no existen, fuera;
//   · una regla de repetición que no se entiende, fuera (la tarea se queda);
//   · si el texto nombra UN día de la semana y la fecha no cae en ese día,
//     se corrige al próximo de ese día y se dice (el modelo calcula mal el
//     día de la semana: pasó en el calendario de marketing);
//   · una fecha que ya pasó no se guarda: se pregunta;
//   · los cambios de horario y del ritmo pasan por aplicarAjuste y
//     aplicarRitmo, que los comprueban.
//
// Y la TARJETA la escribe el código con lo que DE VERDAD se hizo, no con lo
// que el modelo dice que hizo.
// ============================================================

import { esFecha, esHora, sumarDias, diaSemana, minutos, aHora, textoCorto, textoHora, DIAS } from "./fechas.js";
import { leerRegla } from "./recurrencia.js";
import { nuevaAccion, nuevoId, limpiarTitulo, DURACIONES } from "./metodo.js";
import { esSombrero, sombrero } from "./sombreros.js";
import { aplicarAjuste, CLAVES_AJUSTE } from "./ajustes.js";
import { aplicarRitmo } from "./ritmo.js";

export const TIPOS = Object.freeze(["accion", "evento", "recordatorio", "idea", "fecha-especial", "referencia", "ajuste", "ritmo"]);

const sinTildes = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** El JSON de la respuesta del modelo, aunque venga entre ```json o con texto alrededor. null si no hay. */
export function sacarJSON(texto) {
  const t = String(texto ?? "").replace(/```(?:json)?/gi, "");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(t.slice(a, b + 1));
  } catch {
    return null;
  }
}

const NOMBRES_DIA = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

/** Los días de la semana que nombra un texto (sin repetir). */
export function diasNombrados(texto) {
  const t = sinTildes(texto);
  return Object.entries(NOMBRES_DIA)
    .filter(([n]) => new RegExp(`(^|[^a-z])${n}([^a-z]|$)`).test(t))
    .map(([, d]) => d);
}

/** El próximo día `dia` (0 = domingo) desde `hoy`, hoy incluido. */
const proximo = (hoy, dia) => sumarDias(hoy, (dia - diaSemana(hoy) + 7) % 7);

function proyectoPara(nombre, sombreroId, proyectos) {
  if (!nombre) return null;
  const n = sinTildes(nombre).trim();
  return proyectos.find((p) => sinTildes(p.nombre).trim() === n && (!sombreroId || p.sombrero === sombreroId))
    ?? proyectos.find((p) => sinTildes(p.nombre).trim() === n)
    ?? null;
}

/**
 * La respuesta del modelo → los cambios comprobados, sin aplicar todavía.
 *   ctx: { hoy, texto (lo que dijo la persona), proyectos, personas }
 * Devuelve { ok, error?, acciones, eventos, proyectos, ajustes, ritmo, personas, pregunta, respuesta, versiculo, avisos }.
 */
export function leerOrden(respuesta, { hoy, texto = "", proyectos = [], personas = [] } = {}) {
  const datos = typeof respuesta === "string" ? sacarJSON(respuesta) : respuesta;
  const vacio = { acciones: [], eventos: [], proyectos: [], ajustes: [], ritmo: [], personas: [], avisos: [] };
  if (!datos || typeof datos !== "object") return { ok: false, error: "La respuesta del asistente no se pudo leer.", ...vacio };

  const r = { ok: true, ...vacio, pregunta: null, respuesta: String(datos.respuesta ?? "").slice(0, 400), versiculo: datos.versiculo ?? null };
  const preguntas = [];
  if (datos.pregunta) preguntas.push(String(datos.pregunta).slice(0, 300));
  const nombrados = diasNombrados(texto);
  const todosLosProyectos = [...proyectos];

  const fechaSegura = (f, titulo) => {
    if (!f) return null;
    if (!esFecha(f)) {
      r.avisos.push(`«${titulo}»: la fecha «${f}» no se entendió; quedó sin fecha.`);
      return null;
    }
    // Un solo día nombrado y la fecha no cae en él: se corrige al próximo de ese día.
    if (nombrados.length === 1 && diaSemana(f) !== nombrados[0]) {
      const bien = proximo(hoy, nombrados[0]);
      r.avisos.push(`«${titulo}»: lo puse el ${DIAS[nombrados[0]]} ${textoCorto(bien, hoy)}.`);
      return bien;
    }
    return f;
  };

  for (const e of Array.isArray(datos.elementos) ? datos.elementos : []) {
    if (!e || !TIPOS.includes(e.tipo)) {
      if (e?.tipo) r.avisos.push(`No sé qué es un «${e.tipo}»; lo dejé fuera.`);
      continue;
    }

    if (e.tipo === "ajuste") {
      if (!(e.clave in CLAVES_AJUSTE)) {
        r.avisos.push(`No conozco el ajuste «${e.clave}».`);
        continue;
      }
      r.ajustes.push({ clave: e.clave, valor: e.valor, dias: e.dias ?? null });
      continue;
    }
    if (e.tipo === "ritmo") {
      r.ritmo.push({ ...e });
      continue;
    }

    const titulo = limpiarTitulo(e.titulo);
    if (!titulo) {
      r.avisos.push("Un elemento venía sin título; lo dejé fuera.");
      continue;
    }
    const s = esSombrero(e.sombrero) ? e.sombrero : null;
    let cuando = fechaSegura(e.cuando, titulo);
    let limite = fechaSegura(e.limite, titulo);
    const repiteValida = (() => {
      if (!e.repite?.regla) return null;
      try {
        leerRegla(e.repite.regla);
        return { regla: e.repite.regla, modo: e.repite.modo === "despues" ? "despues" : "calendario", inicio: cuando ?? limite ?? hoy };
      } catch {
        r.avisos.push(`«${titulo}»: no entendí cada cuánto se repite; quedó sin repetir.`);
        return null;
      }
    })();
    if (!repiteValida && e.tipo !== "fecha-especial") {
      for (const [campo, valor] of [["cuando", cuando], ["limite", limite]]) {
        if (valor && valor < hoy) {
          preguntas.push(`«${titulo}» quedó para el ${textoCorto(valor, hoy)}, que ya pasó. ¿Es del año que viene?`);
          if (campo === "cuando") cuando = null;
          else limite = null;
        }
      }
    }
    const hora = esHora(e.hora) ? e.hora : null;
    const minutosPedidos = DURACIONES.includes(Number(e.minutos)) ? Number(e.minutos) : null;

    // El proyecto: uno que ya existe, o uno nuevo si trae subtareas o fecha límite.
    let proyecto = proyectoPara(e.proyecto, s, todosLosProyectos);
    const subtareas = (Array.isArray(e.subtareas) ? e.subtareas : []).map((x) => ({ titulo: limpiarTitulo(x?.titulo), cuando: esFecha(x?.cuando) && x.cuando >= hoy ? x.cuando : null })).filter((x) => x.titulo).slice(0, 12);
    if (!proyecto && subtareas.length) {
      proyecto = { id: nuevoId("p"), nombre: e.proyecto ? limpiarTitulo(e.proyecto) : titulo, sombrero: s, tipo: "proyecto", limite: limite ?? cuando ?? null, estado: "activo" };
      r.proyectos.push(proyecto);
      todosLosProyectos.push(proyecto);
    } else if (!proyecto && e.proyecto && s) {
      proyecto = { id: nuevoId("p"), nombre: limpiarTitulo(e.proyecto), sombrero: s, tipo: limite ? "proyecto" : "responsabilidad", limite, estado: "activo" };
      r.proyectos.push(proyecto);
      todosLosProyectos.push(proyecto);
    }

    if (e.tipo === "evento" && (cuando || repiteValida) && hora) {
      const dura = minutosPedidos ?? 60;
      r.eventos.push({
        id: nuevoId("e"),
        titulo,
        sombrero: s,
        fecha: repiteValida ? null : cuando,
        repite: repiteValida,
        inicio: hora,
        fin: aHora(Math.min(minutos(hora) + dura, 23 * 60 + 59)),
        protegido: false,
        fuente: "asistente",
        personas: Array.isArray(e.personas) ? e.personas.slice(0, 8) : [],
      });
    } else {
      const base = {
        titulo,
        sombrero: s,
        proyectoId: proyecto?.id ?? null,
        cuando,
        limite,
        hora,
        minutos: minutosPedidos ?? 30,
        importante: Boolean(e.importante),
        personas: Array.isArray(e.personas) ? e.personas.slice(0, 8) : [],
        repite: repiteValida,
        confidencial: Boolean(e.confidencial),
        delegable: e.delegable?.a ? { a: String(e.delegable.a).slice(0, 80), porque: String(e.delegable.porque ?? "").slice(0, 200) } : null,
        origen: "asistente",
      };
      let lista = ["siguientes", "espera", "algun-dia", "referencia"].includes(e.lista) ? e.lista : "siguientes";
      if (e.tipo === "idea") lista = "algun-dia";
      if (e.tipo === "referencia") lista = "referencia";
      if (e.tipo === "fecha-especial") {
        const dia = cuando ?? limite;
        if (!dia) {
          preguntas.push(`¿Qué día es «${titulo}»?`);
          continue;
        }
        Object.assign(base, { cuando: null, limite: dia, importante: true, minutos: 15, repite: { regla: "FREQ=YEARLY", modo: "calendario", inicio: dia } });
      }
      if (e.espera_de || lista === "espera") {
        lista = "espera";
        base.espera = { persona: String(e.espera_de ?? "alguien").slice(0, 60), desde: hoy, preguntar: limite && limite > hoy ? sumarDias(limite, -1) : sumarDias(hoy, 3) };
      }
      if (e.tipo === "evento") r.avisos.push(`«${titulo}» no traía hora: la dejé como tarea de ese día.`);
      // Un proyecto nuevo hecho de este elemento no se repite como acción: sus pasos son las subtareas.
      if (!(subtareas.length && r.proyectos.some((p) => p.nombre === titulo))) r.acciones.push(nuevaAccion({ ...base, lista }, hoy));
    }
    for (const st of subtareas) {
      r.acciones.push(nuevaAccion({ titulo: st.titulo, sombrero: s, proyectoId: proyecto?.id ?? null, lista: "siguientes", cuando: st.cuando, origen: "asistente" }, hoy));
    }
  }

  for (const p of Array.isArray(datos.personas_nuevas) ? datos.personas_nuevas : []) {
    const nombre = String(p?.nombre ?? "").trim().slice(0, 60);
    if (!nombre || personas.some((x) => sinTildes(x.nombre) === sinTildes(nombre))) continue;
    r.personas.push({ nombre, relacion: String(p.relacion ?? "").slice(0, 80), sombrero: esSombrero(p.sombrero) ? p.sombrero : null });
  }

  r.pregunta = preguntas[0] ?? null;
  return r;
}

/**
 * Aplica los cambios a un estado { acciones, eventos, proyectos, personas, ajustes, ritmo }. Puro.
 * Devuelve { estado, hecho, deshacer, problemas }: `hecho` es lo que de verdad entró (para la tarjeta) y `deshacer`,
 * lo necesario para volver atrás.
 */
export function aplicarOrden(estado, orden) {
  const problemas = [];
  let ajustes = estado.ajustes;
  let ritmo = estado.ritmo ?? [];
  const ajustesHechos = [];
  const ritmoHecho = [];
  for (const cambio of orden.ajustes) {
    try {
      ajustes = aplicarAjuste(ajustes, cambio);
      ajustesHechos.push(cambio);
    } catch (e) {
      problemas.push(e.message);
    }
  }
  for (const cambio of orden.ritmo) {
    try {
      const r = aplicarRitmo(ritmo, cambio);
      ritmo = r.ritmo;
      ajustes = { ...ajustes, porConfirmar: (ajustes.porConfirmar ?? []).filter((p) => !r.claves.includes(p.clave)) };
      ritmoHecho.push({ accion: cambio.accion, bloque: r.bloque });
    } catch (e) {
      problemas.push(e.message);
    }
  }
  const nuevo = {
    ...estado,
    acciones: [...estado.acciones, ...orden.acciones],
    eventos: [...(estado.eventos ?? []), ...orden.eventos],
    proyectos: [...(estado.proyectos ?? []), ...orden.proyectos],
    personas: [...(estado.personas ?? []), ...orden.personas],
    ajustes,
    ritmo,
  };
  return {
    estado: nuevo,
    hecho: { acciones: orden.acciones, eventos: orden.eventos, proyectos: orden.proyectos, personas: orden.personas, ajustes: ajustesHechos, ritmo: ritmoHecho },
    deshacer: {
      acciones: orden.acciones.map((a) => a.id),
      eventos: orden.eventos.map((e) => e.id),
      proyectos: orden.proyectos.map((p) => p.id),
      personas: orden.personas.map((p) => p.nombre),
      ajustes: ajustesHechos.length || ritmoHecho.length ? estado.ajustes : null,
      ritmo: ritmoHecho.length ? estado.ritmo : null,
    },
    problemas,
  };
}

/** Deshace lo que aplicó aplicarOrden. Puro. */
export function deshacerOrden(estado, deshacer) {
  const fuera = (lista, ids, clave = "id") => (lista ?? []).filter((x) => !ids.includes(x[clave]));
  return {
    ...estado,
    acciones: fuera(estado.acciones, deshacer.acciones),
    eventos: fuera(estado.eventos, deshacer.eventos),
    proyectos: fuera(estado.proyectos, deshacer.proyectos),
    personas: fuera(estado.personas, deshacer.personas, "nombre"),
    ajustes: deshacer.ajustes ?? estado.ajustes,
    ritmo: deshacer.ritmo ?? estado.ritmo,
  };
}

const nombreS = (id) => sombrero(id)?.nombre ?? "Sin sombrero";

/** La tarjeta de confirmación, con lo que DE VERDAD se hizo. */
export function tarjeta({ hecho, problemas = [] }, orden, hoy) {
  const lineas = [];
  for (const e of hecho.eventos) {
    const cuando = e.fecha ? `${textoCorto(e.fecha, hoy)}, ${textoHora(e.inicio)}` : `${textoHora(e.inicio)}, se repite`;
    lineas.push(`• «${e.titulo}» · ${nombreS(e.sombrero)} · ${cuando}`);
  }
  for (const p of hecho.proyectos) lineas.push(`• Proyecto nuevo: «${p.nombre}» · ${nombreS(p.sombrero)}`);
  for (const a of hecho.acciones) {
    const partes = [`«${a.titulo}»`, nombreS(a.sombrero)];
    if (a.lista === "algun-dia") partes.push("Algún día");
    if (a.lista === "espera") partes.push(`esperas a ${a.espera?.persona}`);
    if (a.cuando) partes.push(textoCorto(a.cuando, hoy) + (a.hora ? `, ${textoHora(a.hora)}` : ""));
    if (a.limite) partes.push(`vence ${textoCorto(a.limite, hoy)}`);
    if (a.sombrero === "trabajo") partes.push("irá a Juancito Ads");
    lineas.push(`• ${partes.join(" · ")}`);
  }
  for (const c of hecho.ajustes) lineas.push(`• Ajusté: ${CLAVES_AJUSTE[c.clave].toLowerCase()} → ${Array.isArray(c.valor) ? c.valor.join(", ") : c.valor}`);
  for (const r of hecho.ritmo) {
    const b = r.bloque;
    if (r.accion === "quitar") lineas.push(`• Quité de tu semana: «${b.titulo}»`);
    else lineas.push(`• Tu semana: «${b.titulo}» de ${textoHora(b.inicio)} a ${textoHora(b.fin)}${r.accion === "agregar" ? " (nuevo)" : ""}`);
  }
  for (const p of hecho.personas) lineas.push(`• Recordaré que ${p.nombre} es ${p.relacion || "alguien de tu vida"}.`);
  const cabeza = lineas.length ? "Listo:" : (orden.respuesta || "No guardé nada.");
  return [cabeza, ...lineas, ...orden.avisos.map((a) => `Ojo: ${a}`), ...problemas.map((p) => `No pude: ${p}`), ...(orden.pregunta ? [orden.pregunta] : [])].join("\n");
}
