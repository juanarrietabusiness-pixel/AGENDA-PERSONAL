// ============================================================
// Los sombreros: los roles de la vida, ahora a la medida de Juan
//
// Son los ROLES (Covey, «Los 7 hábitos», hábito 3): sirven para planear la
// semana, ver si alguno se queda sin tiempo y decidir qué vale más. NO parten
// la pantalla del día: el día es uno, y cada cosa lleva el color de su
// sombrero.
//
// Se pueden renombrar, reordenar, crear y quitar (`ajustes.sombreros`). El
// ORDEN es la prioridad: el primero es el que más pesa cuando dos cosas
// compiten por el mismo tiempo. Los cuatro de partida son los que dio Juan.
// ============================================================

export const SOMBREROS = Object.freeze([
  { id: "trabajo", nombre: "Trabajo", detalle: "Juancito Ads y sus clientes", icono: "building", color: "var(--s-trabajo)", fuente: "juancito-ads" },
  { id: "artistico", nombre: "Artístico", detalle: "Música, presentaciones, ensayos, grabaciones y tu marca personal", icono: "music", color: "var(--s-artistico)", fuente: "aqui" },
  { id: "iglesia", nombre: "Iglesia", detalle: "La célula, los discipulados, el liderazgo y los servicios", icono: "cross", color: "var(--s-iglesia)", fuente: "aqui" },
  { id: "personal", nombre: "Personal", detalle: "Tu esposa, la familia, tus planes y tus proyectos", icono: "heart", color: "var(--s-personal)", fuente: "aqui" },
]);

/** Reino: la intimidad con Dios (oración, la Palabra), aparte de las tareas de la iglesia. Va primero. */
export const REINO = Object.freeze({ id: "reino", nombre: "Reino", detalle: "Tu intimidad con Dios: la oración, la Palabra, el ayuno", icono: "flame", color: "#e0b33a", fuente: "aqui" });

/** Colores para los sombreros nuevos (se leen bien en claro y en oscuro). */
export const COLORES = Object.freeze(["#4d9bff", "#e8619e", "#9b85f5", "#43c07a", "#f2994a", "#22b8b0", "#e0b33a", "#d9534f", "#8a9bb0", "#b06ad9"]);
export const ICONOS = Object.freeze(["building", "music", "cross", "heart", "users", "home", "rocket", "bolt", "bulb", "globe", "star", "chart", "flame"]);
export const MAX_SOMBREROS = 10;

const ID = /^[a-z0-9][a-z0-9-]{1,29}$/;
const COLOR = /^(#[0-9a-fA-F]{6}|var\(--s-[a-z]+\))$/;

export const esIdSombrero = (id) => typeof id === "string" && ID.test(id);
export const IDS_SOMBRERO = Object.freeze(SOMBREROS.map((s) => s.id));

/** El id de un sombrero nuevo a partir de su nombre, sin chocar con los que ya hay. */
export function idPara(nombre, lista = SOMBREROS) {
  const base = String(nombre ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "sombrero";
  let id = base.length < 2 ? `${base}-s` : base;
  for (let n = 2; lista.some((s) => s.id === id); n++) id = `${base}-${n}`;
  return id;
}

/** Limpia una lista guardada: lo que no se entiende se cae; si no queda nada, los de partida. */
export function limpiarSombreros(lista) {
  if (!Array.isArray(lista)) return SOMBREROS.map((s) => ({ ...s }));
  const vistos = new Set();
  const out = [];
  for (const s of lista) {
    if (!s || !esIdSombrero(s.id) || vistos.has(s.id)) continue;
    const nombre = String(s.nombre ?? "").trim().slice(0, 30);
    if (!nombre) continue;
    vistos.add(s.id);
    const base = SOMBREROS.find((x) => x.id === s.id);
    out.push({
      id: s.id,
      nombre,
      detalle: String(s.detalle ?? base?.detalle ?? "").trim().slice(0, 140),
      icono: ICONOS.includes(s.icono) ? s.icono : base?.icono ?? "star",
      color: COLOR.test(String(s.color ?? "")) ? s.color : base?.color ?? COLORES[out.length % COLORES.length],
      fuente: s.fuente === "juancito-ads" ? "juancito-ads" : "aqui",
    });
    if (out.length >= MAX_SOMBREROS) break;
  }
  return out.length ? out : SOMBREROS.map((s) => ({ ...s }));
}

/** Los sombreros de la persona, en su orden de prioridad. */
export const sombrerosDe = (ajustes) => limpiarSombreros(ajustes?.sombreros);

export const sombrero = (id, lista = SOMBREROS) => lista.find((s) => s.id === id) ?? null;
export const esSombrero = (id, lista = SOMBREROS) => lista.some((s) => s.id === id);
export const nombreDe = (id, lista = SOMBREROS) => sombrero(id, lista)?.nombre ?? "Sin sombrero";
/** La prioridad: 1 es el primero. Sin sombrero, después de todos. */
export const prioridadDe = (id, lista = SOMBREROS) => {
  const i = lista.findIndex((s) => s.id === id);
  return i < 0 ? lista.length + 1 : i + 1;
};
/** El estilo que pinta algo con el color de su sombrero. */
export const estiloDe = (id, lista = SOMBREROS) => ({ "--s": sombrero(id, lista)?.color ?? "var(--texto-3)" });

export class ErrorSombrero extends Error {}

/**
 * Cambiar los sombreros, desde la pantalla o el asistente. Puro.
 *   { accion: "crear", nombre, detalle?, color?, icono? }
 *   { accion: "editar", id, nombre?, detalle?, color?, icono? }
 *   { accion: "mover", id, a: posición 1… }      (la prioridad)
 *   { accion: "quitar", id }                       (sólo si nada lo usa: lo comprueba quien llama)
 * Devuelve { lista, sombrero }.
 */
export function aplicarSombrero(lista, cambio = {}) {
  const actual = limpiarSombreros(lista);
  if (cambio.accion === "crear") {
    const nombre = String(cambio.nombre ?? "").trim();
    if (!nombre) throw new ErrorSombrero("Un sombrero nuevo necesita nombre.");
    if (actual.length >= MAX_SOMBREROS) throw new ErrorSombrero(`Caben ${MAX_SOMBREROS} sombreros como mucho.`);
    if (actual.some((s) => s.nombre.toLowerCase() === nombre.toLowerCase())) throw new ErrorSombrero(`Ya hay un sombrero «${nombre}».`);
    const nuevo = limpiarSombreros([{ id: idPara(nombre, actual), nombre, detalle: cambio.detalle ?? "", color: cambio.color ?? COLORES[actual.length % COLORES.length], icono: cambio.icono ?? "star" }])[0];
    return { lista: [...actual, nuevo], sombrero: nuevo };
  }
  const i = actual.findIndex((s) => s.id === cambio.id);
  if (i < 0) throw new ErrorSombrero(`No hay un sombrero «${cambio.id}».`);
  if (cambio.accion === "editar") {
    const s = { ...actual[i] };
    if (cambio.nombre !== undefined) {
      const n = String(cambio.nombre).trim().slice(0, 30);
      if (!n) throw new ErrorSombrero("El nombre no puede quedar vacío.");
      if (actual.some((x, j) => j !== i && x.nombre.toLowerCase() === n.toLowerCase())) throw new ErrorSombrero(`Ya hay un sombrero «${n}».`);
      s.nombre = n;
    }
    if (cambio.detalle !== undefined) s.detalle = String(cambio.detalle).trim().slice(0, 140);
    if (cambio.color !== undefined && COLOR.test(cambio.color)) s.color = cambio.color;
    if (cambio.icono !== undefined && ICONOS.includes(cambio.icono)) s.icono = cambio.icono;
    const nueva = [...actual];
    nueva[i] = s;
    return { lista: nueva, sombrero: s };
  }
  if (cambio.accion === "mover") {
    const a = Math.max(1, Math.min(actual.length, Math.round(Number(cambio.a) || 1)));
    const nueva = [...actual];
    const [s] = nueva.splice(i, 1);
    nueva.splice(a - 1, 0, s);
    return { lista: nueva, sombrero: s };
  }
  if (cambio.accion === "quitar") {
    if (actual.length <= 1) throw new ErrorSombrero("Tiene que quedar al menos un sombrero.");
    return { lista: actual.filter((_, j) => j !== i), sombrero: actual[i] };
  }
  throw new ErrorSombrero("No sé qué hacer con ese sombrero.");
}

/**
 * Cuánto tiempo se llevó cada sombrero: lo que duran sus eventos más lo estimado de lo que se terminó.
 * Devuelve minutos y porcentaje por sombrero. Lo que no tiene sombrero no cuenta.
 */
export function balance({ eventos = [], hechas = [] }, lista = SOMBREROS) {
  const ids = lista.map((s) => s.id);
  const min = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const e of eventos) if (e.sombrero in min) min[e.sombrero] += Math.max(0, Number(e.minutos) || 0);
  for (const a of hechas) if (a.sombrero in min) min[a.sombrero] += Math.max(0, Number(a.minutos) || 15);
  const total = Object.values(min).reduce((s, n) => s + n, 0);
  return ids.map((id) => ({ id, minutos: min[id], porcentaje: total ? Math.round((min[id] / total) * 100) : 0 }));
}

/** Los sombreros que la semana dejó casi sin tiempo (menos del `umbral` %): lo que la revisión semanal pregunta. */
export function descuidados(filas, umbral = 8) {
  const total = filas.reduce((s, f) => s + f.minutos, 0);
  if (!total) return [];
  return filas.filter((f) => f.porcentaje < umbral).map((f) => f.id);
}

// ------------------------------------------------------------
// Las listas de Google Tasks y los sombreros
// ------------------------------------------------------------

const planoLista = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/** Un nombre para compararlo: sin tildes, sin «el», «la», «mis»… y en singular («EL REINO» = «Reino», «PERSONALES» = «Personal»). */
export function nombreParecido(t) {
  return planoLista(t)
    .replace(/^(el|la|los|las|mi|mis|my)\s+/, "")
    .split(/\s+/)
    .map((p) => (p.length > 4 && p.endsWith("es") ? p.slice(0, -2) : p.length > 3 && p.endsWith("s") ? p.slice(0, -1) : p))
    .join(" ");
}

/**
 * El sombrero de una lista de Google Tasks: el que Juan le escogió (`enlaces[lista.id]`: un sombrero, o «no» para no
 * traerla) o, si no escogió, el que se llama parecido. Puro.
 */
export function sombreroDeLista(lista, sombreros, enlaces = {}) {
  const fijado = enlaces?.[lista?.id];
  if (fijado === "no") return null;
  if (fijado && sombreros.some((s) => s.id === fijado)) return fijado;
  const n = nombreParecido(lista?.nombre);
  return sombreros.find((s) => nombreParecido(s.nombre) === n || s.id === n)?.id ?? null;
}
