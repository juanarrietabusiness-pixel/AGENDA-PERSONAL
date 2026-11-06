// ============================================================
// La agenda como MCP: capturar desde Claude
//
// Claude.ai (o Claude Code) se conecta como al calendario de marketing: lee
// los metadatos de /.well-known, se registra solo, abre la pantalla de permiso
// de la agenda (/autorizar, con la sesión de siempre) y recibe un token.
//
// Herramientas:
//   · capturar    — lo que Juan diga en lenguaje natural, por el MISMO
//                   asistente que la app y Telegram (crear, mover, completar,
//                   editar, preguntar): lo de Claude se ordena igual.
//   · ver_agenda  — hoy, mañana, la semana o el mes, con ids.
//   · completar   — marcar hecha una tarea por su id (también allá, si es de
//                   Juancito Ads o de Google).
//   · buscar      — en sus tareas, eventos, proyectos y en lo que el
//                   asistente sabe de él.
// ============================================================

import { json, cuerpo } from "./respuesta.js";
import { registrarClienteMCP, canjearCodigoMCP, renovarTokenMCP, duenoDeTokenMCP, ipDe, demasiadosFallos, apuntarFallo } from "./sesion.js";
import { crearAlmacen } from "./almacen.js";
import { ordenarCaptura } from "./ordenar.js";
import { reflejar } from "./reflejar.js";
import { hoyEn, sumarDias, textoCorto, textoHora } from "../../src/lib/fechas.js";
import { completar as completarAccion } from "../../src/lib/metodo.js";
import { rango, accionesDelPeriodo, reunionesDelPeriodo, especialesDelMes, ordenarPor, sinFecha } from "../../src/lib/agenda.js";
import { sombrerosDe, nombreDe } from "../../src/lib/sombreros.js";
import { buscar as buscarCerebro, fold } from "../../src/lib/cerebro.js";

const VERSIONES = ["2025-06-18", "2025-03-26", "2024-11-05"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};
const conCors = (datos, estado = 200, extra = {}) => json(datos, estado, { ...CORS, ...extra });
const errorOAuth = (codigo, descripcion, estado = 400) => conCors({ error: codigo, error_description: descripcion }, estado);
const origenDe = (req) => new URL(req.url).origin;

export const INSTRUCCIONES =
  "La agenda personal de Juan: sus tareas, recordatorios, reuniones y proyectos de sus sombreros (trabajo, artístico, iglesia, personal). " +
  "Para agendar, cambiar o preguntar algo, usa `capturar` con lo que él dijo tal cual: el asistente de la agenda lo ordena (fechas, sombrero, proyecto) y contesta qué hizo. " +
  "Para ver lo que tiene, `ver_agenda`. Las horas son de Panamá.";

export const HERRAMIENTAS = Object.freeze([
  {
    name: "capturar",
    description: "Pasa lo que Juan dijo al asistente de su agenda, en sus palabras: agendar una reunión, un recordatorio, una tarea con fecha, una idea; marcar algo hecho, moverlo o cambiarlo; o preguntarle algo. Devuelve lo que hizo, con lo que se puede deshacer en la app.",
    inputSchema: { type: "object", properties: { texto: { type: "string", description: "Lo que dijo Juan, tal cual." } }, required: ["texto"] },
  },
  {
    name: "ver_agenda",
    description: "Las tareas (por prioridad), recordatorios, reuniones y eventos especiales de hoy, mañana, la semana o el mes, con sus ids.",
    inputSchema: { type: "object", properties: { periodo: { type: "string", enum: ["hoy", "manana", "semana", "mes"] } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "completar",
    description: "Marca hecha una tarea o un recordatorio por su id (el de ver_agenda). Si es de Juancito Ads o de Google, se marca también allá.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "buscar",
    description: "Busca en sus tareas, eventos y proyectos (abiertos o no) y en lo que el asistente sabe de él.",
    inputSchema: { type: "object", properties: { texto: { type: "string" } }, required: ["texto"] },
    annotations: { readOnlyHint: true },
  },
]);

/** Los metadatos que Claude lee para saber cómo conectarse. */
export function metadatos(req) {
  const o = origenDe(req);
  return {
    recurso: { resource: `${o}/mcp`, authorization_servers: [o], bearer_methods_supported: ["header"], resource_name: "Agenda personal" },
    servidor: {
      issuer: o,
      authorization_endpoint: `${o}/autorizar`,
      token_endpoint: `${o}/oauth/token`,
      registration_endpoint: `${o}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["agenda"],
    },
  };
}

async function leerFormulario(req) {
  const tipo = req.headers.get("content-type") ?? "";
  if (tipo.includes("application/json")) return (await cuerpo(req)) ?? {};
  try {
    return Object.fromEntries(new URLSearchParams(await req.text()));
  } catch {
    return {};
  }
}

const linea = (a, sombreros, hoy) =>
  `· ${a.titulo} [${nombreDe(a.sombrero, sombreros)}]${a.cuando ? ` · ${textoCorto(a.cuando, hoy)}` : ""}${a.hora ? ` ${textoHora(a.hora)}` : ""}${a.limite ? ` · vence ${textoCorto(a.limite, hoy)}` : ""}${a.valor ? ` · valor ${a.valor}` : ""}${a.estado === "hecha" ? " (hecha)" : ""} (id ${a.id})`;

/** Las herramientas, con la cuenta ya resuelta. */
export function crearHerramientas({ env, ownerId, despues }) {
  const almacen = crearAlmacen(env.DB, ownerId);
  return {
    async capturar({ texto }) {
      const t = String(texto ?? "").trim();
      if (!t) throw new Error("Falta qué capturar.");
      const captura = await almacen.crearCaptura({ id: crypto.randomUUID(), texto: t.slice(0, 4000), canal: "claude" });
      const r = await ordenarCaptura(env, almacen, captura, { despues });
      return r.ok ? r.resultado.tarjeta : `Quedó en la Bandeja de la agenda, pero no se pudo ordenar: ${r.error}`;
    },

    async ver_agenda({ periodo = "hoy" }) {
      const estado = await almacen.estado({ completo: false });
      const hoy = hoyEn(estado.ajustes?.zona);
      const sombreros = sombrerosDe(estado.ajustes);
      const dia = periodo === "manana" ? sumarDias(hoy, 1) : hoy;
      const r = rango(periodo === "semana" ? "semana" : periodo === "mes" ? "mes" : "dia", dia);
      const ctx = { hoy, proyectos: estado.proyectos, sombreros };
      const tareas = accionesDelPeriodo(estado.acciones, { ...r, hoy, clase: "tarea" });
      const recs = accionesDelPeriodo(estado.acciones, { ...r, hoy, clase: "recordatorio" });
      const mes = rango("mes", dia);
      const externos = await almacen.externosEntre(r.desde < mes.desde ? r.desde : mes.desde, r.hasta > mes.hasta ? r.hasta : mes.hasta);
      const reuniones = reunionesDelPeriodo(estado.eventos, externos, r);
      const especiales = especialesDelMes(estado.acciones, estado.eventos, dia, externos);
      const partes = [
        `Agenda de ${periodo === "manana" ? "mañana" : periodo === "hoy" ? "hoy" : `la ${periodo}`} (${r.desde}${r.hasta !== r.desde ? ` a ${r.hasta}` : ""}).`,
        `TAREAS (por prioridad):\n${ordenarPor(tareas.abiertas, "prioridad", ctx).map((a) => linea(a, sombreros, hoy)).join("\n") || "(ninguna)"}`,
        `RECORDATORIOS:\n${recs.abiertas.map((a) => linea(a, sombreros, hoy)).join("\n") || "(ninguno)"}`,
        `REUNIONES Y CITAS:\n${reuniones.map((e) => `· ${textoCorto(e.dia, hoy)} ${e.inicio ? textoHora(e.inicio) : "todo el día"} · ${e.titulo}${e.fuente === "google" ? ` (${e.calendarioNombre ?? "Google"})` : ` (id ${e.id})`}`).join("\n") || "(ninguna)"}`,
        `EVENTOS ESPECIALES DEL MES:\n${especiales.map((e) => `· ${textoCorto(e.dia, hoy)} · ${e.titulo}`).join("\n") || "(ninguno)"}`,
      ];
      const libres = sinFecha(estado.acciones);
      if (periodo !== "hoy" || libres.length) partes.push(`SIN FECHA (siguientes acciones):\n${ordenarPor(libres, "prioridad", ctx).slice(0, 15).map((a) => linea(a, sombreros, hoy)).join("\n") || "(ninguna)"}`);
      return partes.join("\n\n");
    },

    async completar({ id }) {
      const a = await almacen.elemento("accion", String(id ?? ""));
      if (!a) throw new Error(`No hay una tarea con id «${id}». Usa ver_agenda.`);
      if (a.estado !== "abierta") return `«${a.titulo}» ya estaba cerrada.`;
      const perfil = await almacen.perfil();
      const hoy = hoyEn(perfil?.ajustes?.zona);
      const { hecha, siguiente } = completarAccion(a, hoy);
      await almacen.lote([almacen.sentenciaElemento("accion", hecha), ...(siguiente ? [almacen.sentenciaElemento("accion", siguiente)] : [])]);
      await reflejar(env, almacen, [{ tipo: "accion", antes: a, despues: hecha }, ...(siguiente ? [{ tipo: "accion", antes: null, despues: siguiente }] : [])], { hoy, ajustes: perfil?.ajustes }).catch(() => null);
      return `Hecha: «${a.titulo}».${siguiente ? ` La siguiente queda para ${textoCorto(siguiente.cuando ?? siguiente.limite, hoy)}.` : ""}`;
    },

    async buscar({ texto }) {
      const q = fold(texto).trim();
      if (!q) throw new Error("Falta qué buscar.");
      const estado = await almacen.estado();
      const hoy = hoyEn(estado.ajustes?.zona);
      const sombreros = sombrerosDe(estado.ajustes);
      const tiene = (s) => fold(s).includes(q);
      const acciones = estado.acciones.filter((a) => tiene(a.titulo) || tiene(a.notas)).slice(0, 20);
      const eventos = estado.eventos.filter((e) => tiene(e.titulo) || tiene(e.notas)).slice(0, 10);
      const proyectos = estado.proyectos.filter((p) => tiene(p.nombre)).slice(0, 10);
      const notas = buscarCerebro(await almacen.cerebro(), texto, { n: 5 });
      return [
        acciones.length ? `TAREAS:\n${acciones.map((a) => linea(a, sombreros, hoy)).join("\n")}` : "",
        eventos.length ? `EVENTOS:\n${eventos.map((e) => `· ${e.fecha ?? "se repite"} ${textoHora(e.inicio)} · ${e.titulo} (id ${e.id})`).join("\n")}` : "",
        proyectos.length ? `PROYECTOS:\n${proyectos.map((p) => `· ${p.nombre} [${nombreDe(p.sombrero, sombreros)}] · prioridad ${p.prioridad ?? "media"} (id ${p.id})`).join("\n")}` : "",
        notas.length ? `LO QUE SABE DE ÉL:\n${notas.map((n) => `· ${n.titulo}: ${n.texto}`).join("\n")}` : "",
      ].filter(Boolean).join("\n\n") || "No encontré nada con eso.";
    },
  };
}

const rpc = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

/** /.well-known/*, /oauth/register, /oauth/token y /mcp. Devuelve una respuesta, o null si la ruta no es suya. */
export async function rutaMCP(req, env, ctx) {
  const url = new URL(req.url);
  const ruta = url.pathname;
  const metodo = req.method;
  const esSuya = ruta === "/mcp" || ruta.startsWith("/.well-known/oauth-") || ruta.startsWith("/oauth/");
  if (!esSuya) return null;
  if (metodo === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (ruta.startsWith("/.well-known/oauth-protected-resource") && metodo === "GET") return conCors(metadatos(req).recurso);
  if (ruta.startsWith("/.well-known/oauth-authorization-server") && metodo === "GET") return conCors(metadatos(req).servidor);

  if (ruta === "/oauth/register" && metodo === "POST") {
    const b = (await cuerpo(req)) ?? {};
    const c = await registrarClienteMCP(env.DB, { nombre: b.client_name ?? "", redirectUris: b.redirect_uris });
    if (!c) return errorOAuth("invalid_redirect_uri", "Las direcciones de vuelta tienen que ser https (o http en la propia máquina).");
    return conCors({ client_id: c.id, client_name: c.nombre, redirect_uris: c.redirectUris, grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none", client_id_issued_at: Math.floor(Date.now() / 1000) }, 201);
  }

  if (ruta === "/oauth/token" && metodo === "POST") {
    const ip = ipDe(req);
    if (await demasiadosFallos(env.DB, ip)) return errorOAuth("slow_down", "Demasiados intentos fallidos: espera 15 minutos.", 429);
    const b = await leerFormulario(req);
    let t = null;
    if (b.grant_type === "authorization_code") t = await canjearCodigoMCP(env.DB, { codigo: b.code, clienteId: b.client_id, redirectUri: b.redirect_uri, verificador: b.code_verifier });
    else if (b.grant_type === "refresh_token") t = await renovarTokenMCP(env.DB, { renovacion: b.refresh_token, clienteId: b.client_id });
    else return errorOAuth("unsupported_grant_type", "Sólo authorization_code y refresh_token.");
    if (!t) {
      await apuntarFallo(env.DB, ip);
      return errorOAuth("invalid_grant", "El código no vale, caducó, ya se usó o la conexión se desconectó.");
    }
    return conCors({ ...t, scope: "agenda" }, 200, { "Cache-Control": "no-store" });
  }

  if (ruta === "/mcp") {
    if (metodo !== "POST") return new Response(null, { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } });
    const ip = ipDe(req);
    if (await demasiadosFallos(env.DB, ip)) return conCors({ error: "Demasiados intentos fallidos." }, 429);
    const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization") ?? "")?.[1]?.trim();
    const ownerId = await duenoDeTokenMCP(env.DB, bearer);
    if (!ownerId) {
      if (bearer) await apuntarFallo(env.DB, ip);
      return new Response(JSON.stringify({ error: "invalid_token", error_description: "Conecta Claude con tu agenda." }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS, "WWW-Authenticate": `Bearer resource_metadata="${origenDe(req)}/.well-known/oauth-protected-resource"` },
      });
    }
    const mensaje = await cuerpo(req);
    if (!mensaje || typeof mensaje !== "object") return conCors(rpcError(null, -32700, "JSON no válido"), 400);
    const herramientas = crearHerramientas({ env, ownerId, despues: ctx?.waitUntil ? (p) => ctx.waitUntil(p) : null });
    const respuestas = [];
    for (const m of Array.isArray(mensaje) ? mensaje : [mensaje]) {
      if (m?.id === undefined || m?.id === null) continue;
      if (m.method === "initialize") {
        const pedida = m.params?.protocolVersion;
        respuestas.push(rpc(m.id, { protocolVersion: VERSIONES.includes(pedida) ? pedida : VERSIONES[0], capabilities: { tools: { listChanged: false } }, serverInfo: { name: "agenda-personal", title: "Agenda personal", version: "1.0.0" }, instructions: INSTRUCCIONES }));
      } else if (m.method === "ping") respuestas.push(rpc(m.id, {}));
      else if (m.method === "tools/list") respuestas.push(rpc(m.id, { tools: HERRAMIENTAS }));
      else if (m.method === "tools/call") {
        const nombre = m.params?.name;
        if (!herramientas[nombre]) {
          respuestas.push(rpcError(m.id, -32602, `No existe la herramienta ${nombre}`));
          continue;
        }
        try {
          const texto = await herramientas[nombre](m.params?.arguments ?? {});
          respuestas.push(rpc(m.id, { content: [{ type: "text", text: texto }] }));
        } catch (e) {
          respuestas.push(rpc(m.id, { content: [{ type: "text", text: e.message }], isError: true }));
        }
      } else respuestas.push(rpcError(m.id, -32601, `Método no soportado: ${m.method}`));
    }
    if (!respuestas.length) return new Response(null, { status: 202, headers: CORS });
    return conCors(Array.isArray(mensaje) ? respuestas : respuestas[0]);
  }
  return conCors({ error: "Ruta no encontrada" }, 404);
}
