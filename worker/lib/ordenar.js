// ============================================================
// El asistente: de lo que dijo Juan a lo que queda hecho
//
//   1. Lo dicho YA está guardado (si algo falla, queda en la Bandeja).
//   2. El asistente lo lee con TODA su vida delante: sus listas con ids (para
//      poder completar, mover o editar lo que ya existe), sus eventos y los
//      de Google, sus sombreros con su prioridad, sus personas, su semana
//      fija, y lo que el cerebro sabe que tiene que ver con lo dicho. Y la
//      conversación de las últimas horas: puede seguir un hilo.
//   3. El código comprueba lo que propone (src/lib/agente.js) y lo aplica.
//   4. Todo se escribe de una vez: lo creado, lo cambiado, lo borrado, lo
//      aprendido y la tarjeta con lo necesario para «Deshacer».
//   5. Se refleja en Juancito Ads y en Google (reflejar.js), sin que un fallo
//      allá deshaga lo de aquí.
// ============================================================

import { instruccionesParaOrdenar } from "../../src/lib/personalidad.js";
import { leerOrden, aplicarOrden, tarjeta } from "../../src/lib/agente.js";
import { CLAVES_AJUSTE, horariosParaLaIA } from "../../src/lib/ajustes.js";
import { pareceConfidencial } from "../../src/lib/ia.js";
import { hoyEn, sumarDias } from "../../src/lib/fechas.js";
import { sombrerosDe } from "../../src/lib/sombreros.js";
import { paraElAsistente } from "../../src/lib/cerebro.js";
import { llamarModelo, ErrorIA } from "./modelo.js";
import { idDePersona } from "./almacen.js";
import { reflejar } from "./reflejar.js";

const HISTORIAL_MINUTOS = 180;
const HISTORIAL_MENSAJES = 6;

/** La conversación: lo hablado en las últimas horas (lo que dijo y lo que se le contestó) y lo de ahora. */
async function mensajes(almacen, texto, capturaId) {
  const previas = (await almacen.historial(HISTORIAL_MINUTOS, HISTORIAL_MENSAJES)).filter((c) => c.id !== capturaId && c.resultado?.tarjeta);
  const out = [];
  for (const c of previas) {
    out.push({ role: "user", content: c.texto });
    out.push({ role: "assistant", content: c.resultado.tarjeta });
  }
  out.push({ role: "user", content: texto });
  return out;
}

/**
 * Ordena una captura (o contesta un mensaje del chat).
 *   opciones: { momento, despues(promesa) } — `despues` deja seguir lo de Juancito Ads y Google sin hacer esperar
 *   la respuesta (ctx.waitUntil); sin él, se espera.
 */
export async function ordenarCaptura(env, almacen, captura, { momento = new Date(), despues = null } = {}) {
  const inicio = Date.now();
  const [estado, cerebro] = await Promise.all([almacen.estado(), almacen.cerebro()]);
  const hoy = hoyEn(estado.ajustes?.zona, momento);
  const [externos, conexionJ] = await Promise.all([almacen.externosEntre(sumarDias(hoy, -1), sumarDias(hoy, 31)), almacen.conexion("juancito")]);
  const sombreros = sombrerosDe(estado.ajustes);
  const clientes = conexionJ?.datos?.conectada ? conexionJ.datos.clientes ?? [] : [];
  const historial = await mensajes(almacen, captura.texto, captura.id);
  const consulta = historial.filter((m) => m.role === "user").map((m) => m.content).join(" ");
  const memoria = paraElAsistente(cerebro, consulta);
  const confidencial = pareceConfidencial(captura.texto, { personas: estado.personas });
  const system = instruccionesParaOrdenar({
    ajustes: estado.ajustes,
    hoy,
    proyectos: estado.proyectos,
    personas: estado.personas,
    ritmo: estado.ritmo,
    claves: CLAVES_AJUSTE,
    horarios: horariosParaLaIA(estado.ajustes),
    sombreros,
    acciones: estado.acciones,
    eventos: estado.eventos,
    externos,
    cerebro: memoria.texto,
    clientes,
  });

  let respuesta;
  try {
    respuesta = await llamarModelo(env, { funcion: "ordenar", ia: estado.ajustes?.ia ?? {}, confidencial, system, messages: historial });
  } catch (e) {
    const mensaje = e instanceof ErrorIA ? e.message : "No se pudo hablar con la IA.";
    await almacen.marcarCaptura(captura.id, { estado: "error", error: mensaje });
    return { ok: false, error: mensaje, estado: e.estado ?? 502 };
  }
  await almacen.registrarConsumo({ modelo: respuesta.modelo, funcion: "ordenar", entrada: respuesta.entrada, salida: respuesta.salida, costo: respuesta.costo });

  const orden = leerOrden(respuesta.texto, { hoy, texto: captura.texto, proyectos: estado.proyectos, personas: estado.personas, sombreros, acciones: estado.acciones, eventos: estado.eventos, clientes, cerebro });
  if (!orden.ok) {
    await almacen.marcarCaptura(captura.id, { estado: "error", error: orden.error });
    return { ok: false, error: orden.error, estado: 502 };
  }

  const r = aplicarOrden(estado, orden);
  const aprendidos = r.hecho.aprendizajes.map((a, i) => ({ id: `ap-${captura.id}-${i}`, tipo: "aprendido", origen: "asistente", ...a }));
  const texto = tarjeta(r, orden, hoy, { sombreros: sombrerosDe(r.estado.ajustes) }) + (respuesta.aviso ? `\nOjo: ${respuesta.aviso}` : "");
  const ms = Date.now() - inicio;
  const resultado = { tarjeta: texto, pregunta: orden.pregunta, deshacer: { ...r.deshacer, aprendidos: aprendidos.map((a) => a.id) }, modelo: respuesta.modelo, versiculo: orden.versiculo, ms };

  const sentencias = [
    ...[...r.hecho.acciones, ...r.cambiados.acciones].map((a) => almacen.sentenciaElemento("accion", a)),
    ...[...r.hecho.eventos, ...r.cambiados.eventos].map((e) => almacen.sentenciaElemento("evento", e)),
    ...[...r.hecho.proyectos, ...r.cambiados.proyectos].map((p) => almacen.sentenciaElemento("proyecto", p)),
    ...r.hecho.personas.map((p) => almacen.sentenciaElemento("persona", p)),
    ...r.borrados.map((b) => almacen.sentenciaBorrar(b.tipo, b.tipo === "persona" ? idDePersona(b.obj.nombre) : b.obj.id)),
    ...aprendidos.map((a) => almacen.sentenciaNota(a)),
    ...(r.deshacer.ajustes || r.deshacer.ritmo ? [almacen.sentenciaPerfil({ ajustes: r.estado.ajustes, ritmo: r.estado.ritmo })] : []),
    almacen.sentenciaMarcarCaptura(captura.id, { estado: "ordenada", resultado }),
  ];
  await almacen.lote(sentencias);

  // Juancito Ads y Google: lo nuevo, lo cambiado y lo borrado.
  const antesDe = (tipo, id) => r.deshacer.antes.find((x) => x.tipo === tipo && x.obj.id === id)?.obj ?? null;
  const cambios = [
    ...r.hecho.acciones.map((a) => ({ tipo: "accion", antes: null, despues: a })),
    ...r.hecho.eventos.map((e) => ({ tipo: "evento", antes: null, despues: e })),
    ...r.cambiados.acciones.map((a) => ({ tipo: "accion", antes: antesDe("accion", a.id), despues: a })),
    ...r.cambiados.eventos.map((e) => ({ tipo: "evento", antes: antesDe("evento", e.id), despues: e })),
    ...r.borrados.filter((b) => b.tipo === "accion" || b.tipo === "evento").map((b) => ({ tipo: b.tipo, antes: b.obj, despues: null })),
  ];
  const fuera = Promise.all([
    reflejar(env, almacen, cambios, { hoy, ajustes: r.estado.ajustes }).catch(() => null),
    almacen.sumarUsos(memoria.usadas).catch(() => null),
    aprendidos.length ? almacen.recortarAprendidos().catch(() => null) : null,
  ]);
  if (despues) despues(fuera);
  else await fuera;
  return { ok: true, resultado, hecho: r.hecho };
}

/** «Deshacer» lo que hizo una captura: quita lo creado, devuelve lo cambiado y lo borrado a como estaba. */
export async function deshacerCaptura(env, almacen, captura, { hoy } = {}) {
  const d = captura.resultado?.deshacer;
  if (captura.estado !== "ordenada" || !d) return { ok: false, error: "No hay nada que deshacer." };
  // Lo creado, como está AHORA (con su id de Juancito Ads o de Google, si ya subió).
  const creados = [
    ...(await Promise.all(d.acciones.map((id) => almacen.elemento("accion", id)))).filter(Boolean).map((obj) => ({ tipo: "accion", obj })),
    ...(await Promise.all(d.eventos.map((id) => almacen.elemento("evento", id)))).filter(Boolean).map((obj) => ({ tipo: "evento", obj })),
  ];
  const actuales = await Promise.all((d.antes ?? []).map(async (x) => ({ ...x, ahora: await almacen.elemento(x.tipo, x.obj.id) })));
  const sentencias = [
    ...d.acciones.map((id) => almacen.sentenciaBorrar("accion", id)),
    ...d.eventos.map((id) => almacen.sentenciaBorrar("evento", id)),
    ...d.proyectos.map((id) => almacen.sentenciaBorrar("proyecto", id)),
    ...(d.personas ?? []).map((nombre) => almacen.sentenciaBorrar("persona", idDePersona(nombre))),
    ...(d.antes ?? []).map((x) => almacen.sentenciaElemento(x.tipo, x.obj)),
    ...(d.aprendidos ?? []).map((id) => almacen.sentenciaBorrarNota(id)),
  ];
  let ajustes = null;
  if (d.ajustes || d.ritmo) {
    const actual = await almacen.perfil();
    ajustes = d.ajustes ?? actual?.ajustes;
    sentencias.push(almacen.sentenciaPerfil({ ajustes, ritmo: d.ritmo ?? actual?.ritmo }));
  }
  sentencias.push(almacen.sentenciaMarcarCaptura(captura.id, { estado: "deshecha", resultado: { ...captura.resultado, deshecha: true } }));
  await almacen.lote(sentencias);
  // Allá también: lo creado se quita (en Juancito Ads se marca hecho) y lo cambiado vuelve.
  const perfil = ajustes ?? (await almacen.perfil())?.ajustes;
  await reflejar(env, almacen, [
    ...creados.map(({ tipo, obj }) => ({ tipo, antes: obj, despues: null })),
    ...actuales.filter((x) => x.tipo === "accion" || x.tipo === "evento").map((x) => ({ tipo: x.tipo, antes: x.ahora, despues: x.obj })),
  ], { hoy, ajustes: perfil }).catch(() => null);
  return { ok: true };
}
