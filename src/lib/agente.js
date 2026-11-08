// ============================================================
// Lo que el asistente dice que hay que hacer, comprobado por el código
//
// El modelo lee lo que dijo Juan (una captura o un mensaje del chat) y
// devuelve un JSON (FORMA_DE_ORDENAR en personalidad.js). Aquí no se le cree
// nada sin mirarlo:
//
//   · un tipo, un sombrero, una fecha o una hora que no existen, fuera;
//   · una regla de repetición que no se entiende, fuera (la tarea se queda);
//   · si el texto nombra UN día de la semana y la fecha no cae en ese día,
//     se corrige al próximo de ese día y se dice (el modelo calcula mal el
//     día de la semana: pasó en el calendario de marketing);
//   · una fecha que ya pasó no se guarda: se pregunta;
//   · los cambios de horario y del ritmo pasan por aplicarAjuste y
//     aplicarRitmo, y los de los sombreros por aplicarSombrero;
//   · una OPERACIÓN sobre algo que ya existe (completar, mover, editar,
//     borrar, delegar) sólo vale con un id que esté en las listas: el modelo
//     no puede inventarse a qué se refiere;
//   · lo que APRENDE pasa por limpiarAprendizajes (sin repetir, sin nada
//     confidencial, tres como mucho).
//
// Y la TARJETA la escribe el código con lo que DE VERDAD se hizo, no con lo
// que el modelo dice que hizo. Todo se puede deshacer.
// ============================================================

import { esFecha, esHora, sumarDias, diaSemana, minutos, aHora, textoCorto, textoHora, DIAS } from "./fechas.js";
import { leerRegla } from "./recurrencia.js";
import { nuevaAccion, nuevoId, limpiarTitulo, DURACIONES, completar, posponer, soltar, VALORES } from "./metodo.js";
import { SOMBREROS, esSombrero, nombreDe, aplicarSombrero } from "./sombreros.js";
import { aplicarAjuste, CLAVES_AJUSTE } from "./ajustes.js";
import { aplicarRitmo } from "./ritmo.js";
import { limpiarAprendizajes } from "./cerebro.js";
import { porAgendar, esTodoElDia } from "./agenda.js";

export const TIPOS = Object.freeze(["accion", "evento", "recordatorio", "idea", "fecha-especial", "referencia", "ajuste", "ritmo", "sombrero"]);
export const OPERACIONES = Object.freeze(["completar", "reabrir", "posponer", "editar", "borrar", "soltar", "delegar"]);
const CLASES_EVENTO = ["reunion", "evento", "especial"];

const sinTildes = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// «Agendar reunión con Dayano» no es una tarea: es una reunión que todavía no tiene día (Juan la quiere en Reuniones).
const VERBO_REUNION = /^(agendar|programar|cuadrar|coordinar|organizar|tener|hacer|fijar|concretar)\s+(una\s+|la\s+|un\s+|el\s+)?(reuni[oó]n|cita)\b/i;
const tituloDeReunion = (t) => {
  const r = t.replace(/^(agendar|programar|cuadrar|coordinar|organizar|tener|hacer|fijar|concretar)\s+(una\s+|la\s+|un\s+|el\s+)?/i, "");
  return r.charAt(0).toUpperCase() + r.slice(1);
};

// Reino es la intimidad con Dios A SOLAS: lo que se hace con otras personas de la iglesia va a Iglesia.
const EN_GRUPO = /\b(alabanza|culto|servicio|celula|retiro|congreso|vigilia|campamento|conferencia|ensayo|reunion)\b/;
function sombreroDeEvento(s, clase, titulo, personas, sombreros) {
  const reino = sombreros.find((x) => x.id === s && (x.id === "reino" || /\breino\b/.test(sinTildes(x.nombre))));
  if (!reino) return s;
  if (clase !== "reunion" && !personas.length && !EN_GRUPO.test(sinTildes(titulo))) return s;
  return sombreros.find((x) => x.id === "iglesia" || /\biglesia\b/.test(sinTildes(x.nombre)))?.id ?? s;
}

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

/** El nombre exacto de un cliente de Juancito Ads, si el modelo nombró uno que existe. */
const clientePara = (nombre, clientes) => {
  if (!nombre) return null;
  const n = sinTildes(nombre).trim();
  return clientes.find((c) => sinTildes(c).trim() === n) ?? clientes.find((c) => sinTildes(c).includes(n) || n.includes(sinTildes(c))) ?? null;
};

const texto = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * La respuesta del modelo → los cambios comprobados, sin aplicar todavía.
 *   ctx: { hoy, texto (lo que dijo la persona), proyectos, personas, sombreros, acciones, eventos, clientes, cerebro }
 * Devuelve { ok, error?, acciones, eventos, proyectos, ajustes, ritmo, sombreros, personas, operaciones, aprendizajes,
 * pregunta, respuesta, versiculo, avisos, hoy }.
 */
export function leerOrden(respuesta, ctx = {}) {
  const { hoy, proyectos = [], personas = [], sombreros = SOMBREROS, acciones = [], eventos = [], clientes = [], cerebro = [], ritmo = [] } = ctx;
  // Un bloque de su semana sólo si existe y es un bloque (no un recordatorio).
  const bloqueValido = (id) => (typeof id === "string" && ritmo.some((e) => e.id === id && e.clase !== "recordatorio") ? id : null);
  const dicho = ctx.texto ?? "";
  const datos = typeof respuesta === "string" ? sacarJSON(respuesta) : respuesta;
  const vacio = { acciones: [], eventos: [], proyectos: [], ajustes: [], ritmo: [], sombreros: [], personas: [], operaciones: [], aprendizajes: [], avisos: [] };
  if (!datos || typeof datos !== "object") return { ok: false, error: "La respuesta del asistente no se pudo leer.", ...vacio, hoy };

  const r = { ok: true, ...vacio, hoy, pregunta: null, respuesta: texto(datos.respuesta, 700), versiculo: datos.versiculo ?? null };
  const preguntas = [];
  if (datos.pregunta) preguntas.push(texto(datos.pregunta, 300));
  const nombrados = diasNombrados(dicho);
  const todosLosProyectos = [...proyectos];

  const fechaSegura = (f, titulo, { pasadaVale = false } = {}) => {
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
    if (!pasadaVale && f < hoy) {
      preguntas.push(`«${titulo}» quedó para el ${textoCorto(f, hoy)}, que ya pasó. ¿Es del año que viene?`);
      return null;
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
    if (e.tipo === "sombrero") {
      if (!["crear", "editar", "mover", "quitar"].includes(e.accion)) {
        r.avisos.push("No entendí qué hacer con el sombrero.");
        continue;
      }
      r.sombreros.push({ accion: e.accion, id: e.id ?? null, nombre: e.nombre, detalle: e.detalle, color: e.color, a: e.a });
      continue;
    }

    const titulo = limpiarTitulo(e.titulo);
    if (!titulo) {
      r.avisos.push("Un elemento venía sin título; lo dejé fuera.");
      continue;
    }
    const s = esSombrero(e.sombrero, sombreros) ? e.sombrero : null;
    const repiteValida = (() => {
      if (!e.repite?.regla) return null;
      try {
        leerRegla(e.repite.regla);
        return { regla: e.repite.regla, modo: e.repite.modo === "despues" ? "despues" : "calendario" };
      } catch {
        r.avisos.push(`«${titulo}»: no entendí cada cuánto se repite; quedó sin repetir.`);
        return null;
      }
    })();
    const vale = Boolean(repiteValida) || e.tipo === "fecha-especial";
    const cuando = fechaSegura(e.cuando, titulo, { pasadaVale: vale });
    const limite = fechaSegura(e.limite, titulo, { pasadaVale: vale });
    if (repiteValida) repiteValida.inicio = cuando ?? limite ?? hoy;
    const hora = esHora(e.hora) ? e.hora : null;
    const minutosPedidos = DURACIONES.includes(Number(e.minutos)) ? Number(e.minutos) : null;
    const notas = texto(e.notas, 1000);
    const valor = VALORES.includes(e.valor) ? e.valor : null;
    const cliente = clientePara(e.cliente, clientes);

    // El proyecto: uno que ya existe, o uno nuevo si trae subtareas o fecha límite.
    let proyecto = proyectoPara(e.proyecto, s, todosLosProyectos);
    const subtareas = (Array.isArray(e.subtareas) ? e.subtareas : []).map((x) => ({ titulo: limpiarTitulo(x?.titulo), cuando: esFecha(x?.cuando) && x.cuando >= hoy ? x.cuando : null })).filter((x) => x.titulo).slice(0, 12);
    if (!proyecto && subtareas.length) {
      proyecto = { id: nuevoId("p"), nombre: e.proyecto ? limpiarTitulo(e.proyecto) : titulo, sombrero: s, tipo: "proyecto", limite: limite ?? cuando ?? null, estado: "activo", prioridad: valor === "alto" ? "alta" : "media" };
      r.proyectos.push(proyecto);
      todosLosProyectos.push(proyecto);
    } else if (!proyecto && e.proyecto && s) {
      proyecto = { id: nuevoId("p"), nombre: limpiarTitulo(e.proyecto), sombrero: s, tipo: limite ? "proyecto" : "responsabilidad", limite, estado: "activo", prioridad: "media" };
      r.proyectos.push(proyecto);
      todosLosProyectos.push(proyecto);
    }

    const reunionDisfrazada = (e.tipo === "accion" || e.tipo === "recordatorio") && VERBO_REUNION.test(titulo);
    if (e.tipo === "evento" || reunionDisfrazada) {
      // Una reunión o un evento NUNCA se vuelve tarea: sin hora, va a su día con la hora por definir; sin día, queda
      // «por agendar» en Reuniones. Y se pregunta lo que falta.
      const tituloEv = reunionDisfrazada ? tituloDeReunion(titulo) : titulo;
      const clase = reunionDisfrazada ? "reunion" : CLASES_EVENTO.includes(e.clase) ? e.clase : /reuni[oó]n|cita|llamada|junta|mentor/i.test(titulo) ? "reunion" : "evento";
      const personasEv = Array.isArray(e.personas) ? e.personas.slice(0, 8).map((p) => texto(p, 60)) : [];
      const comun = { id: nuevoId("e"), titulo: tituloEv, sombrero: sombreroDeEvento(s, clase, tituloEv, personasEv, sombreros), clase, protegido: false, fuente: "asistente", notas, personas: personasEv };
      if ((cuando || repiteValida) && hora) {
        const dura = minutosPedidos ?? 60;
        r.eventos.push({ ...comun, fecha: repiteValida ? null : cuando, repite: repiteValida, inicio: hora, fin: aHora(Math.min(minutos(hora) + dura, 23 * 60 + 59)) });
      } else if (cuando || repiteValida) {
        r.eventos.push({ ...comun, fecha: repiteValida ? null : cuando, repite: repiteValida, inicio: "00:00", fin: "23:59", ...(clase !== "especial" ? { horaPorDefinir: true } : {}) });
        if (clase !== "especial" && !preguntas.length) preguntas.push(`¿A qué hora es «${tituloEv}»?`);
      } else {
        r.eventos.push({ ...comun, fecha: null, repite: null, inicio: null, fin: null });
        if (!preguntas.length) preguntas.push(`¿Qué día y a qué hora es «${tituloEv}»?`);
      }
    } else {
      const base = {
        titulo,
        notas,
        clase: e.tipo === "recordatorio" || e.clase === "recordatorio" ? "recordatorio" : "tarea",
        sombrero: s,
        proyectoId: proyecto?.id ?? null,
        cuando,
        limite,
        hora,
        minutos: minutosPedidos ?? 30,
        importante: Boolean(e.importante),
        valor,
        personas: Array.isArray(e.personas) ? e.personas.slice(0, 8).map((p) => texto(p, 60)) : [],
        repite: repiteValida,
        confidencial: Boolean(e.confidencial),
        delegable: e.delegable?.a ? { a: texto(e.delegable.a, 80), porque: texto(e.delegable.porque, 200) } : null,
        cliente,
        bloque: bloqueValido(e.bloque),
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
        Object.assign(base, { clase: "recordatorio", cuando: null, limite: dia, importante: true, minutos: 15, repite: { regla: "FREQ=YEARLY", modo: "calendario", inicio: dia } });
      }
      if (e.espera_de || lista === "espera") {
        lista = "espera";
        base.espera = { persona: texto(e.espera_de ?? "alguien", 60), desde: hoy, preguntar: limite && limite > hoy ? sumarDias(limite, -1) : sumarDias(hoy, 3) };
      }
      // Un proyecto nuevo hecho de este elemento no se repite como acción: sus pasos son las subtareas.
      if (!(subtareas.length && r.proyectos.some((p) => p.nombre === titulo))) r.acciones.push(nuevaAccion({ ...base, lista }, hoy));
    }
    for (const st of subtareas) {
      r.acciones.push(nuevaAccion({ titulo: st.titulo, sombrero: s, proyectoId: proyecto?.id ?? null, lista: "siguientes", cuando: st.cuando, cliente, origen: "asistente" }, hoy));
    }
  }

  // ── Lo que cambia sobre lo que ya existe ──
  const buscarPorId = (id, tipo) => {
    const listas = { accion: acciones, evento: eventos, proyecto: proyectos };
    if (tipo && listas[tipo]) return listas[tipo].some((x) => x.id === id) ? tipo : null;
    return Object.keys(listas).find((t) => listas[t].some((x) => x.id === id)) ?? null;
  };
  for (const o of Array.isArray(datos.operaciones) ? datos.operaciones : []) {
    if (!o || !OPERACIONES.includes(o.op)) {
      if (o?.op) r.avisos.push(`No sé hacer «${o.op}».`);
      continue;
    }
    const id = String(o.id ?? "");
    const tipo = buscarPorId(id, o.tipo);
    if (!tipo) {
      r.avisos.push("No encontré a qué te referías; no cambié nada de eso.");
      continue;
    }
    const obj = { accion: acciones, evento: eventos, proyecto: proyectos }[tipo].find((x) => x.id === id);
    const nombre = obj.titulo ?? obj.nombre;
    if (["completar", "reabrir", "soltar", "delegar"].includes(o.op) && tipo !== "accion") {
      r.avisos.push(`«${nombre}» no es una tarea: no se puede ${o.op === "delegar" ? "delegar" : "marcar"}.`);
      continue;
    }
    if (o.op === "posponer") {
      const a = fechaSegura(o.a, nombre);
      if (!a) continue;
      if (tipo === "evento" && !obj.fecha && obj.repite?.regla) {
        r.avisos.push(`«${nombre}» se repite: cambia su día en tu semana, no aquí.`);
        continue;
      }
      r.operaciones.push({ op: "posponer", tipo, id, a });
      continue;
    }
    if (o.op === "delegar") {
      const persona = texto(o.a ?? o.cambios?.a, 60);
      if (!persona) {
        preguntas.push(`¿A quién le paso «${nombre}»?`);
        continue;
      }
      r.operaciones.push({ op: "delegar", tipo, id, a: persona });
      continue;
    }
    if (o.op === "editar") {
      const c = o.cambios && typeof o.cambios === "object" ? o.cambios : {};
      const cambios = {};
      if (c.titulo !== undefined && limpiarTitulo(c.titulo)) cambios[tipo === "proyecto" ? "nombre" : "titulo"] = limpiarTitulo(c.titulo);
      if (c.nombre !== undefined && tipo === "proyecto" && limpiarTitulo(c.nombre)) cambios.nombre = limpiarTitulo(c.nombre);
      if (c.notas !== undefined) cambios.notas = texto(c.notas, 1000);
      if (c.sombrero !== undefined && esSombrero(c.sombrero, sombreros)) cambios.sombrero = c.sombrero;
      if (tipo === "accion") {
        for (const k of ["cuando", "limite"]) if (c[k] !== undefined) cambios[k] = c[k] === null ? null : fechaSegura(c[k], nombre);
        if (c.hora !== undefined) cambios.hora = c.hora === null ? null : esHora(c.hora) ? c.hora : obj.hora;
        if (VALORES.includes(c.valor)) cambios.valor = c.valor;
        if (typeof c.importante === "boolean") cambios.importante = c.importante;
        if (["tarea", "recordatorio"].includes(c.clase)) cambios.clase = c.clase;
        if (["siguientes", "algun-dia"].includes(c.lista)) cambios.lista = c.lista;
        if (c.bloque !== undefined) cambios.bloque = c.bloque === null ? null : bloqueValido(c.bloque) ?? obj.bloque ?? null;
        if (c.delegable === null) cambios.delegable = null;
        else if (c.delegable?.a) cambios.delegable = { a: texto(c.delegable.a, 80), porque: texto(c.delegable.porque, 200) };
        if (c.proyecto !== undefined) cambios.proyectoId = proyectoPara(c.proyecto, cambios.sombrero ?? obj.sombrero, todosLosProyectos)?.id ?? obj.proyectoId;
      }
      if (tipo === "evento") {
        const sinDia = porAgendar(obj);
        if (c.fecha !== undefined && (obj.fecha || sinDia)) {
          const f = fechaSegura(c.fecha, nombre);
          if (f) cambios.fecha = f;
        }
        if (CLASES_EVENTO.includes(c.clase)) cambios.clase = c.clase;
        if (esHora(c.inicio)) {
          // Ya tiene hora: deja de ser «de todo el día» y, si no dijo hasta cuándo, dura una hora.
          cambios.inicio = c.inicio;
          cambios.horaPorDefinir = false;
          if (!esHora(c.fin) && (!obj.fin || obj.fin === "23:59" || obj.fin <= c.inicio)) cambios.fin = aHora(Math.min(minutos(c.inicio) + 60, 23 * 60 + 59));
        }
        if (esHora(c.fin) && (!cambios.inicio || c.fin > cambios.inicio)) cambios.fin = c.fin;
        if (cambios.fecha && sinDia && !cambios.inicio) Object.assign(cambios, { inicio: "00:00", fin: "23:59", horaPorDefinir: (cambios.clase ?? obj.clase) !== "especial" });
      }
      if (tipo === "proyecto") {
        if (["alta", "media", "baja"].includes(c.prioridad)) cambios.prioridad = c.prioridad;
        if (["activo", "terminado", "pausado"].includes(c.estado)) cambios.estado = c.estado;
        if (c.limite !== undefined) cambios.limite = c.limite === null ? null : fechaSegura(c.limite, nombre);
      }
      if (!Object.keys(cambios).length) continue;
      r.operaciones.push({ op: "editar", tipo, id, cambios });
      continue;
    }
    r.operaciones.push({ op: o.op, tipo, id });
  }

  for (const p of Array.isArray(datos.personas_nuevas) ? datos.personas_nuevas : []) {
    const nombre = texto(p?.nombre, 60);
    if (!nombre || personas.some((x) => sinTildes(x.nombre) === sinTildes(nombre))) continue;
    r.personas.push({ nombre, relacion: texto(p.relacion, 80), sombrero: esSombrero(p.sombrero, sombreros) ? p.sombrero : null });
  }

  r.aprendizajes = limpiarAprendizajes(datos.aprendizajes, cerebro, { sombreros });
  r.pregunta = preguntas[0] ?? null;
  return r;
}

/**
 * Aplica los cambios a un estado { acciones, eventos, proyectos, personas, ajustes, ritmo }. Puro.
 * Devuelve { estado, hecho, deshacer, problemas }: `hecho` es lo que de verdad entró (para la tarjeta),
 * `deshacer`, lo necesario para volver atrás, y `cambiados`/`borrados`, lo que hay que escribir o quitar.
 */
export function aplicarOrden(estado, orden) {
  const hoy = orden.hoy;
  const problemas = [];
  let ajustes = estado.ajustes;
  let ritmo = estado.ritmo ?? [];
  const ajustesHechos = [];
  const ritmoHecho = [];
  const sombrerosHechos = [];
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
  for (const cambio of orden.sombreros ?? []) {
    try {
      if (cambio.accion === "quitar" && [...(estado.acciones ?? []), ...(estado.proyectos ?? [])].some((x) => x.sombrero === cambio.id && x.estado !== "hecha")) {
        throw new Error("Ese sombrero todavía tiene cosas abiertas: muévelas antes de quitarlo.");
      }
      const r = aplicarSombrero(ajustes.sombreros, cambio);
      ajustes = { ...ajustes, sombreros: r.lista };
      sombrerosHechos.push({ accion: cambio.accion, sombrero: r.sombrero, a: cambio.a });
    } catch (e) {
      problemas.push(e.message);
    }
  }

  let acciones = [...estado.acciones, ...orden.acciones];
  let eventos = [...(estado.eventos ?? []), ...orden.eventos];
  let proyectos = [...(estado.proyectos ?? []), ...orden.proyectos];
  const antes = [];
  const borrados = [];
  const creadosPorOp = [];
  const opsHechas = [];
  const listaDe = (tipo) => (tipo === "accion" ? acciones : tipo === "evento" ? eventos : proyectos);
  const ponerLista = (tipo, l) => {
    if (tipo === "accion") acciones = l;
    else if (tipo === "evento") eventos = l;
    else proyectos = l;
  };
  for (const o of orden.operaciones ?? []) {
    const lista = listaDe(o.tipo);
    const prev = lista.find((x) => x.id === o.id);
    if (!prev) continue;
    if (!antes.some((x) => x.tipo === o.tipo && x.obj.id === o.id) && !borrados.some((x) => x.obj.id === o.id)) antes.push({ tipo: o.tipo, obj: prev });
    const titulo = prev.titulo ?? prev.nombre;
    let nuevo = prev;
    let detalle = "";
    if (o.op === "completar") {
      if (prev.estado === "hecha") continue;
      const { hecha, siguiente } = completar(prev, hoy);
      nuevo = hecha;
      if (siguiente) {
        acciones = [...acciones, siguiente];
        creadosPorOp.push(siguiente.id);
        detalle = `la siguiente, ${textoCorto(siguiente.cuando ?? siguiente.limite, hoy)}`;
      }
    } else if (o.op === "reabrir") nuevo = { ...prev, estado: "abierta", hechaEl: null };
    else if (o.op === "soltar") nuevo = soltar(prev, hoy);
    else if (o.op === "posponer") {
      nuevo = o.tipo === "evento" ? { ...prev, fecha: o.a, ...(prev.inicio ? {} : { inicio: "00:00", fin: "23:59", horaPorDefinir: prev.clase !== "especial" }) } : prev.limite && !prev.cuando ? { ...posponer(prev, null), cuando: null, limite: o.a } : posponer(prev, o.a);
      detalle = textoCorto(o.a, hoy);
    } else if (o.op === "delegar") {
      nuevo = { ...prev, lista: "espera", delegable: null, espera: { persona: o.a, desde: hoy, preguntar: prev.limite && prev.limite > hoy ? sumarDias(prev.limite, -1) : sumarDias(hoy, 3) } };
      detalle = o.a;
    } else if (o.op === "editar") {
      nuevo = { ...prev, ...o.cambios };
      detalle = Object.keys(o.cambios).map((k) => CAMPOS[k] ?? k).join(", ");
    } else if (o.op === "borrar") {
      ponerLista(o.tipo, listaDe(o.tipo).filter((x) => x.id !== o.id));
      borrados.push({ tipo: o.tipo, obj: prev });
      const i = antes.findIndex((x) => x.obj.id === o.id);
      if (i >= 0) antes.splice(i, 1);
      opsHechas.push({ op: o.op, tipo: o.tipo, titulo, detalle });
      continue;
    }
    ponerLista(o.tipo, listaDe(o.tipo).map((x) => (x.id === o.id ? nuevo : x)));
    opsHechas.push({ op: o.op, tipo: o.tipo, titulo, detalle });
  }

  const nuevo = {
    ...estado,
    acciones,
    eventos,
    proyectos,
    personas: [...(estado.personas ?? []), ...orden.personas],
    ajustes,
    ritmo,
  };
  const tocados = (tipo) => antes.filter((x) => x.tipo === tipo).map((x) => listaDe(tipo).find((y) => y.id === x.obj.id)).filter(Boolean);
  const cambioPerfil = ajustesHechos.length || ritmoHecho.length || sombrerosHechos.length;
  return {
    estado: nuevo,
    hecho: { acciones: orden.acciones, eventos: orden.eventos, proyectos: orden.proyectos, personas: orden.personas, ajustes: ajustesHechos, ritmo: ritmoHecho, sombreros: sombrerosHechos, operaciones: opsHechas, aprendizajes: orden.aprendizajes ?? [] },
    // Lo que hay que escribir en la base además de lo creado.
    cambiados: { acciones: [...tocados("accion"), ...acciones.filter((a) => creadosPorOp.includes(a.id))], eventos: tocados("evento"), proyectos: tocados("proyecto") },
    borrados,
    deshacer: {
      acciones: [...orden.acciones.map((a) => a.id), ...creadosPorOp],
      eventos: orden.eventos.map((e) => e.id),
      proyectos: orden.proyectos.map((p) => p.id),
      personas: orden.personas.map((p) => p.nombre),
      antes: [...antes, ...borrados],
      ajustes: cambioPerfil ? estado.ajustes : null,
      ritmo: ritmoHecho.length ? estado.ritmo : null,
    },
    problemas,
  };
}

const CAMPOS = { titulo: "título", nombre: "nombre", notas: "notas", cuando: "día", limite: "fecha límite", hora: "hora", valor: "valor", importante: "importancia", clase: "tipo", lista: "lista", delegable: "a quién delegar", proyectoId: "proyecto", sombrero: "sombrero", fecha: "día", inicio: "inicio", fin: "fin", prioridad: "prioridad", estado: "estado" };

/** Deshace lo que aplicó aplicarOrden. Puro. */
export function deshacerOrden(estado, deshacer) {
  const fuera = (lista, ids, clave = "id") => (lista ?? []).filter((x) => !ids.includes(x[clave]));
  const restaurar = (lista, tipo) => {
    let l = lista;
    for (const { tipo: t, obj } of deshacer.antes ?? []) {
      if (t !== tipo) continue;
      l = l.some((x) => x.id === obj.id) ? l.map((x) => (x.id === obj.id ? obj : x)) : [...l, obj];
    }
    return l;
  };
  return {
    ...estado,
    acciones: restaurar(fuera(estado.acciones, deshacer.acciones), "accion"),
    eventos: restaurar(fuera(estado.eventos, deshacer.eventos), "evento"),
    proyectos: restaurar(fuera(estado.proyectos, deshacer.proyectos), "proyecto"),
    personas: fuera(estado.personas, deshacer.personas, "nombre"),
    ajustes: deshacer.ajustes ?? estado.ajustes,
    ritmo: deshacer.ritmo ?? estado.ritmo,
  };
}

const VERBO = { completar: "Hecha", reabrir: "Reabierta", soltar: "Soltada", borrar: "Borré", posponer: "Moví", delegar: "Delegada", editar: "Cambié" };

/** La tarjeta de confirmación, con lo que DE VERDAD se hizo. */
export function tarjeta({ hecho, problemas = [] }, orden, hoy, { sombreros = SOMBREROS } = {}) {
  const nombreS = (id) => nombreDe(id, sombreros);
  const lineas = [];
  for (const e of hecho.eventos) {
    const hora = e.horaPorDefinir ? "hora por definir" : textoHora(e.inicio);
    const cuando = porAgendar(e) ? "por agendar" : e.fecha ? (esTodoElDia(e) && !e.horaPorDefinir ? textoCorto(e.fecha, hoy) : `${textoCorto(e.fecha, hoy)}, ${hora}`) : `${hora}, se repite`;
    lineas.push(`• ${e.clase === "reunion" ? "Reunión" : e.clase === "especial" ? "Evento especial" : "Evento"}: «${e.titulo}» · ${nombreS(e.sombrero)} · ${cuando}`);
  }
  for (const p of hecho.proyectos) lineas.push(`• Proyecto nuevo: «${p.nombre}» · ${nombreS(p.sombrero)}`);
  for (const a of hecho.acciones) {
    const partes = [`${a.clase === "recordatorio" ? "Recordatorio" : "Tarea"}: «${a.titulo}»`, nombreS(a.sombrero)];
    if (a.lista === "algun-dia") partes.push("Algún día");
    if (a.lista === "espera") partes.push(`esperas a ${a.espera?.persona}`);
    if (a.cuando) partes.push(textoCorto(a.cuando, hoy) + (a.hora ? `, ${textoHora(a.hora)}` : ""));
    if (a.limite) partes.push(`${a.repite?.regla === "FREQ=YEARLY" ? "cada año, el" : "vence"} ${textoCorto(a.limite, hoy)}`);
    if (a.valor === "alto") partes.push("valor alto");
    if (a.delegable?.a) partes.push(`puede hacerla ${a.delegable.a}`);
    if (sombreros.find((s) => s.id === a.sombrero)?.fuente === "juancito-ads") partes.push(a.cliente ? `en Juancito Ads (${a.cliente})` : "en Juancito Ads");
    lineas.push(`• ${partes.join(" · ")}`);
  }
  for (const o of hecho.operaciones ?? []) lineas.push(`• ${VERBO[o.op]}${o.op === "editar" || o.op === "posponer" || o.op === "borrar" ? "" : ":"} «${o.titulo}»${o.detalle ? (o.op === "posponer" ? ` al ${o.detalle}` : o.op === "delegar" ? ` a ${o.detalle}` : o.op === "editar" ? ` (${o.detalle})` : ` (${o.detalle})`) : ""}`);
  for (const c of hecho.ajustes) lineas.push(`• Ajusté: ${CLAVES_AJUSTE[c.clave].toLowerCase()} → ${Array.isArray(c.valor) ? c.valor.join(", ") : c.valor}`);
  for (const r of hecho.ritmo) {
    const b = r.bloque;
    if (r.accion === "quitar") lineas.push(`• Quité de tu semana: «${b.titulo}»`);
    else lineas.push(`• Tu semana: «${b.titulo}» de ${textoHora(b.inicio)} a ${textoHora(b.fin)}${r.accion === "agregar" ? " (nuevo)" : ""}`);
  }
  for (const s of hecho.sombreros ?? []) {
    const n = s.sombrero?.nombre;
    lineas.push(s.accion === "crear" ? `• Sombrero nuevo: «${n}»` : s.accion === "quitar" ? `• Quité el sombrero «${n}»` : s.accion === "mover" ? `• «${n}» pasa al puesto ${s.a} de prioridad` : `• Sombrero «${n}» actualizado`);
  }
  for (const p of hecho.personas) lineas.push(`• Recordaré que ${p.nombre} es ${p.relacion || "alguien de tu vida"}.`);
  for (const a of hecho.aprendizajes ?? []) lineas.push(`• Aprendí: ${a.titulo}.`);
  const respuesta = (orden.respuesta ?? "").trim();
  const cabeza = lineas.length ? (respuesta && !/^listo[.!]?$/i.test(respuesta) ? respuesta : "Listo:") : respuesta || "No guardé nada.";
  return [cabeza, ...lineas, ...orden.avisos.map((a) => `Ojo: ${a}`), ...problemas.map((p) => `No pude: ${p}`), ...(orden.pregunta ? [orden.pregunta] : [])].join("\n");
}
