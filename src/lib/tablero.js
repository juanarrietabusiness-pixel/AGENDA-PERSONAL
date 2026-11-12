// ============================================================
// Tareas: el panorama completo
//
// Todas las tareas abiertas, una columna por sombrero (en el orden de tus sombreros), y dentro de cada una: las
// sueltas, las de cada empresa (lo que viene de Juancito Ads trae su cliente) y las de cada proyecto. El ORDEN de una
// columna lo pones tú arrastrando (`orden`); lo que todavía no ordenaste va arriba, por prioridad: es lo nuevo.
// Todo puro: la pantalla sólo pinta.
// ============================================================

import { ordenarPor } from "./agenda.js";
import { lunesDe, sumarDias } from "./fechas.js";
import { limpiarEtiquetas } from "./metodo.js";

export const FILTROS = Object.freeze({
  todo: "Todo",
  hoy: "Hoy",
  semana: "Esta semana",
  sinFecha: "Sin fecha",
  vencidas: "Vencidas",
  espera: "Esperando a otros",
  algun: "Algún día",
});

const LISTAS_TABLERO = ["siguientes", "espera", "algun-dia"];
const plano = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** ¿Pasa el filtro? «Hoy» y «Esta semana» incluyen lo que quedó de antes; «Vencidas» es sólo fecha límite real. */
export function pasaFiltro(a, filtro, hoy) {
  const fecha = a.cuando ?? a.limite;
  switch (filtro) {
    case "hoy":
      return a.lista !== "algun-dia" && (a.enfoque === hoy || (Boolean(a.cuando) && a.cuando <= hoy) || (Boolean(a.limite) && a.limite <= hoy));
    case "semana":
      return a.lista !== "algun-dia" && Boolean(fecha) && fecha <= sumarDias(lunesDe(hoy), 6);
    case "sinFecha":
      return a.lista === "siguientes" && !a.cuando && !a.limite;
    case "vencidas":
      return Boolean(a.limite) && a.limite < hoy;
    case "espera":
      return a.lista === "espera";
    case "algun":
      return a.lista === "algun-dia";
    default:
      return true;
  }
}

/** En el orden de la columna: primero lo que aún no ordenaste (por prioridad), después lo ordenado por ti. */
export function enOrden(tareas, ctx) {
  const ordenadas = tareas.filter((a) => Number.isFinite(a.orden)).sort((a, b) => a.orden - b.orden);
  return [...ordenarPor(tareas.filter((a) => !Number.isFinite(a.orden)), "prioridad", ctx), ...ordenadas];
}

const esTarea = (a) => (a.clase ?? "tarea") === "tarea";

/**
 * Las columnas: [{ id, nombre, total, grupos: [{ clave, tipo: "sueltas" | "empresa" | "proyecto", titulo, proyecto?,
 * tareas }], hechas }]. Con `filtro` y `buscar`. Una columna «Sin sombrero» si hay algo sin sombrero.
 */
export function tablero(acciones, { sombreros, proyectos = [], filtro = "todo", buscar = "", etiqueta = null, hoy }) {
  const q = plano(buscar).trim();
  const ids = new Set(sombreros.map((s) => s.id));
  const busca = (a) => (!q || plano(`${a.titulo} ${a.notas ?? ""} ${a.cliente ?? ""} ${(a.etiquetas ?? []).join(" ")}`).includes(q)) && (!etiqueta || tieneEtiqueta(a, etiqueta));
  const abiertas = acciones.filter((a) => a.estado === "abierta" && esTarea(a) && LISTAS_TABLERO.includes(a.lista) && pasaFiltro(a, filtro, hoy) && busca(a));
  const hechas = acciones.filter((a) => a.estado === "hecha" && esTarea(a) && busca(a));
  const ctx = { hoy, proyectos, sombreros };
  const deCol = (id) => (a) => (id ? a.sombrero === id : !ids.has(a.sombrero));
  const cols = [...sombreros.map((s) => ({ id: s.id, nombre: s.nombre })), ...(abiertas.some(deCol(null)) ? [{ id: null, nombre: "Sin sombrero" }] : [])];
  return cols.map((c) => {
    const suyas = abiertas.filter(deCol(c.id));
    const activos = proyectos.filter((p) => p.estado !== "terminado" && (c.id ? p.sombrero === c.id : false));
    const enProyecto = (a) => activos.some((p) => p.id === a.proyectoId);
    const grupos = [{ clave: "sueltas", tipo: "sueltas", titulo: null, tareas: enOrden(suyas.filter((a) => !enProyecto(a) && !a.cliente), ctx) }];
    const empresas = [...new Set(suyas.filter((a) => !enProyecto(a) && a.cliente).map((a) => a.cliente))].sort((a, b) => a.localeCompare(b, "es"));
    for (const e of empresas) grupos.push({ clave: `c:${e}`, tipo: "empresa", titulo: e, tareas: enOrden(suyas.filter((a) => !enProyecto(a) && a.cliente === e), ctx) });
    // Los proyectos salen aunque no tengan nada en el filtro «Todo»: uno sin siguiente paso es justo lo que hay que ver.
    for (const p of activos) {
      const delP = enOrden(suyas.filter((a) => a.proyectoId === p.id), ctx);
      const delProyecto = acciones.filter((a) => a.proyectoId === p.id && esTarea(a) && a.estado !== "soltada");
      const avance = { hechos: delProyecto.filter((a) => a.estado === "hecha").length, total: delProyecto.length };
      if (delP.length || (filtro === "todo" && !q && !etiqueta)) grupos.push({ clave: `p:${p.id}`, tipo: "proyecto", titulo: p.nombre, proyecto: p, tareas: delP, avance });
    }
    return {
      ...c,
      total: suyas.length,
      grupos,
      hechas: hechas.filter(deCol(c.id)).sort((a, b) => String(b.hechaEl ?? "").localeCompare(String(a.hechaEl ?? ""))),
    };
  });
}

/** Pone `orden` a esas tareas en ese orden (de 10 en 10, para que quepan otras entre medias). */
export function reordenar(acciones, idsEnOrden) {
  const pos = new Map(idsEnOrden.map((id, i) => [id, (i + 1) * 10]));
  return acciones.map((a) => (pos.has(a.id) ? { ...a, orden: pos.get(a.id) } : a));
}

/**
 * Soltar una tarea en el tablero: en otra columna cambia de sombrero; en un grupo de proyecto pasa a ese proyecto; en
 * las sueltas o en una empresa sale del proyecto. `antesDe` es la tarea delante de la que cae (null: al final del
 * grupo). Devuelve las acciones nuevas.
 */
export function soltarEnTablero(acciones, { id, columna, grupo, antesDe = null, proyectos = [] }) {
  const a = acciones.find((x) => x.id === id);
  if (!a) return acciones;
  const proyectoId = grupo?.tipo === "proyecto" ? grupo.proyecto.id : grupo ? null : a.proyectoId;
  const deOtro = proyectoId && proyectos.find((p) => p.id === proyectoId)?.sombrero !== columna.id;
  const movida = { ...a, sombrero: columna.id ?? a.sombrero, proyectoId: deOtro ? null : proyectoId };
  const lista = acciones.map((x) => (x.id === id ? movida : x));
  if (!grupo) return lista;
  const ids = grupo.tareas.map((x) => x.id).filter((x) => x !== id);
  const i = antesDe ? ids.indexOf(antesDe) : -1;
  ids.splice(i < 0 ? ids.length : i, 0, id);
  return reordenar(lista, ids);
}

/** Subir o bajar una tarea un puesto dentro de su grupo (con el teclado: Alt + ↑ / ↓). */
export function moverUnPuesto(acciones, grupo, id, paso) {
  const ids = grupo.tareas.map((x) => x.id);
  const i = ids.indexOf(id);
  const j = i + paso;
  if (i < 0 || j < 0 || j >= ids.length) return acciones;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return reordenar(acciones, ids);
}

// ------------------------------------------------------------
// Etiquetas y subtareas
// ------------------------------------------------------------

/** ¿Lleva esa etiqueta? La empresa (cliente de Juancito Ads) cuenta como etiqueta. */
export const tieneEtiqueta = (a, etiqueta) => (a.etiquetas ?? []).includes(etiqueta) || plano(a.cliente ?? "") === plano(etiqueta);

/** «Llamar a Pedro #llamadas #iglesia» → { titulo: "Llamar a Pedro", etiquetas: ["llamadas", "iglesia"] }. */
export function leerEtiquetas(texto) {
  const etiquetas = [...String(texto ?? "").matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((m) => m[1]);
  const titulo = String(texto ?? "").replace(/#[\p{L}\p{N}_-]+/gu, "").replace(/\s{2,}/g, " ").trim();
  return { titulo, etiquetas: limpiarEtiquetas(etiquetas) };
}

/** Las etiquetas en uso (las tuyas y las empresas), con cuántas tareas abiertas lleva cada una. */
export function etiquetasEnUso(acciones) {
  const cuenta = new Map();
  const sumar = (nombre, tipo) => {
    const k = `${tipo}:${nombre}`;
    cuenta.set(k, { nombre, tipo, n: (cuenta.get(k)?.n ?? 0) + 1 });
  };
  for (const a of acciones) {
    if (a.estado !== "abierta" || !esTarea(a)) continue;
    for (const e of a.etiquetas ?? []) sumar(e, "propia");
    if (a.cliente) sumar(a.cliente, "empresa");
  }
  return [...cuenta.values()].sort((x, y) => (x.tipo === y.tipo ? x.nombre.localeCompare(y.nombre, "es") : x.tipo === "propia" ? -1 : 1));
}

let pasoN = 0;
/** Añadir un paso a una tarea (sin texto, no cambia nada). */
export const agregarPaso = (a, texto) => {
  const t = String(texto ?? "").trim().slice(0, 200);
  return t ? { ...a, pasos: [...(a.pasos ?? []), { id: `p-${Date.now().toString(36)}-${(pasoN++).toString(36)}`, texto: t, hecho: false }].slice(0, 30) } : a;
};
/** Marcar o desmarcar un paso. */
export const alternarPaso = (a, id) => ({ ...a, pasos: (a.pasos ?? []).map((p) => (p.id === id ? { ...p, hecho: !p.hecho } : p)) });
/** Quitar un paso. */
export const quitarPaso = (a, id) => ({ ...a, pasos: (a.pasos ?? []).filter((p) => p.id !== id) });
