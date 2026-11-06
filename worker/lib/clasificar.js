// ============================================================
// Poner en su sombrero lo que llega sin él (las tareas que Juan escribe en Google Tasks)
//
// Una llamada corta y barata (la misma función «ordenar», con poco razonamiento) para varias tareas a la vez: el modelo
// dice el sombrero, si es tarea o recordatorio y el proyecto. El CÓDIGO lo comprueba: un sombrero o un proyecto que no
// existe se descarta y la tarea se queda sin sombrero (no se inventa). Si la IA falla, no pasa nada: la tarea ya está
// en la agenda y Juan la cambia con un toque.
// ============================================================

import { llamarModelo, llaves } from "./modelo.js";
import { sombrerosDe } from "../../src/lib/sombreros.js";
import { fichaDe } from "../../src/lib/cerebro.js";
import { sacarJSON } from "../../src/lib/agente.js";

export const MAX_POR_VEZ = 12;

/** El pedido (puro, para probarlo). */
export function pedidoDeClasificar(tareas, { ajustes = {}, proyectos = [], ficha = "" } = {}) {
  const sombreros = sombrerosDe(ajustes);
  const system = [
    `Pones cada tarea de ${ajustes.nombre || "Juan"} en el sombrero (rol de su vida) que le toca.`,
    "SUS SOMBREROS (id · nombre · qué abarca):",
    sombreros.map((s) => `- ${s.id} · ${s.nombre} · ${s.detalle || ""}`).join("\n"),
    "SUS PROYECTOS (id · nombre · sombrero):",
    proyectos.filter((p) => p.estado !== "terminado").slice(0, 60).map((p) => `- ${p.id} · ${p.nombre} · ${p.sombrero ?? ""}`).join("\n") || "- (ninguno)",
    ...(ficha ? ["QUIÉN ES:", ficha.slice(0, 1200)] : []),
    "",
    "Para cada tarea di: el id del sombrero (o null si de verdad no se sabe), «tarea» si es algo que se HACE o «recordatorio» si es algo que hay que tener presente en un día u hora (pagar, felicitar, llevar algo), y el id del proyecto si es claramente de uno (si no, null).",
    'Responde SOLO con JSON: {"tareas":[{"i":0,"sombrero":"id","clase":"tarea","proyecto":null}]}',
  ].join("\n");
  const user = tareas.map((t, i) => `${i}. ${t.titulo}${t.notas ? ` — ${String(t.notas).replace(/\s+/g, " ").slice(0, 200)}` : ""}`).join("\n");
  return { system, messages: [{ role: "user", content: user }] };
}

/** Lo que contestó el modelo, comprobado. Devuelve [{ i, sombrero, clase, proyectoId }]. Puro. */
export function leerClasificacion(texto, n, { ajustes = {}, proyectos = [] } = {}) {
  const datos = sacarJSON(texto);
  const ids = new Set(sombrerosDe(ajustes).map((s) => s.id));
  const out = [];
  for (const x of Array.isArray(datos?.tareas) ? datos.tareas : []) {
    const i = Number(x?.i);
    if (!Number.isInteger(i) || i < 0 || i >= n || out.some((y) => y.i === i)) continue;
    const proyecto = proyectos.find((p) => p.id === x.proyecto);
    out.push({
      i,
      sombrero: ids.has(x.sombrero) ? x.sombrero : null,
      clase: x.clase === "recordatorio" ? "recordatorio" : "tarea",
      proyectoId: proyecto && (!ids.has(x.sombrero) || proyecto.sombrero === x.sombrero) ? proyecto.id : null,
    });
  }
  return out;
}

/** Pone sombrero (y clase y proyecto) a las acciones que llegaron sin él. Devuelve las acciones cambiadas. */
export async function clasificar(env, almacen, acciones, estado) {
  const sin = acciones.filter((a) => !a.sombrero).slice(0, MAX_POR_VEZ);
  const ll = llaves(env);
  if (!sin.length || (!ll.anthropic && !ll.meta)) return [];
  const ficha = fichaDe((await almacen.cerebro().catch(() => [])) ?? [])?.texto ?? "";
  const { system, messages } = pedidoDeClasificar(sin, { ajustes: estado.ajustes, proyectos: estado.proyectos, ficha });
  const r = await llamarModelo(env, { funcion: "ordenar", ia: estado.ajustes?.ia ?? {}, system, messages, max: 1500 });
  await almacen.registrarConsumo({ modelo: r.modelo, funcion: "clasificar", entrada: r.entrada, salida: r.salida, costo: r.costo }).catch(() => null);
  return leerClasificacion(r.texto, sin.length, { ajustes: estado.ajustes, proyectos: estado.proyectos })
    .filter((x) => x.sombrero)
    .map((x) => ({ ...sin[x.i], sombrero: x.sombrero, clase: x.clase, proyectoId: x.proyectoId ?? sin[x.i].proyectoId ?? null }));
}
