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
export const recuperarPorTelegram = () => pedir("recuperar/telegram", { metodo: "POST", datos: {} });
export const recuperarConEnlace = (token, contrasena) => pedir("recuperar/enlace", { metodo: "POST", datos: { token, contrasena } });
export const recuperarConCodigo = (codigo, contrasena) => pedir("recuperar/codigo", { metodo: "POST", datos: { codigo, contrasena } });
export const cambiarContrasena = (actual, nueva) => pedir("contrasena", { metodo: "PUT", datos: { actual, nueva } });
export const estado = () => pedir("estado");
export const guardarElemento = (tipo, obj) =>
  pedir(`elementos/${tipo}/${encodeURIComponent(tipo === "persona" ? obj.nombre : obj.id)}`, { metodo: "PUT", datos: obj });
export const borrarElemento = (tipo, id) => pedir(`elementos/${tipo}/${encodeURIComponent(id)}`, { metodo: "DELETE" });
export const guardarPerfil = (perfil) => pedir("perfil", { metodo: "PUT", datos: perfil });
export const capturar = (texto, canal = "app") => pedir("capturas", { metodo: "POST", datos: { texto, canal } });
export const reordenar = (id) => pedir(`capturas/${id}/ordenar`, { metodo: "POST", datos: {} });
export const deshacer = (id) => pedir(`capturas/${id}/deshacer`, { metodo: "POST", datos: {} });
export const borrarCaptura = (id) => pedir(`capturas/${id}`, { metodo: "DELETE" });
export const estadoEntre = (desde, hasta) => pedir(`estado?desde=${desde}&hasta=${hasta}`);
export const mentor = () => pedir("mentor", { metodo: "POST", datos: {} });
export const guardarNota = (id, nota) => pedir(`cerebro/${encodeURIComponent(id)}`, { metodo: "PUT", datos: nota });
export const borrarNota = (id) => pedir(`cerebro/${encodeURIComponent(id)}`, { metodo: "DELETE" });
export const juancitoConectar = () => pedir("juancito/conectar", { metodo: "POST", datos: {} });
export const juancitoSincronizar = () => pedir("juancito/sincronizar", { metodo: "POST", datos: {} });
export const juancitoAjustes = (datos) => pedir("juancito/ajustes", { metodo: "PUT", datos });
export const juancitoDesconectar = () => pedir("juancito/desconectar", { metodo: "POST", datos: {} });
export const googleConectar = () => pedir("google/conectar", { metodo: "POST", datos: {} });
export const googleSincronizar = () => pedir("google/sincronizar", { metodo: "POST", datos: {} });
export const googleAjustes = (cuenta, datos) => pedir(`google/${encodeURIComponent(cuenta)}`, { metodo: "PUT", datos });
export const googleDesconectar = (cuenta) => pedir(`google/${encodeURIComponent(cuenta)}`, { metodo: "DELETE" });
export const mcpCliente = (clientId, redirectUri) => pedir(`mcp/cliente?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`);
export const mcpAutorizar = (datos) => pedir("mcp/autorizar", { metodo: "POST", datos });
export const mcpConexiones = () => pedir("mcp/conexiones");
export const mcpDesconectar = () => pedir("mcp/desconectar", { metodo: "POST", datos: {} });
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
