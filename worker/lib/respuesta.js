// ============================================================
// Respuestas de la API, con sus cabeceras de seguridad
//
// Las de `public/_headers` valen para el HTML y los recursos, NO para lo que
// genera el Worker (lección del calendario de marketing): lo de /api/* se
// las pone aquí.
// ============================================================

const CABECERAS = Object.freeze({
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
});

export const json = (datos, estado = 200, extra = {}) =>
  new Response(JSON.stringify(datos), { status: estado, headers: { ...CABECERAS, ...extra } });

export const error = (mensaje, estado = 400, extra = {}) => json({ error: mensaje, ...extra }, estado);

export const noEncontrado = (que = "Eso") => error(`${que} no existe.`, 404);

/** El cuerpo JSON de una petición, o null si no lo es. */
export async function cuerpo(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
