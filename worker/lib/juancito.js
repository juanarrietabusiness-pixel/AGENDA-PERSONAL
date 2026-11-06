// ============================================================
// Juancito Ads: el trabajo vive allá, y se ve (y se marca) aquí
//
// La agenda se conecta al calendario de marketing COMO SE CONECTA CLAUDE: es
// un cliente más de su MCP, con OAuth 2.1 + PKCE y registro dinámico. Así no
// hay llaves nuevas que crear ni código que tocar allá: Juan pulsa «Conectar»,
// el calendario le pregunta si deja entrar a «Agenda personal» y listo.
//
// Las llamadas van por el Service Binding `JUANCITO` (Worker a Worker, sin
// salir a internet; un Worker no puede pedirle a otro de la misma zona por su
// dominio). Sin el binding (en local), por la dirección pública.
//
//   · Lo que se agenda en el sombrero de Juancito Ads se CREA allá al momento
//     (`crear_tarea`) y guarda su id (`accion.juancito.id`).
//   · Marcarla hecha aquí la marca allá (`completar_tarea`).
//   · Cada pocos minutos se lee `ver_tareas` (con los ids): lo que se marcó
//     hecho allá se marca aquí, y lo nuevo de allá (sin asignar, o de Juan)
//     aparece aquí.
//
// Los permisos se guardan en `conexiones` (servicio «juancito»). El token de
// acceso dura una hora y el de renovación ROTA en cada uso: se guarda el nuevo
// siempre, o la conexión se pierde.
// ============================================================

import { aleatorio, huella } from "./sesion.js";
import { nuevaAccion } from "../../src/lib/metodo.js";
import { sombrerosDe } from "../../src/lib/sombreros.js";

export const ORIGEN = "https://calendario.juancitoads.com";
export const SERVICIO = "juancito";
const MINUTOS_ESTADO = 10;
/** Cada cuánto se lee la lista de allá, como mucho. */
export const MINUTOS_SYNC = 3;

export class ErrorJuancito extends Error {}

/** Una petición al calendario: por el binding si está, si no por internet. */
async function pedir(env, ruta, init) {
  const url = `${ORIGEN}${ruta}`;
  try {
    return env.JUANCITO ? await env.JUANCITO.fetch(new Request(url, init)) : await fetch(url, init);
  } catch {
    throw new ErrorJuancito("No se pudo hablar con Juancito Ads.");
  }
}

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function retoDe(verificador) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verificador))));
}

/** El sombrero que se guarda en Juancito Ads (el de `fuente: "juancito-ads"`), o null. */
export const sombreroDeJuancito = (ajustes) => sombrerosDe(ajustes).find((s) => s.fuente === "juancito-ads")?.id ?? null;

/**
 * Conectar, paso 1: se registra la agenda como cliente (una vez) y se da la dirección donde Juan dice que sí.
 * `origen` es la dirección de la agenda (la vuelta es `${origen}/api/juancito/vuelta`).
 */
export async function iniciar(env, almacen, origen) {
  const vuelta = `${origen}/api/juancito/vuelta`;
  const actual = (await almacen.conexion(SERVICIO))?.datos ?? {};
  let clienteId = actual.vuelta === vuelta ? actual.clienteId : null;
  if (!clienteId) {
    const res = await pedir(env, "/oauth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_name: "Agenda personal", redirect_uris: [vuelta], grant_types: ["authorization_code", "refresh_token"], token_endpoint_auth_method: "none" }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.client_id) throw new ErrorJuancito(`Juancito Ads no dejó registrar la agenda: ${j?.error_description ?? res.status}`);
    clienteId = j.client_id;
    await almacen.guardarConexion(SERVICIO, { ...actual, clienteId, vuelta, conectada: false });
  }
  const verificador = aleatorio(32);
  const estado = aleatorio(16);
  await almacen.crearPendiente({ estadoHash: await huella(estado), servicio: SERVICIO, verificador, caduca: new Date(Date.now() + MINUTOS_ESTADO * 60_000).toISOString() });
  const q = new URLSearchParams({ response_type: "code", client_id: clienteId, redirect_uri: vuelta, code_challenge: await retoDe(verificador), code_challenge_method: "S256", state: estado, scope: "calendario" });
  return `${ORIGEN}/conectar-claude?${q}`;
}

async function canjear(env, cuerpo) {
  const res = await pedir(env, "/oauth/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(cuerpo).toString() });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.access_token) throw new ErrorJuancito(j?.error_description ?? "Juancito Ads no aceptó el permiso.");
  return { acceso: j.access_token, renovacion: j.refresh_token, caduca: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
}

/** Conectar, paso 2: la vuelta con el código. */
export async function terminar(env, almacen, { code, state }) {
  const p = state ? await almacen.tomarPendiente(await huella(state)) : null;
  if (!p || p.servicio !== SERVICIO) throw new ErrorJuancito("El permiso caducó o no es de esta sesión. Vuelve a pulsar «Conectar».");
  const datos = (await almacen.conexion(SERVICIO))?.datos ?? {};
  if (!datos.clienteId) throw new ErrorJuancito("Falta el registro de la agenda en Juancito Ads. Vuelve a pulsar «Conectar».");
  const t = await canjear(env, { grant_type: "authorization_code", code: String(code ?? ""), client_id: datos.clienteId, redirect_uri: datos.vuelta, code_verifier: p.verificador });
  await almacen.guardarConexion(SERVICIO, { ...datos, conectada: true, tokens: t, ajustes: datos.ajustes ?? { todas: false } });
}

/** Un token de acceso que sirva (renovándolo si caducó; el de renovación rota y se guarda). */
async function token(env, almacen) {
  const c = await almacen.conexion(SERVICIO);
  const d = c?.datos;
  if (!d?.conectada || !d.tokens) return null;
  if (d.tokens.caduca - Date.now() > 60_000) return d.tokens.acceso;
  try {
    const t = await canjear(env, { grant_type: "refresh_token", refresh_token: d.tokens.renovacion, client_id: d.clienteId });
    await almacen.guardarConexion(SERVICIO, { ...d, tokens: t }, { error: null });
    return t.acceso;
  } catch (e) {
    await almacen.guardarConexion(SERVICIO, { ...d, conectada: false, tokens: null }, { error: `${e.message} Vuelve a conectar.` });
    return null;
  }
}

/** Llama a una herramienta del MCP de Juancito Ads. Devuelve el texto. */
export async function herramienta(env, almacen, nombre, args = {}) {
  const acceso = await token(env, almacen);
  if (!acceso) throw new ErrorJuancito("Juancito Ads no está conectado. Vuelve a conectar en Ajustes.");
  const res = await pedir(env, "/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${acceso}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: nombre, arguments: args } }),
  });
  const j = await res.json().catch(() => null);
  if (res.status === 401) throw new ErrorJuancito("Juancito Ads pidió volver a conectar.");
  if (!res.ok || j?.error) throw new ErrorJuancito(`Juancito Ads: ${j?.error?.message ?? res.status}`);
  const textoR = (j?.result?.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  if (j?.result?.isError) throw new ErrorJuancito(textoR || "Juancito Ads no pudo.");
  return textoR;
}

export const conectada = async (almacen) => Boolean((await almacen.conexion(SERVICIO))?.datos?.conectada);

/** Crea allá una acción de aquí. Devuelve el id de allá (sale del texto «(id …)»). */
export async function crearTarea(env, almacen, accion, hoy) {
  const r = await herramienta(env, almacen, "crear_tarea", {
    titulo: accion.titulo,
    ...(accion.cliente ? { cliente: accion.cliente } : {}),
    ...(accion.limite ? { fecha_limite: accion.limite } : {}),
    ...(accion.cuando && accion.cuando <= hoy ? { para_hoy: true } : {}),
  });
  const id = /\(id ([^)\s]+)\)/.exec(r)?.[1];
  if (!id) throw new ErrorJuancito("Juancito Ads no devolvió el id de la tarea.");
  return id;
}

export const completarTarea = (env, almacen, id) => herramienta(env, almacen, "completar_tarea", { tarea_id: id });

/**
 * Lee lo que devuelve `ver_tareas` (texto, con los ids desde el cambio del calendario de marketing):
 *   «Café Luna:\n· Revisar copys vence 2026-11-10 → Ana (id t1)\n…\n\nSin empresa (rápidas):\n· … (id q1)»
 * Devuelve [{ id, titulo, cliente, hecha, vence, para, asignada }]. Puro.
 */
export function leerTareas(texto) {
  const out = [];
  let cliente = null;
  for (const linea of String(texto ?? "").split("\n")) {
    const l = linea.trim();
    if (!l) continue;
    if (!l.startsWith("·")) {
      if (/:$/.test(l)) cliente = /^Sin empresa/.test(l) ? null : l.replace(/:$/, "").trim();
      continue;
    }
    const id = /\(id ([^)\s]+)\)\s*$/.exec(l)?.[1];
    if (!id) continue;
    let resto = l.slice(1).replace(/\(id [^)]+\)\s*$/, "").trim();
    const asignada = /→ (.+)$/.exec(resto)?.[1]?.trim() ?? null;
    resto = resto.replace(/→ .+$/, "").trim();
    const vence = /vence (\d{4}-\d{2}-\d{2})/.exec(resto)?.[1] ?? null;
    const para = /marcada para (\d{4}-\d{2}-\d{2})/.exec(resto)?.[1] ?? null;
    const hecha = /\(hecha\)/.test(resto);
    const titulo = resto.replace(/\(hecha\)/, "").replace(/\[[^\]]+\]/, "").replace(/vence \d{4}-\d{2}-\d{2}/, "").replace(/marcada para \d{4}-\d{2}-\d{2}/, "").replace(/\s+/g, " ").trim();
    out.push({ id, titulo, cliente, hecha, vence, para, asignada });
  }
  return out;
}

/** Los nombres de los clientes de `listar_clientes` («· Café Luna — restaurante · @cafe»). Puro. */
export const leerClientes = (texto) =>
  String(texto ?? "")
    .split("\n")
    .filter((l) => l.startsWith("·"))
    .map((l) => l.replace(/^·\s*/, "").split(/\s+[—·]\s+/)[0].trim())
    .filter(Boolean)
    .slice(0, 100);

const DIA_POR_NOMBRE = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const sinTildes = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Los días fijos de cada empresa (los de «Mi día» del calendario de marketing), de `listar_clientes`:
 *   «· Café Luna — restaurante\n  Calendarios: …\n  Días fijos: lunes, miércoles» → { "Café Luna": [1, 3] }. Puro.
 */
export function leerDiasFijos(texto) {
  const out = {};
  let actual = null;
  for (const linea of String(texto ?? "").split("\n")) {
    if (linea.startsWith("·")) {
      actual = linea.replace(/^·\s*/, "").split(/\s+[—·]\s+/)[0].trim() || null;
      continue;
    }
    const m = /^\s*D[ií]as fijos:\s*(.+)$/i.exec(linea);
    if (!m || !actual) continue;
    const dias = m[1].split(",").map((d) => DIA_POR_NOMBRE[sinTildes(d).trim()]).filter((n) => Number.isInteger(n));
    if (dias.length) out[actual] = [...new Set(dias)].sort();
  }
  return out;
}

/** Las empresas que tocan ese día (0 = domingo … 6 = sábado). */
export const empresasDelDia = (diasFijos, diaSemana) => Object.entries(diasFijos ?? {}).filter(([, ds]) => ds.includes(diaSemana)).map(([n]) => n).sort();

const esDeJuan = (t, nombre, todas) => todas || !t.asignada || t.asignada.toLowerCase().includes(String(nombre ?? "").toLowerCase().split(" ")[0]);

/**
 * Lo de allá → aquí. Puro: devuelve las acciones que cambian o entran.
 *   · una de aquí con `juancito.id` que allá está hecha → hecha aquí;
 *   · una de allá que aquí no existe, abierta y de Juan (o sin asignar) → entra en el sombrero de Juancito Ads.
 */
export function cambiosDesdeJuancito(remotas, acciones, { hoy, sombrero, nombre, todas = false }) {
  const porId = new Map(acciones.filter((a) => a.juancito?.id).map((a) => [a.juancito.id, a]));
  const cambios = [];
  for (const t of remotas) {
    const local = porId.get(t.id);
    if (local) {
      if (t.hecha && local.estado === "abierta") cambios.push({ ...local, estado: "hecha", hechaEl: hoy, enfoque: null });
      continue;
    }
    if (t.hecha || !esDeJuan(t, nombre, todas)) continue;
    cambios.push(nuevaAccion({ titulo: t.titulo, sombrero, cliente: t.cliente, lista: "siguientes", limite: t.vence, cuando: t.para, juancito: { id: t.id }, origen: "juancito-ads" }, hoy));
  }
  return cambios;
}

/** La vuelta de sincronización: los clientes (cada hora) y las tareas. */
export async function sincronizar(env, almacen, { hoy, forzar = false } = {}) {
  const c = await almacen.conexion(SERVICIO);
  if (!c?.datos?.conectada) return { ok: false, motivo: "sin-conexion" };
  const ultima = c.sincronizado ? Date.parse(c.sincronizado) : 0;
  if (!forzar && Date.now() - ultima < MINUTOS_SYNC * 60_000) return { ok: true, saltada: true };
  try {
    const estado = await almacen.estado();
    const datos = c.datos;
    if (!datos.clientesAl || !datos.diasFijos || Date.now() - datos.clientesAl > 3600_000) {
      const txt = await herramienta(env, almacen, "listar_clientes", {});
      datos.clientes = leerClientes(txt);
      datos.diasFijos = leerDiasFijos(txt);
      datos.clientesAl = Date.now();
    }
    const remotas = leerTareas(await herramienta(env, almacen, "ver_tareas", { estado: "todas" }));
    const sombrero = sombreroDeJuancito(estado.ajustes);
    const cambios = sombrero ? cambiosDesdeJuancito(remotas, estado.acciones, { hoy, sombrero, nombre: estado.ajustes?.nombre, todas: datos.ajustes?.todas }) : [];
    // Lo de aquí que debía estar allá y no llegó (un fallo de red al crearlo): se crea ahora.
    const sinSubir = sombrero ? estado.acciones.filter((a) => a.sombrero === sombrero && a.estado === "abierta" && !a.juancito?.id && a.origen !== "juancito-ads") : [];
    for (const a of sinSubir.slice(0, 5)) {
      try {
        cambios.push({ ...a, juancito: { id: await crearTarea(env, almacen, a, hoy) } });
      } catch {
        break;
      }
    }
    if (cambios.length) await almacen.lote(cambios.map((a) => almacen.sentenciaElemento("accion", a)));
    const fresca = (await almacen.conexion(SERVICIO))?.datos ?? datos;
    await almacen.guardarConexion(SERVICIO, { ...fresca, clientes: datos.clientes, diasFijos: datos.diasFijos, clientesAl: datos.clientesAl }, { sincronizado: new Date().toISOString(), error: null });
    return { ok: true, cambios: cambios.length };
  } catch (e) {
    await almacen.marcarConexion(SERVICIO, { error: e.message });
    return { ok: false, motivo: e.message };
  }
}
