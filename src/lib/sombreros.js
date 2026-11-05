// ============================================================
// Los cuatro sombreros
//
// Son los ROLES de la vida (Covey, «Los 7 hábitos», hábito 3): sirven para
// PLANEAR la semana —qué piedra grande pone cada sombrero— y para ver si
// alguno se está quedando sin tiempo. NO parten la pantalla del día: el día
// es uno solo, y cada cosa lleva el color de su sombrero.
//
// El orden es el que dio Juan y no significa prioridad.
// ============================================================

export const SOMBREROS = Object.freeze([
  {
    id: "trabajo",
    nombre: "Trabajo",
    detalle: "Juancito Ads y sus clientes",
    icono: "building",
    // Las tareas viven en Juancito Ads; aquí se leen.
    fuente: "juancito-ads",
  },
  {
    id: "artistico",
    nombre: "Artístico",
    detalle: "Música, presentaciones, ensayos, grabaciones y tu marca personal",
    icono: "music",
    fuente: "aqui",
  },
  {
    id: "iglesia",
    nombre: "Iglesia",
    detalle: "La célula, los discipulados, el liderazgo y los servicios",
    icono: "cross",
    fuente: "aqui",
  },
  {
    id: "personal",
    nombre: "Personal",
    detalle: "Tu esposa, la familia, tus planes y tus proyectos",
    icono: "heart",
    fuente: "aqui",
  },
]);

export const IDS_SOMBRERO = Object.freeze(SOMBREROS.map((s) => s.id));
export const sombrero = (id) => SOMBREROS.find((s) => s.id === id) ?? null;
export const esSombrero = (id) => IDS_SOMBRERO.includes(id);

/**
 * Cuánto tiempo se llevó cada sombrero: lo que duran sus eventos más lo estimado de lo que se terminó.
 * Devuelve minutos y porcentaje por sombrero. Lo que no tiene sombrero no cuenta.
 */
export function balance({ eventos = [], hechas = [] }) {
  const min = Object.fromEntries(IDS_SOMBRERO.map((id) => [id, 0]));
  for (const e of eventos) if (esSombrero(e.sombrero)) min[e.sombrero] += Math.max(0, Number(e.minutos) || 0);
  for (const a of hechas) if (esSombrero(a.sombrero)) min[a.sombrero] += Math.max(0, Number(a.minutos) || 15);
  const total = Object.values(min).reduce((s, n) => s + n, 0);
  return IDS_SOMBRERO.map((id) => ({
    id,
    minutos: min[id],
    porcentaje: total ? Math.round((min[id] / total) * 100) : 0,
  }));
}

/** Los sombreros que la semana dejó casi sin tiempo (menos del `umbral` %): lo que la revisión semanal pregunta. */
export function descuidados(filas, umbral = 8) {
  const total = filas.reduce((s, f) => s + f.minutos, 0);
  if (!total) return [];
  return filas.filter((f) => f.porcentaje < umbral).map((f) => f.id);
}
