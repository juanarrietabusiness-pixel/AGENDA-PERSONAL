// ============================================================
// Hablar con el Worker. Todo va al MISMO origen (/api/*) con la cookie de la
// sesión; ninguna llave pasa por aquí.
// ============================================================

export class SinServidor extends Error {}

async function pedir(ruta, { metodo = "GET", datos } = {}) {
  let res;
  try {
    res = await fetch(`/api/${ruta}`, {
      method: metodo,
      credentials: "same-origin",
      headers: datos !== undefined ? { "content-type": "application/json" } : {},
      body: datos !== undefined ? JSON.stringify(datos) : undefined,
    });
  } catch (e) {
    throw new SinServidor("No hay servidor.", { cause: e });
  }
  const tipo = res.headers.get("content-type") ?? "";
  // `npm run dev` sirve sólo la interfaz: /api/* devuelve el index.html. Eso es «sin servidor», no un error.
  if (!tipo.includes("application/json")) throw new SinServidor("No hay servidor.");
  const cuerpo = await res.json();
  return { estado: res.status, ok: res.ok, ...cuerpo };
}

export const arranque = () => pedir("arranque");
export const alta = (datos) => pedir("alta", { metodo: "POST", datos });
export const entrar = (email, contrasena) => pedir("acceso", { metodo: "POST", datos: { email, contrasena } });
export const salir = () => pedir("salir", { metodo: "POST", datos: {} });
export const estado = () => pedir("estado");
export const guardarElemento = (tipo, obj) =>
  pedir(`elementos/${tipo}/${encodeURIComponent(tipo === "persona" ? obj.nombre : obj.id)}`, { metodo: "PUT", datos: obj });
export const borrarElemento = (tipo, id) => pedir(`elementos/${tipo}/${encodeURIComponent(id)}`, { metodo: "DELETE" });
export const guardarPerfil = (perfil) => pedir("perfil", { metodo: "PUT", datos: perfil });
export const capturar = (texto, canal = "app") => pedir("capturas", { metodo: "POST", datos: { texto, canal } });
export const reordenar = (id) => pedir(`capturas/${id}/ordenar`, { metodo: "POST", datos: {} });
export const deshacer = (id) => pedir(`capturas/${id}/deshacer`, { metodo: "POST", datos: {} });
export const borrarCaptura = (id) => pedir(`capturas/${id}`, { metodo: "DELETE" });
export const telegram = () => pedir("telegram");
export const conectarTelegram = () => pedir("telegram/conectar", { metodo: "POST", datos: {} });
export const desconectarTelegram = () => pedir("telegram/desconectar", { metodo: "POST", datos: {} });

/** Lo que cambió entre dos estados, como peticiones al servidor. Puro (lo prueba tests/api.test.js). */
export function cambiosEntre(antes, despues) {
  const ops = [];
  const listas = [["acciones", "accion", "id"], ["proyectos", "proyecto", "id"], ["eventos", "evento", "id"], ["personas", "persona", "nombre"]];
  for (const [lista, tipo, clave] of listas) {
    const a = new Map((antes[lista] ?? []).map((x) => [x[clave], x]));
    const d = new Map((despues[lista] ?? []).map((x) => [x[clave], x]));
    for (const [id, obj] of d) if (!a.has(id) || JSON.stringify(a.get(id)) !== JSON.stringify(obj)) ops.push({ op: "guardar", tipo, obj });
    for (const id of a.keys()) if (!d.has(id)) ops.push({ op: "borrar", tipo, id });
  }
  if (JSON.stringify(antes.ajustes) !== JSON.stringify(despues.ajustes) || JSON.stringify(antes.ritmo) !== JSON.stringify(despues.ritmo)) {
    ops.push({ op: "perfil", perfil: { ajustes: despues.ajustes, ritmo: despues.ritmo } });
  }
  const bandejaDespues = new Set((despues.bandeja ?? []).map((c) => c.id));
  for (const c of antes.bandeja ?? []) if (!bandejaDespues.has(c.id)) ops.push({ op: "borrarCaptura", id: c.id });
  return ops;
}

export async function aplicarCambios(ops) {
  const fallos = [];
  for (const o of ops) {
    try {
      const r =
        o.op === "guardar" ? await guardarElemento(o.tipo, o.obj)
          : o.op === "borrar" ? await borrarElemento(o.tipo, o.id)
            : o.op === "perfil" ? await guardarPerfil(o.perfil)
              : await borrarCaptura(o.id);
      if (!r.ok && r.estado !== 404) fallos.push(r.error ?? "No se pudo guardar.");
    } catch (e) {
      fallos.push(e.message);
    }
  }
  return fallos;
}
