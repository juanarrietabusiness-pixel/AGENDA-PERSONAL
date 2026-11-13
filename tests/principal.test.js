import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import worker from "../worker/index.js";
import { d1EnMemoria } from "./utils/d1Memoria.js";
import { esSemanalSimple, diasDeRegla, planDeTraspaso, vueltaDeEventos, vueltaDeTareas, candidatosACopiar, claseAlTraer, sinSufijo, googleMasNuevo } from "../worker/lib/principal.js";
import { deEventoGoogle, maestroDeGoogle } from "../worker/lib/google.js";
import { hoyEn, sumarDias } from "../src/lib/fechas.js";

const SERV = "google:juan@agencia.com";
const lee = (e, cal = "juan@agencia.com", calPropio = true) => ({ ...deEventoGoogle(e, { cuenta: "juan@agencia.com", calendario: cal }), servicio: SERV, calPropio });
const yo = { creator: { self: true }, organizer: { self: true } };

describe("Kairos como principal: qué pasa a Kairos", () => {
  it("una regla cabe en la semana tipo sólo si es cada semana, sin saltos ni fin", () => {
    expect(esSemanalSimple("FREQ=WEEKLY;BYDAY=MO,WE")).toBe(true);
    expect(esSemanalSimple("RRULE:FREQ=DAILY")).toBe(true);
    expect(esSemanalSimple("FREQ=WEEKLY;INTERVAL=1;BYDAY=TU")).toBe(true);
    expect(esSemanalSimple("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU")).toBe(false);
    expect(esSemanalSimple("FREQ=WEEKLY;BYDAY=TU;UNTIL=20261231T000000Z")).toBe(false);
    expect(esSemanalSimple("FREQ=MONTHLY;BYMONTHDAY=1")).toBe(false);
    expect(diasDeRegla("FREQ=WEEKLY;BYDAY=MO,WE,FR", "2026-11-16")).toEqual([1, 3, 5]);
    expect(diasDeRegla("FREQ=DAILY", "2026-11-16")).toHaveLength(7);
    expect(diasDeRegla("FREQ=WEEKLY", "2026-11-18")).toEqual([3]);
  });

  it("lo suyo pasa tal cual: lo semanal a la semana tipo en gris; lo demás, ligado a su original; lo de otros se queda", () => {
    const instancias = [
      lee({ id: "s1_20261116", recurringEventId: "s1", summary: "Lectura bíblica", start: { dateTime: "2026-11-16T11:00:00Z" }, end: { dateTime: "2026-11-16T12:00:00Z" }, ...yo }),
      lee({ id: "s1_20261118", recurringEventId: "s1", summary: "Lectura bíblica", start: { dateTime: "2026-11-18T11:00:00Z" }, end: { dateTime: "2026-11-18T12:00:00Z" }, ...yo }),
      lee({ id: "m1_20261201", recurringEventId: "m1", summary: "Ayuno", start: { date: "2026-12-01" }, end: { date: "2026-12-02" }, ...yo }),
      lee({ id: "o1", summary: "Cita con el dentista", start: { dateTime: "2026-11-20T15:00:00Z" }, end: { dateTime: "2026-11-20T16:00:00Z" }, ...yo }),
      lee({ id: "o2", summary: "Comprar el regalo", start: { dateTime: "2026-11-21T15:00:00Z" }, end: { dateTime: "2026-11-21T16:00:00Z" }, ...yo }, "iglesia@group"),
      lee({ id: "g1", summary: "Reunión con Dcasa", attendees: [{ email: "a" }, { email: "b" }], start: { dateTime: "2026-11-20T15:00:00Z" }, end: { dateTime: "2026-11-20T16:00:00Z" }, ...yo }),
      lee({ id: "inv", summary: "Almuerzo", organizer: { email: "otro@x.com" }, creator: { email: "otro@x.com" }, start: { dateTime: "2026-11-22T17:00:00Z" }, end: { dateTime: "2026-11-22T18:00:00Z" } }),
      lee({ id: "b1", summary: "Cumpleaños de Ana", eventType: "birthday", start: { date: "2026-11-25" }, end: { date: "2026-11-26" }, ...yo }),
      lee({ id: "x1", summary: "Culto", start: { dateTime: "2026-11-22T14:00:00Z" }, end: { dateTime: "2026-11-22T16:00:00Z" } }, "otro@gmail.com", false),
      lee({ id: "ya", summary: "Ya ligado", start: { dateTime: "2026-11-23T14:00:00Z" }, end: { dateTime: "2026-11-23T15:00:00Z" }, ...yo }),
      lee({ id: "r9_1", recurringEventId: "r9", summary: "Oración", start: { dateTime: "2026-11-16T10:00:00Z" }, end: { dateTime: "2026-11-16T10:30:00Z" }, ...yo }),
    ];
    const maestros = new Map([
      ["s1", maestroDeGoogle({ summary: "Lectura bíblica", recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"], start: { dateTime: "2026-01-05T11:00:00Z" }, end: { dateTime: "2026-01-05T12:00:00Z" } })],
      ["m1", maestroDeGoogle({ summary: "Ayuno", recurrence: ["RRULE:FREQ=MONTHLY;BYMONTHDAY=1"], start: { date: "2026-01-01" }, end: { date: "2026-01-02" } })],
    ]);
    const plan = planDeTraspaso({
      instancias,
      maestros,
      eventos: [{ id: "e-ya", titulo: "Ya ligado", google: { id: "ya" } }],
      ritmo: [{ id: "g-r9", titulo: "Oración", google: "r9" }],
      ajustes: {},
      guardarEnDe: () => ({ iglesia: "iglesia@group" }),
    });
    expect(plan.ritmo).toEqual([expect.objectContaining({ titulo: "Lectura bíblica", clase: "compromiso", inicio: "06:00", fin: "07:00", google: "s1", repite: expect.objectContaining({ regla: "FREQ=WEEKLY;BYDAY=MO,WE,FR" }) })]);
    const porTitulo = Object.fromEntries(plan.eventos.map((e) => [e.titulo, e]));
    expect(Object.keys(porTitulo).sort()).toEqual(["Ayuno", "Cita con el dentista", "Comprar el regalo"]);
    expect(porTitulo["Ayuno"]).toMatchObject({ fecha: null, repite: { regla: "FREQ=MONTHLY;BYMONTHDAY=1", inicio: "2026-01-01" }, clase: "especial", inicio: "00:00", fin: "23:59", google: { id: "m1", servicio: SERV } });
    expect(porTitulo["Cita con el dentista"]).toMatchObject({ fecha: "2026-11-20", inicio: "10:00", fin: "11:00", clase: "reunion", origen: "google", google: { id: "o1", calendario: "juan@agencia.com" } });
    // El calendario donde se guarda lo de Iglesia le da el sombrero.
    expect(porTitulo["Comprar el regalo"]).toMatchObject({ clase: "evento", sombrero: "iglesia" });
    expect(plan.fuera).toEqual({ conGente: 2, ajenos: 1, otros: 1 });
  });

  it("lo que Juan fijó para un evento de Google se respeta (menos «rutina», que en Kairos es la semana tipo)", () => {
    expect(claseAlTraer({ id: "a", titulo: "Comprar pan" }, { clasesGoogle: { a: "especial" } })).toBe("especial");
    expect(claseAlTraer({ id: "a", titulo: "Comprar pan" }, { clasesGoogle: { a: "rutina" } })).toBe("evento");
    expect(claseAlTraer({ id: "a", titulo: "Mentoría con Pedro" }, {})).toBe("reunion");
    expect(sinSufijo("Llevar la Biblia\n\n— Agenda personal")).toBe("Llevar la Biblia");
  });

  it("copiar a Google: lo que tiene día (de una semana atrás) o se repite, y las tareas abiertas (no las de Juancito Ads)", () => {
    const hoy = "2026-11-13";
    const c = candidatosACopiar({
      hoy,
      sombreroJuancito: "trabajo",
      eventos: [
        { id: "e1", fecha: "2026-11-20" },
        { id: "e2", fecha: "2026-10-01" },
        { id: "e3", repite: { regla: "FREQ=WEEKLY;BYDAY=TU" } },
        { id: "e4", fecha: null },
        { id: "e5", fecha: "2026-11-20", fuente: "google" },
      ],
      acciones: [
        { id: "a1", estado: "abierta", lista: "siguientes", sombrero: "personal" },
        { id: "a2", estado: "hecha", lista: "siguientes", sombrero: "personal" },
        { id: "a3", estado: "abierta", lista: "siguientes", sombrero: "trabajo" },
        { id: "a4", estado: "abierta", lista: "algun-dia", sombrero: "personal" },
      ],
    });
    expect(c).toEqual([{ tipo: "accion", id: "a1" }, { tipo: "evento", id: "e1" }, { tipo: "evento", id: "e3" }]);
  });
});

describe("Kairos como principal: los dos sentidos", () => {
  const hoy = "2026-11-13";
  const desde = sumarDias(hoy, -7);
  const hasta = sumarDias(hoy, 62);
  const ligado = (id, extra = {}) => ({ id: `e-${id}`, titulo: "Cita", fecha: "2026-11-20", inicio: "10:00", fin: "11:00", notas: "", clase: "evento", sombrero: "personal", google: { servicio: SERV, cuenta: "juan@agencia.com", calendario: "juan@agencia.com", id }, ...extra });
  const leidosCal = new Set([`${SERV}|juan@agencia.com`]);
  const g = (id, inicio, actualizado, extra = {}) =>
    lee({ id, summary: "Cita", description: "\n\n— Agenda personal", updated: actualizado, start: { dateTime: `2026-11-20T${inicio}:00-05:00` }, end: { dateTime: "2026-11-20T23:00:00-05:00" }, ...yo, ...extra });

  it("quién cambió último manda: si fue Google, vuelve; si fue Kairos, se sube; si son iguales, nada", () => {
    const k = ligado("c1", { fin: "23:00" });
    const vig = (iso) => new Map([[k.id, iso]]);
    const masNuevo = vueltaDeEventos({ leidos: [g("c1", "15:00", "2026-11-13T12:00:10Z")], leidosCal, eventos: [k], vigencias: vig("2026-11-13T12:00:00Z"), desde, hasta, hoy });
    expect(masNuevo.actualizar).toEqual([expect.objectContaining({ id: "e-c1", inicio: "15:00" })]);
    const kairosNuevo = vueltaDeEventos({ leidos: [g("c1", "15:00", "2026-11-13T12:00:00Z")], leidosCal, eventos: [k], vigencias: vig("2026-11-13T12:00:10Z"), desde, hasta, hoy });
    expect(kairosNuevo.subir).toEqual([k]);
    // Casi a la vez (la subida que acaba de hacer Kairos): gana Kairos.
    expect(googleMasNuevo("2026-11-13T12:00:01Z", "2026-11-13T12:00:00Z")).toBe(false);
    const iguales = vueltaDeEventos({ leidos: [g("c1", "10:00", "2026-11-13T12:00:10Z")], leidosCal, eventos: [k], vigencias: vig("2026-11-13T12:00:00Z"), desde, hasta, hoy });
    expect([iguales.actualizar, iguales.subir, iguales.verificar]).toEqual([[], [], []]);
  });

  it("lo que no aparece se pregunta (sólo si su calendario se leyó entero); lo nuevo y suyo pasa a Kairos; lo de Kairos huérfano se borra allá", () => {
    const r = vueltaDeEventos({
      leidos: [
        lee({ id: "n1", summary: "Comprar el regalo", start: { dateTime: "2026-11-16T15:00:00Z" }, end: { dateTime: "2026-11-16T16:00:00Z" }, ...yo }),
        lee({ id: "n2", summary: "Ayer", start: { dateTime: "2026-11-10T15:00:00Z" }, end: { dateTime: "2026-11-10T16:00:00Z" }, ...yo }),
        lee({ id: "n3", summary: "Con gente", attendees: [{}, {}], start: { dateTime: "2026-11-16T15:00:00Z" }, end: { dateTime: "2026-11-16T16:00:00Z" }, ...yo }),
        lee({ id: "k9", summary: "Borrado en Kairos", extendedProperties: { private: { kairos: "e-ya-no" } }, start: { dateTime: "2026-11-16T15:00:00Z" }, end: { dateTime: "2026-11-16T16:00:00Z" }, ...yo }),
      ],
      leidosCal,
      eventos: [ligado("falta"), ligado("otro-cal", { google: { servicio: SERV, calendario: "no-leido", id: "otro-cal" } }), { id: "e-semanal", titulo: "Ensayo", repite: { regla: "FREQ=WEEKLY;BYDAY=TU", inicio: "2026-01-06" }, google: { servicio: SERV, calendario: "juan@agencia.com", id: "ens" } }],
      vigencias: new Map(),
      desde,
      hasta,
      hoy,
    });
    expect(r.verificar.map((k) => k.id).sort()).toEqual(["e-falta", "e-semanal"]);
    expect(r.adoptar.map((x) => x.id)).toEqual(["n1"]);
    expect(r.borrarEnGoogle.map((x) => x.id)).toEqual(["k9"]);
  });

  it("las tareas: borrada allá después se borra aquí; cambiada allá vuelve; cambiada aquí se sube", () => {
    const k = { id: "a1", titulo: "Llamar al banco", notas: "", cuando: "2026-11-14", limite: null, estado: "abierta", google: { id: "t1" } };
    const k2 = { id: "a2", titulo: "Pagar", notas: "", limite: "2026-11-20", estado: "abierta", google: { id: "t2" } };
    const k3 = { id: "a3", titulo: "Leer", notas: "", estado: "abierta", google: { id: "t3" } };
    const vig = new Map([["a1", "2026-11-13T12:00:00Z"], ["a2", "2026-11-13T12:00:00Z"], ["a3", "2026-11-13T12:00:30Z"]]);
    const r = vueltaDeTareas({
      tareas: [
        { id: "t1", title: "Llamar al banco y al seguro", notes: "A las 09:00", due: "2026-11-16T00:00:00.000Z", status: "needsAction", updated: "2026-11-13T12:00:20Z" },
        { id: "t2", deleted: true, updated: "2026-11-13T12:00:20Z" },
        { id: "t3", title: "Leer el libro", status: "needsAction", updated: "2026-11-13T12:00:20Z" },
      ],
      acciones: [k, k2, k3],
      vigencias: vig,
      hoy: "2026-11-13",
    });
    expect(r.actualizar).toEqual([expect.objectContaining({ id: "a1", titulo: "Llamar al banco y al seguro", cuando: "2026-11-16", notas: "" })]);
    expect(r.borrar).toEqual(["a2"]);
    expect(r.subir).toEqual([k3]);
  });
});

// ------------------------------------------------------------
// De punta a punta: traer, copiar y los dos sentidos
// ------------------------------------------------------------

const BASE = "https://agenda.ejemplo";
let env;
let cookie = "";
const pedir = async (ruta, { metodo = "GET", datos } = {}) => {
  const res = await worker.fetch(new Request(BASE + ruta, { method: metodo, redirect: "manual", headers: { ...(datos ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: datos ? JSON.stringify(datos) : undefined }), env);
  const galleta = res.headers.get("set-cookie");
  if (galleta) cookie = galleta.split(";")[0];
  return { estado: res.status, datos: await res.clone().json().catch(() => null), res };
};

beforeEach(() => {
  env = { DB: d1EnMemoria(), CODIGO_ALTA: "codigo-secreto", ANTHROPIC_API_KEY: "llave", GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secreto", ASSETS: { fetch: async () => new Response("app") } };
  cookie = "";
});
afterEach(() => vi.unstubAllGlobals());

describe("Kairos como principal, de punta a punta", () => {
  it("trae lo suyo sin tocar Google, copia lo que falta y después lo de Google vuelve (cambios, borrados y lo nuevo)", async () => {
    const hoy = hoyEn();
    const D = (n) => sumarDias(hoy, n);
    const at = (dia, hora) => `${dia}T${hora}:00-05:00`;
    const futuro = () => new Date(Date.now() + 60_000).toISOString();
    const LISTA = [
      { id: "juan@agencia.com", summary: "juan@agencia.com", primary: true, accessRole: "owner" },
      { id: "otro@gmail.com", summary: "Iglesia de otro", accessRole: "reader" },
    ];
    let fase = "traer";
    const llamadas = [];
    let n = 0;
    let nt = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init = {}) => {
        const u = String(url);
        const m = init.method ?? "GET";
        if (u === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "ya29", refresh_token: "1//r", expires_in: 3600 });
        if (u.startsWith("https://openidconnect.googleapis.com/")) return Response.json({ email: "juan@agencia.com" });
        if (u.includes("/users/me/calendarList")) return Response.json({ items: LISTA });
        const corta = u.replace("https://www.googleapis.com/calendar/v3", "").replace("https://tasks.googleapis.com/tasks/v1", "/tasks").split("?")[0];
        llamadas.push(`${m} ${decodeURIComponent(corta)}`);
        if (u.includes("/users/@me/lists")) return Response.json({ items: [{ id: "lista1", title: "Personal" }] });
        if (u.includes("/tasks/v1/lists/")) {
          if (m === "POST") return Response.json({ id: `t-${++nt}`, updated: new Date().toISOString() });
          if (m === "PATCH") return Response.json({ updated: new Date().toISOString() });
          // Al copiar la tarea ya no está allá; en los dos sentidos llega borrada (después de lo de aquí).
          if (fase === "dos") return Response.json({ items: ["t-1", "t-2", "t-3", "t-4"].map((id) => ({ id, deleted: true, updated: futuro() })) });
          return Response.json({ items: [] });
        }
        if (corta === "/calendars" && m === "POST") return Response.json({ id: "kairos-cal" });
        if (corta === "/calendars/kairos-cal") return Response.json({ id: "kairos-cal" });
        const lista = /^\/calendars\/([^/]+)\/events$/.exec(corta);
        const uno = /^\/calendars\/([^/]+)\/events\/([^/]+)$/.exec(corta);
        if (lista && m === "POST") return Response.json({ id: `nuevo-${++n}`, updated: new Date().toISOString() });
        if (lista && m === "GET") {
          const cal = decodeURIComponent(lista[1]);
          if (cal === "otro@gmail.com") return Response.json({ items: [{ id: "x1", summary: "Culto", start: { dateTime: at(D(3), "09:00") }, end: { dateTime: at(D(3), "11:00") } }] });
          if (fase === "dos") {
            return Response.json({
              items: [
                // La cita se movió en Google después de copiarla.
                { id: "nuevo-copia", summary: "Cita con el dentista", updated: futuro(), start: { dateTime: at(D(5), "15:00") }, end: { dateTime: at(D(5), "16:00") }, ...yo },
                { id: "n1", summary: "Comprar el regalo", updated: futuro(), start: { dateTime: at(D(4), "17:00") }, end: { dateTime: at(D(4), "18:00") }, ...yo },
                { id: "k9", summary: "Borrado en Kairos", extendedProperties: { private: { kairos: "e-ya-no" } }, start: { dateTime: at(D(4), "08:00") }, end: { dateTime: at(D(4), "09:00") }, ...yo },
              ],
            });
          }
          return Response.json({
            items: [
              { id: "s1_a", recurringEventId: "s1", summary: "Lectura bíblica", start: { dateTime: at(D(1), "06:00") }, end: { dateTime: at(D(1), "07:00") }, ...yo },
              { id: "o1", summary: "Cita con el dentista", start: { dateTime: at(D(5), "10:00") }, end: { dateTime: at(D(5), "11:00") }, ...yo },
              { id: "g1", summary: "Reunión con Dcasa", attendees: [{ email: "a" }, { email: "b" }], start: { dateTime: at(D(2), "14:00") }, end: { dateTime: at(D(2), "15:00") }, ...yo },
            ],
          });
        }
        if (uno && m === "GET") {
          const id = decodeURIComponent(uno[2]);
          if (id === "s1") return Response.json({ id, summary: "Lectura bíblica", recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"], start: { dateTime: at("2026-01-05", "06:00") }, end: { dateTime: at("2026-01-05", "07:00") } });
          // La cita la borró Juan en Google (paso 2): no existe.
          return new Response("{}", { status: 404 });
        }
        if (uno && (m === "PATCH" || m === "PUT")) return Response.json({ updated: new Date().toISOString() });
        if (uno && m === "DELETE") return new Response(null, { status: 204 });
        return new Response("{}", { status: 404 });
      }),
    );
    await pedir("/api/alta", { metodo: "POST", datos: { codigo: "codigo-secreto", nombre: "Juan", email: "j@e.co", contrasena: "una contraseña larga" } });
    const permiso = new URL((await pedir("/api/google/conectar", { metodo: "POST", datos: {} })).datos.url);
    await pedir(`/api/google/vuelta?code=c&state=${permiso.searchParams.get("state")}`);

    // 1. Traer: dice qué pasa, sin guardar ni tocar Google.
    llamadas.length = 0;
    const plan = (await pedir("/api/google/traer", { metodo: "POST", datos: {} })).datos;
    expect(plan.ok).toBe(true);
    expect(plan.ritmo.map((x) => [x.titulo, x.clase, x.google])).toEqual([["Lectura bíblica", "compromiso", "s1"]]);
    expect(plan.eventos.map((x) => [x.titulo, x.google.id])).toEqual([["Cita con el dentista", "o1"]]);
    expect(plan.fuera).toMatchObject({ conGente: 1, ajenos: 1 });
    expect(llamadas.filter((l) => !l.startsWith("GET"))).toEqual([]);

    // La pantalla lo pone (como `cambiar`): ligado a su original, NO se vuelve a crear en Google.
    const cita = plan.eventos[0];
    await pedir(`/api/elementos/evento/${cita.id}`, { metodo: "PUT", datos: cita });
    const e0 = (await pedir("/api/estado")).datos;
    await pedir("/api/perfil", { metodo: "PUT", datos: { ajustes: e0.ajustes, ritmo: [...e0.ritmo, ...plan.ritmo] } });
    await pedir("/api/elementos/accion/a1", { metodo: "PUT", datos: { id: "a1", titulo: "Llamar al banco", estado: "abierta", lista: "siguientes", sombrero: "personal" } });
    expect(llamadas.filter((l) => /events/.test(l) && l.startsWith("POST"))).toEqual([]);
    expect((await pedir("/api/google/principal", { metodo: "POST", datos: { estado: "traspaso" } })).datos.estado).toBe("traspaso");

    // 2-3. Juan borró la cita en Google; copiar la crea otra vez, sube la semana y la tarea que falta, y quedan en los dos sentidos.
    llamadas.length = 0;
    const copia = (await pedir("/api/google/copiar", { metodo: "POST", datos: { desde: 0 } })).datos;
    expect(copia).toMatchObject({ ok: true, quedan: 0 });
    expect(llamadas).toContain("POST /calendars");
    expect(llamadas.filter((l) => l === "POST /calendars/kairos-cal/events").length).toBeGreaterThan(0);
    expect(llamadas).toContain("POST /calendars/primary/events");
    expect(llamadas).toContain("POST /tasks/lists/lista1/tasks");
    let e = (await pedir("/api/estado")).datos;
    expect(e.conexiones[0].principal).toBe("dos");
    const citaCopiada = e.eventos.find((x) => x.id === cita.id);
    expect(citaCopiada.google.id).not.toBe("o1");

    // La copia allá se llama «nuevo-copia» en la siguiente lectura (la de mentira la renombra).
    await pedir(`/api/elementos/evento/${cita.id}`, { metodo: "PUT", datos: { ...citaCopiada, google: { ...citaCopiada.google, id: "nuevo-copia" } } });

    // Los dos sentidos: la cita movida en Google vuelve, lo nuevo y suyo entra, lo huérfano de Kairos se borra allá y la tarea borrada allá se borra aquí.
    fase = "dos";
    llamadas.length = 0;
    await pedir("/api/google/sincronizar", { metodo: "POST", datos: {} });
    e = (await pedir(`/api/estado?desde=${D(-7)}&hasta=${D(60)}`)).datos;
    expect(e.eventos.find((x) => x.id === cita.id)).toMatchObject({ inicio: "15:00", fin: "16:00" });
    expect(e.eventos.find((x) => x.google?.id === "n1")).toMatchObject({ titulo: "Comprar el regalo", inicio: "17:00", origen: "google" });
    expect(llamadas).toContain("DELETE /calendars/juan@agencia.com/events/k9");
    expect(e.acciones.find((x) => x.id === "a1")).toBeUndefined();
    // La Lectura bíblica (la rutina) no se toca desde Google.
    expect(e.ritmo.find((x) => x.google === "s1")).toMatchObject({ clase: "compromiso" });
  });
});
