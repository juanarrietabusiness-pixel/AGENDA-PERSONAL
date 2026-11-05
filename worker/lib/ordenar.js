// ============================================================
// Ordenar una captura: de lo que dijo Juan a lo que queda guardado
//
//   1. La captura YA está guardada (si algo falla, queda en la Bandeja).
//   2. El asistente la lee con su vida delante: proyectos, personas, su
//      semana fija, sus horarios y los próximos 14 días con su nombre.
//   3. El código comprueba lo que propone (src/lib/agente.js) y lo aplica.
//   4. Todo se escribe de una vez, y la captura guarda la tarjeta y lo
//      necesario para «Deshacer».
// ============================================================

import { instruccionesParaOrdenar } from "../../src/lib/personalidad.js";
import { leerOrden, aplicarOrden, tarjeta } from "../../src/lib/agente.js";
import { CLAVES_AJUSTE, horariosParaLaIA } from "../../src/lib/ajustes.js";
import { pareceConfidencial } from "../../src/lib/ia.js";
import { hoyEn } from "../../src/lib/fechas.js";
import { llamarModelo, ErrorIA } from "./modelo.js";
import { idDePersona } from "./almacen.js";

/** Lo que el asistente recibe como conversación: lo de hace un momento (si preguntó algo) y lo de ahora. */
async function mensajes(almacen, texto, capturaId) {
  const previa = await almacen.ultimaReciente(15);
  if (previa && previa.id !== capturaId && previa.resultado?.pregunta) {
    return [
      { role: "user", content: previa.texto },
      { role: "assistant", content: previa.resultado.tarjeta ?? previa.resultado.pregunta },
      { role: "user", content: texto },
    ];
  }
  return [{ role: "user", content: texto }];
}

export async function ordenarCaptura(env, almacen, captura, { momento = new Date() } = {}) {
  const estado = await almacen.estado();
  const hoy = hoyEn(estado.ajustes?.zona, momento);
  const confidencial = pareceConfidencial(captura.texto, { personas: estado.personas });
  const system = instruccionesParaOrdenar({
    ajustes: estado.ajustes,
    hoy,
    proyectos: estado.proyectos,
    personas: estado.personas,
    ritmo: estado.ritmo,
    claves: CLAVES_AJUSTE,
    horarios: horariosParaLaIA(estado.ajustes),
  });

  let respuesta;
  try {
    respuesta = await llamarModelo(env, {
      funcion: "ordenar",
      ia: estado.ajustes?.ia ?? {},
      confidencial,
      system,
      messages: await mensajes(almacen, captura.texto, captura.id),
    });
  } catch (e) {
    const mensaje = e instanceof ErrorIA ? e.message : "No se pudo hablar con la IA.";
    await almacen.marcarCaptura(captura.id, { estado: "error", error: mensaje });
    return { ok: false, error: mensaje, estado: e.estado ?? 502 };
  }
  await almacen.registrarConsumo({ modelo: respuesta.modelo, funcion: "ordenar", entrada: respuesta.entrada, salida: respuesta.salida, costo: respuesta.costo });

  const orden = leerOrden(respuesta.texto, { hoy, texto: captura.texto, proyectos: estado.proyectos, personas: estado.personas });
  if (!orden.ok) {
    await almacen.marcarCaptura(captura.id, { estado: "error", error: orden.error });
    return { ok: false, error: orden.error, estado: 502 };
  }

  const r = aplicarOrden(estado, orden);
  const texto = tarjeta(r, orden, hoy) + (respuesta.aviso ? `\nOjo: ${respuesta.aviso}` : "");
  const resultado = { tarjeta: texto, pregunta: orden.pregunta, deshacer: r.deshacer, modelo: respuesta.modelo, versiculo: orden.versiculo };

  const sentencias = [
    ...r.hecho.acciones.map((a) => almacen.sentenciaElemento("accion", a)),
    ...r.hecho.eventos.map((e) => almacen.sentenciaElemento("evento", e)),
    ...r.hecho.proyectos.map((p) => almacen.sentenciaElemento("proyecto", p)),
    ...r.hecho.personas.map((p) => almacen.sentenciaElemento("persona", p)),
    ...(r.deshacer.ajustes || r.deshacer.ritmo ? [almacen.sentenciaPerfil({ ajustes: r.estado.ajustes, ritmo: r.estado.ritmo })] : []),
    almacen.sentenciaMarcarCaptura(captura.id, { estado: "ordenada", resultado }),
  ];
  await almacen.lote(sentencias);
  return { ok: true, resultado, hecho: r.hecho };
}

/** «Deshacer» lo que hizo una captura: borra lo que creó y devuelve los ajustes y el ritmo a como estaban. */
export async function deshacerCaptura(almacen, captura) {
  const d = captura.resultado?.deshacer;
  if (captura.estado !== "ordenada" || !d) return { ok: false, error: "No hay nada que deshacer." };
  const sentencias = [
    ...d.acciones.map((id) => almacen.sentenciaBorrar("accion", id)),
    ...d.eventos.map((id) => almacen.sentenciaBorrar("evento", id)),
    ...d.proyectos.map((id) => almacen.sentenciaBorrar("proyecto", id)),
    ...(d.personas ?? []).map((nombre) => almacen.sentenciaBorrar("persona", idDePersona(nombre))),
  ];
  if (d.ajustes || d.ritmo) {
    const actual = await almacen.perfil();
    sentencias.push(almacen.sentenciaPerfil({ ajustes: d.ajustes ?? actual?.ajustes, ritmo: d.ritmo ?? actual?.ritmo }));
  }
  sentencias.push(almacen.sentenciaMarcarCaptura(captura.id, { estado: "deshecha", resultado: { ...captura.resultado, deshecha: true } }));
  await almacen.lote(sentencias);
  return { ok: true };
}
