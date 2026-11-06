// ============================================================
// Google Calendar y Google Tasks, en las dos cuentas de Juan
//
// Juan tiene dos cuentas (la personal y la de la agencia) y cambiar entre una
// y otra le complica. Aquí se conectan LAS DOS (o las que quiera), cada una
// con su permiso, y la agenda las junta:
//
//   · Los EVENTOS de sus calendarios se leen (una copia en `externos`, que el
//     cron repone) y salen en «Hoy»: con hora, como reuniones; de todo el día
//     (feriados, cumpleaños, un viaje), como eventos especiales. Se leen TODOS
//     los calendarios que la cuenta enseña en Google Calendar —también los que
//     otra cuenta le comparte—, o los que Juan escoja: con UNA cuenta basta.
//   · Lo que se agenda en un sombrero se guarda en el calendario que Juan
//     escoja para ese sombrero (`ajustes.guardarEn`; si no, el principal).
//   · Lo que el asistente agenda con hora se CREA en el Google Calendar de la
//     cuenta que lleva ese sombrero; cambiarlo o borrarlo aquí lo cambia allá.
//   · Las TAREAS de los sombreros que Juan escoja van a Google Tasks; marcarlas
//     hechas allá las marca aquí, y al revés.
//
// Hace falta un cliente OAuth de Google (GOOGLE_CLIENT_ID y
// GOOGLE_CLIENT_SECRET, secretos del Worker; los pasos en DEPLOY.md). Los
// permisos se guardan CIFRADOS (AES-GCM con una llave que sale del secreto
// del cliente): sin ese secreto no sirven de nada.
//
// La app de Google tiene que estar «en producción»: «en prueba», el permiso
// caduca a los 7 días (pasó en el calendario de marketing con Drive).
// ============================================================

import { aleatorio, huella } from "./sesion.js";
import { hoyEn, horaEn, sumarDias, esFecha, esHora, ZONA } from "../../src/lib/fechas.js";
import { nuevaAccion } from "../../src/lib/metodo.js";
import { sombrerosDe } from "../../src/lib/sombreros.js";

export const ALCANCES = ["openid", "email", "https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/tasks"];
const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const CAL = "https://www.googleapis.com/calendar/v3";
const TASKS = "https://tasks.googleapis.com/tasks/v1";
export const PREFIJO = "google:";
export const MINUTOS_SYNC = 10;

export class ErrorGoogle extends Error {}

export const hayGoogle = (env) => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

// ── Cifrado de los permisos ──
const enc = new TextEncoder();
async function llave(env) {
  const base = await crypto.subtle.importKey("raw", enc.encode(env.GOOGLE_CLIENT_SECRET), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: enc.encode("agenda-personal"), info: enc.encode("google-tokens") }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
const aB64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b)));
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export async function cifrar(env, texto) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await llave(env), enc.encode(texto));
  return `${aB64(iv)}.${aB64(c)}`;
}
export async function descifrar(env, guardado) {
  const [iv, c] = String(guardado ?? "").split(".");
  const p = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(iv) }, await llave(env), deB64(c));
  return new TextDecoder().decode(p);
}

// ── Conectar ──
export async function iniciar(env, almacen, origen) {
  if (!hayGoogle(env)) throw new ErrorGoogle("Falta configurar Google: pon GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Cloudflare.");
  const estado = aleatorio(16);
  await almacen.crearPendiente({ estadoHash: await huella(estado), servicio: "google", verificador: "-", caduca: new Date(Date.now() + 10 * 60_000).toISOString() });
  const q = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origen}/api/google/vuelta`,
    response_type: "code",
    scope: ALCANCES.join(" "),
    access_type: "offline",
    prompt: "consent select_account",
    state: estado,
  });
  return `${AUTH}?${q}`;
}

async function pedirToken(env, cuerpo) {
  const res = await fetch(TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, ...cuerpo }).toString() });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.access_token) throw new ErrorGoogle(j?.error === "invalid_grant" ? "Google retiró el permiso: vuelve a conectar esa cuenta." : `Google no dio el permiso (${j?.error_description ?? j?.error ?? res.status}).`);
  return j;
}

/** La vuelta: canjea el código, sabe qué cuenta es y la guarda (con sus permisos cifrados). */
export async function terminar(env, almacen, { code, state, origen }) {
  const p = state ? await almacen.tomarPendiente(await huella(state)) : null;
  if (!p || p.servicio !== "google") throw new ErrorGoogle("El permiso caducó o no es de esta sesión. Vuelve a pulsar «Conectar Google».");
  const t = await pedirToken(env, { grant_type: "authorization_code", code: String(code ?? ""), redirect_uri: `${origen}/api/google/vuelta` });
  const yo = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${t.access_token}` } }).then((r) => r.json()).catch(() => null);
  const cuenta = String(yo?.email ?? "").toLowerCase();
  if (!cuenta) throw new ErrorGoogle("Google no dijo qué cuenta es.");
  const servicio = `${PREFIJO}${cuenta}`;
  const previa = (await almacen.conexion(servicio))?.datos;
  if (!t.refresh_token && !previa?.renovacion) throw new ErrorGoogle("Google no dio un permiso duradero. Quita el acceso de la agenda en tu cuenta de Google y conecta otra vez.");
  const otras = (await almacen.conexiones()).filter((c) => c.servicio.startsWith(PREFIJO) && c.servicio !== servicio);
  const estado = await almacen.estado();
  // La primera cuenta lleva todos los sombreros (menos el de Juancito Ads, cuyas tareas viven allá); las demás, ninguno hasta que Juan escoja.
  const todos = sombrerosDe(estado.ajustes);
  const ajustes = previa?.ajustes ?? (otras.length ? { eventosDe: [], tareasDe: [] } : { eventosDe: todos.map((s) => s.id), tareasDe: todos.filter((s) => s.fuente !== "juancito-ads").map((s) => s.id) });
  await almacen.guardarConexion(servicio, {
    cuenta,
    renovacion: t.refresh_token ? await cifrar(env, t.refresh_token) : previa.renovacion,
    acceso: await cifrar(env, t.access_token),
    caduca: Date.now() + (Number(t.expires_in) || 3600) * 1000,
    ajustes,
  }, { error: null });
  return cuenta;
}

async function token(env, almacen, servicio) {
  const c = await almacen.conexion(servicio);
  const d = c?.datos;
  if (!d?.renovacion) throw new ErrorGoogle("Esa cuenta de Google no está conectada.");
  if (d.caduca - Date.now() > 60_000) return descifrar(env, d.acceso);
  try {
    const t = await pedirToken(env, { grant_type: "refresh_token", refresh_token: await descifrar(env, d.renovacion) });
    await almacen.guardarConexion(servicio, { ...d, acceso: await cifrar(env, t.access_token), caduca: Date.now() + (Number(t.expires_in) || 3600) * 1000 }, { error: null });
    return t.access_token;
  } catch (e) {
    await almacen.marcarConexion(servicio, { error: e.message });
    throw e;
  }
}

async function api(env, almacen, servicio, url, { method = "GET", body } = {}) {
  const acceso = await token(env, almacen, servicio);
  const res = await fetch(url, { method, headers: { authorization: `Bearer ${acceso}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204 || (method === "DELETE" && (res.ok || res.status === 410 || res.status === 404))) return null;
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new ErrorGoogle(`Google (${res.status}): ${j?.error?.message ?? "no se pudo"}`);
  return j;
}

// ── De Google a la agenda (puro) ──

/** Un evento de Google → { id, tipo, dia, inicio, fin, titulo, … } en la hora de Panamá. */
export function deEventoGoogle(e, { cuenta, calendario, calendarioNombre = null, color = null, zona = ZONA }) {
  const todoElDia = Boolean(e.start?.date);
  const ini = todoElDia ? null : new Date(e.start?.dateTime);
  const fin = todoElDia ? null : new Date(e.end?.dateTime);
  const dia = todoElDia ? e.start.date : hoyEn(zona, ini);
  if (!esFecha(dia)) return null;
  return {
    id: e.id,
    tipo: "evento",
    dia,
    inicio: todoElDia ? null : horaEn(zona, ini),
    fin: todoElDia ? null : horaEn(zona, fin),
    titulo: String(e.summary ?? "(sin título)").slice(0, 200),
    notas: String(e.description ?? "").slice(0, 1000),
    lugar: String(e.location ?? "").slice(0, 200),
    todoElDia,
    cuenta,
    calendario,
    calendarioNombre,
    color,
    enlace: e.htmlLink ?? null,
    conGente: Array.isArray(e.attendees) && e.attendees.length > 1,
  };
}

/** Un evento de la agenda → el cuerpo de Google. */
export function aEventoGoogle(e, zona = ZONA) {
  const especial = e.clase === "especial" && e.inicio === "00:00";
  const cuerpo = {
    summary: e.titulo,
    description: [e.notas, "— Agenda personal"].filter(Boolean).join("\n\n"),
    start: especial ? { date: e.fecha } : { dateTime: `${e.fecha ?? e.repite?.inicio}T${e.inicio}:00`, timeZone: zona },
    end: especial ? { date: sumarDias(e.fecha, 1) } : { dateTime: `${e.fecha ?? e.repite?.inicio}T${e.fin}:00`, timeZone: zona },
  };
  if (!e.fecha && e.repite?.regla) cuerpo.recurrence = [`RRULE:${e.repite.regla}`];
  return cuerpo;
}

/** Una acción → una tarea de Google (la fecha va como día: Google Tasks no guarda la hora). */
export function aTareaGoogle(a) {
  const dia = a.limite ?? a.cuando;
  return {
    title: a.titulo,
    notes: [a.notas, a.hora && esHora(a.hora) ? `A las ${a.hora}` : null].filter(Boolean).join("\n") || undefined,
    ...(dia ? { due: `${dia}T00:00:00.000Z` } : {}),
    status: a.estado === "hecha" ? "completed" : "needsAction",
  };
}

/** Un calendario de la lista de la cuenta → { id, nombre, principal, escribir, visible, color }. Puro. */
export function deCalendarioGoogle(c) {
  return {
    id: String(c.id),
    nombre: String(c.summaryOverride || c.summary || c.id).slice(0, 80),
    principal: Boolean(c.primary),
    escribir: c.accessRole === "owner" || c.accessRole === "writer",
    visible: c.selected !== false && !c.hidden,
    color: /^#[0-9a-fA-F]{6}$/.test(c.backgroundColor ?? "") ? c.backgroundColor : null,
  };
}

/** Qué calendarios se leen: los que Juan escogió (`ajustes.leer`) o, si no escogió, los que ve en Google Calendar. */
export function calendariosALeer(lista, ajustes = {}) {
  if (!lista?.length) return ["primary"];
  if (Array.isArray(ajustes.leer)) return ajustes.leer.filter((id) => lista.some((c) => c.id === id));
  return lista.filter((c) => c.visible).map((c) => c.id);
}

/** En qué calendario se guarda lo de un sombrero: el escogido, si se puede escribir en él; si no, el principal. */
export function calendarioParaGuardar(datos, sombrero) {
  const escogido = datos?.ajustes?.guardarEn?.[sombrero];
  const lista = datos?.lista ?? [];
  if (escogido && (!lista.length || lista.some((c) => c.id === escogido && c.escribir))) return escogido;
  return "primary";
}

const HORAS_LISTA = 6;

/** La lista de calendarios de una cuenta, recordada unas horas (cambia poco). Devuelve los datos puestos al día. */
async function conLista(env, almacen, c, forzar) {
  const d = c.datos;
  if (!forzar && d.lista?.length && Date.now() - (d.listaAl ?? 0) < HORAS_LISTA * 3_600_000) return d;
  const r = await api(env, almacen, c.servicio, `${CAL}/users/me/calendarList?minAccessRole=reader&maxResults=250`);
  const lista = (r?.items ?? []).filter((x) => !x.deleted).map(deCalendarioGoogle);
  const fresca = (await almacen.conexion(c.servicio))?.datos ?? d;
  const nuevos = { ...fresca, lista, listaAl: Date.now() };
  await almacen.guardarConexion(c.servicio, nuevos);
  return nuevos;
}

/** Las cuentas de Google conectadas, con sus ajustes. */
export async function cuentas(almacen) {
  return (await almacen.conexiones()).filter((c) => c.servicio.startsWith(PREFIJO) && c.datos?.renovacion);
}

/** Qué cuenta lleva los eventos (o las tareas) de un sombrero. */
const cuentaPara = (lista, sombrero, que) => lista.find((c) => (c.datos.ajustes?.[que] ?? []).includes(sombrero)) ?? null;

// ── Escribir allá ──
export async function crearEvento(env, almacen, evento, lista) {
  const c = cuentaPara(lista, evento.sombrero, "eventosDe");
  if (!c) return null;
  const cal = calendarioParaGuardar(c.datos, evento.sombrero);
  const r = await api(env, almacen, c.servicio, `${CAL}/calendars/${encodeURIComponent(cal)}/events`, { method: "POST", body: aEventoGoogle(evento) });
  return { cuenta: c.datos.cuenta, servicio: c.servicio, calendario: cal, id: r.id };
}
export const actualizarEvento = (env, almacen, evento) =>
  api(env, almacen, evento.google.servicio, `${CAL}/calendars/${encodeURIComponent(evento.google.calendario ?? "primary")}/events/${encodeURIComponent(evento.google.id)}`, { method: "PATCH", body: aEventoGoogle(evento) });
export const borrarEvento = (env, almacen, evento) =>
  api(env, almacen, evento.google.servicio, `${CAL}/calendars/${encodeURIComponent(evento.google.calendario ?? "primary")}/events/${encodeURIComponent(evento.google.id)}`, { method: "DELETE" });

export async function crearTarea(env, almacen, accion, lista) {
  const c = cuentaPara(lista, accion.sombrero, "tareasDe");
  if (!c) return null;
  const r = await api(env, almacen, c.servicio, `${TASKS}/lists/%40default/tasks`, { method: "POST", body: aTareaGoogle(accion) });
  return { cuenta: c.datos.cuenta, servicio: c.servicio, lista: "@default", id: r.id };
}
export const actualizarTarea = (env, almacen, accion) =>
  api(env, almacen, accion.google.servicio, `${TASKS}/lists/${encodeURIComponent(accion.google.lista ?? "@default")}/tasks/${encodeURIComponent(accion.google.id)}`, { method: "PATCH", body: aTareaGoogle(accion) });
export const borrarTarea = (env, almacen, accion) =>
  api(env, almacen, accion.google.servicio, `${TASKS}/lists/${encodeURIComponent(accion.google.lista ?? "@default")}/tasks/${encodeURIComponent(accion.google.id)}`, { method: "DELETE" });

// ── Leer de allá ──

/**
 * Las tareas de Google → aquí. Puro: lo hecho allá se marca hecho; lo nuevo y abierto de allá entra en el primer
 * sombrero que esa cuenta lleva (o sin sombrero).
 */
export function cambiosDesdeGoogle(tareas, acciones, { hoy, cuenta, servicio, sombrero }) {
  const porId = new Map(acciones.filter((a) => a.google?.id).map((a) => [a.google.id, a]));
  const cambios = [];
  for (const t of tareas) {
    if (!t?.id || t.deleted) continue;
    const local = porId.get(t.id);
    const hecha = t.status === "completed";
    if (local) {
      if (hecha && local.estado === "abierta") cambios.push({ ...local, estado: "hecha", hechaEl: hoy, enfoque: null });
      else if (!hecha && local.estado === "hecha") cambios.push({ ...local, estado: "abierta", hechaEl: null });
      continue;
    }
    if (hecha || !String(t.title ?? "").trim()) continue;
    cambios.push(nuevaAccion({ titulo: t.title, notas: t.notes ?? "", sombrero, lista: "siguientes", limite: t.due ? String(t.due).slice(0, 10) : null, google: { cuenta, servicio, lista: "@default", id: t.id }, origen: "google" }, hoy));
  }
  return cambios;
}

/** La vuelta del cron: eventos de los próximos dos meses y tareas, de cada cuenta. */
export async function sincronizar(env, almacen, { hoy, forzar = false } = {}) {
  if (!hayGoogle(env)) return { ok: false, motivo: "sin-google" };
  const lista = await cuentas(almacen);
  let total = 0;
  for (const cuenta of lista) {
    const ultima = cuenta.sincronizado ? Date.parse(cuenta.sincronizado) : 0;
    if (!forzar && Date.now() - ultima < MINUTOS_SYNC * 60_000) continue;
    let c = cuenta;
    const fallos = [];
    try {
      const desde = sumarDias(hoy, -7);
      const hasta = sumarDias(hoy, 62);
      const filas = [];
      let datos = c.datos;
      try {
        datos = await conLista(env, almacen, c, forzar);
      } catch {
        /* sin la lista se lee el principal, como antes */
      }
      for (const cal of calendariosALeer(datos.lista, datos.ajustes).slice(0, 15)) {
        const info = datos.lista?.find((x) => x.id === cal);
        const nombre = info?.nombre ?? null;
        try {
          const q = new URLSearchParams({ timeMin: `${desde}T00:00:00-05:00`, timeMax: `${hasta}T23:59:59-05:00`, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
          const r = await api(env, almacen, c.servicio, `${CAL}/calendars/${encodeURIComponent(cal)}/events?${q}`);
          for (const e of r?.items ?? []) {
            if (e.status === "cancelled") continue;
            const x = deEventoGoogle(e, { cuenta: datos.cuenta, calendario: cal, calendarioNombre: nombre, color: info?.color ?? null });
            if (x) filas.push(x);
          }
        } catch (e) {
          // Un calendario que falla (compartido y retirado) no tumba los demás.
          fallos.push(`${nombre ?? cal}: ${e.message}`);
        }
      }
      // La copia se repone ENTERA: lo de un calendario que se dejó de ver (o de fuera de la ventana) no se queda.
      await almacen.reemplazarExternos(c.servicio, { desde: "0000-01-01", hasta: "9999-12-31" }, filas);
      c = { ...c, datos };
      if ((c.datos.ajustes?.tareasDe ?? []).length) {
        const q = new URLSearchParams({ showCompleted: "true", showHidden: "true", maxResults: "100" });
        const r = await api(env, almacen, c.servicio, `${TASKS}/lists/%40default/tasks?${q}`);
        const estado = await almacen.estado();
        const cambios = cambiosDesdeGoogle(r?.items ?? [], estado.acciones, { hoy, cuenta: c.datos.cuenta, servicio: c.servicio, sombrero: c.datos.ajustes.tareasDe[0] ?? null });
        if (cambios.length) await almacen.lote(cambios.map((a) => almacen.sentenciaElemento("accion", a)));
        total += cambios.length;
      }
      await almacen.marcarConexion(c.servicio, { sincronizado: new Date().toISOString(), error: fallos.length ? `No pude leer ${fallos.join("; ")}`.slice(0, 500) : null });
    } catch (e) {
      await almacen.marcarConexion(c.servicio, { error: e.message });
    }
  }
  return { ok: true, cambios: total };
}
