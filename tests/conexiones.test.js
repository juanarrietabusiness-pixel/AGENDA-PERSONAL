import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import worker from "../worker/index.js";
import { d1EnMemoria } from "./utils/d1Memoria.js";
import { leerTareas, leerClientes, cambiosDesdeJuancito } from "../worker/lib/juancito.js";
import { deEventoGoogle, aEventoGoogle, aTareaGoogle, cambiosDesdeGoogle, cifrar, descifrar, deCalendarioGoogle, calendariosALeer, calendarioParaGuardar } from "../worker/lib/google.js";
import { queToca } from "../worker/lib/seguimiento.js";
import { nuevaAccion } from "../src/lib/metodo.js";
import { AJUSTES_BASE } from "../src/lib/ajustes.js";

const BASE = "https://agenda.ejemplo";
let env;
let cookie = "";

const pedir = async (ruta, { metodo = "GET", datos, cabeceras = {}, sinCookie = false } = {}) => {
  const req = new Request(BASE + ruta, {
    method: metodo,
    redirect: "manual",
    headers: { ...(datos ? { "content-type": "application/json" } : {}), ...(cookie && !sinCookie ? { cookie } : {}), ...cabeceras },
    body: datos ? JSON.stringify(datos) : undefined,
  });
  const res = await worker.fetch(req, env);
  const galleta = res.headers.get("set-cookie");
  if (galleta && !sinCookie) cookie = galleta.split(";")[0];
  return { estado: res.status, datos: await res.clone().json().catch(() => null), res };
};

const darDeAlta = () =>
  pedir("/api/alta", { metodo: "POST", datos: { codigo: "codigo-secreto", nombre: "Juan Arrieta", email: "juan@ejemplo.com", contrasena: "una contraseña larga" } });

const estado = async () => (await pedir("/api/estado")).datos;

beforeEach(() => {
  env = { DB: d1EnMemoria(), CODIGO_ALTA: "codigo-secreto", ANTHROPIC_API_KEY: "llave", ASSETS: { fetch: async () => new Response("app") } };
  cookie = "";
});
afterEach(() => vi.unstubAllGlobals());

// ------------------------------------------------------------
// Juancito Ads
// ------------------------------------------------------------

const TAREAS = `Café Luna:
· Revisar copys vence 2026-11-10 → Ana (id t1)
· Grabar reel marcada para 2026-11-07 (id t2)
· Mandar factura (hecha) (id t3)

Sin empresa (rápidas):
· Llamar al contador → Juan Arrieta (id q1)`;

describe("Juancito Ads: lo que se lee de allá", () => {
  it("lee las tareas con su id, cliente, fechas y a quién van", () => {
    const t = leerTareas(TAREAS);
    expect(t).toEqual([
      { id: "t1", titulo: "Revisar copys", cliente: "Café Luna", hecha: false, vence: "2026-11-10", para: null, asignada: "Ana" },
      { id: "t2", titulo: "Grabar reel", cliente: "Café Luna", hecha: false, vence: null, para: "2026-11-07", asignada: null },
      { id: "t3", titulo: "Mandar factura", cliente: "Café Luna", hecha: true, vence: null, para: null, asignada: null },
      { id: "q1", titulo: "Llamar al contador", cliente: null, hecha: false, vence: null, para: null, asignada: "Juan Arrieta" },
    ]);
  });

  it("sin id no hay tarea (no se puede marcar después)", () => {
    expect(leerTareas("Café Luna:\n· Algo sin id")).toEqual([]);
  });

  it("los clientes, por su nombre", () => {
    expect(leerClientes("Clientes:\n· Café Luna — restaurante · @cafe\n· Dcasa · @dcasa\nnada")).toEqual(["Café Luna", "Dcasa"]);
  });

  it("lo hecho allá se marca aquí; lo nuevo de Juan o sin asignar entra en su sombrero", () => {
    const local = nuevaAccion({ titulo: "Mandar factura", sombrero: "trabajo", lista: "siguientes", juancito: { id: "t3" } }, "2026-11-06");
    const cambios = cambiosDesdeJuancito(leerTareas(TAREAS), [local], { hoy: "2026-11-06", sombrero: "trabajo", nombre: "Juan Arrieta" });
    const hecha = cambios.find((a) => a.id === local.id);
    expect(hecha).toMatchObject({ estado: "hecha", hechaEl: "2026-11-06" });
    const nuevas = cambios.filter((a) => a.id !== local.id);
    // t1 es de Ana: no entra. t2 (sin asignar) y q1 (de Juan) sí.
    expect(nuevas.map((a) => a.juancito.id).sort()).toEqual(["q1", "t2"]);
    expect(nuevas.find((a) => a.juancito.id === "t2")).toMatchObject({ sombrero: "trabajo", cliente: "Café Luna", cuando: "2026-11-07", lista: "siguientes", origen: "juancito-ads" });
  });

  it("con «todas», también lo de otras personas", () => {
    const cambios = cambiosDesdeJuancito(leerTareas(TAREAS), [], { hoy: "2026-11-06", sombrero: "trabajo", nombre: "Juan", todas: true });
    expect(cambios.map((a) => a.juancito.id).sort()).toEqual(["q1", "t1", "t2"]);
  });
});

/** Un calendario de marketing de mentira: su OAuth y su MCP, por el binding. */
function calendarioFalso() {
  const llamadas = [];
  let tareas = TAREAS;
  let siguiente = 10;
  const binding = {
    fetch: vi.fn(async (req) => {
      const u = new URL(req.url);
      expect(u.origin).toBe("https://calendario.juancitoads.com");
      if (u.pathname === "/oauth/register") {
        const b = await req.json();
        llamadas.push({ ruta: "register", b });
        return Response.json({ client_id: "cliente-agenda" }, { status: 201 });
      }
      if (u.pathname === "/oauth/token") {
        const b = Object.fromEntries(new URLSearchParams(await req.text()));
        llamadas.push({ ruta: "token", b });
        return Response.json({ access_token: `acceso-${llamadas.length}`, refresh_token: `renovacion-${llamadas.length}`, expires_in: 3600 });
      }
      if (u.pathname === "/mcp") {
        expect(req.headers.get("authorization")).toMatch(/^Bearer acceso-/);
        const m = await req.json();
        const { name, arguments: args } = m.params;
        llamadas.push({ ruta: "mcp", name, args });
        let text = "";
        if (name === "listar_clientes") text = "· Café Luna — restaurante\n· Dcasa";
        else if (name === "ver_tareas") text = tareas;
        else if (name === "crear_tarea") text = `Tarea creada: «${args.titulo}» (id t${siguiente++})`;
        else if (name === "completar_tarea") text = "Hecha.";
        return Response.json({ jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text }] } });
      }
      return new Response("no", { status: 404 });
    }),
  };
  return { binding, llamadas, cambiarTareas: (t) => (tareas = t) };
}

describe("Juancito Ads: conectar y que todo vaya y venga", () => {
  it("conecta como Claude (registro, PKCE, código), crea allá lo que se agenda aquí y marca hecho en los dos sentidos", async () => {
    const cal = calendarioFalso();
    env.JUANCITO = cal.binding;
    await darDeAlta();

    // 1. Conectar: se registra la agenda y se da la dirección del permiso.
    const r1 = await pedir("/api/juancito/conectar", { metodo: "POST", datos: {} });
    expect(r1.estado).toBe(200);
    const permiso = new URL(r1.datos.url);
    expect(permiso.origin + permiso.pathname).toBe("https://calendario.juancitoads.com/conectar-claude");
    expect(permiso.searchParams.get("client_id")).toBe("cliente-agenda");
    expect(permiso.searchParams.get("code_challenge_method")).toBe("S256");
    expect(permiso.searchParams.get("redirect_uri")).toBe(`${BASE}/api/juancito/vuelta`);
    expect(cal.llamadas[0].b.redirect_uris).toEqual([`${BASE}/api/juancito/vuelta`]);

    // Un estado inventado no sirve.
    const malo = await pedir(`/api/juancito/vuelta?code=abc&state=inventado`);
    expect(malo.estado).toBe(302);
    expect(decodeURIComponent(malo.res.headers.get("location"))).toMatch(/caducó/);

    // 2. La vuelta con el código: canjea (con el verificador) y se pone al día.
    const r2 = await pedir(`/api/juancito/vuelta?code=codigo-1&state=${permiso.searchParams.get("state")}`);
    expect(r2.estado).toBe(302);
    expect(decodeURIComponent(r2.res.headers.get("location"))).toMatch(/quedó conectado/);
    const canje = cal.llamadas.find((l) => l.ruta === "token");
    expect(canje.b).toMatchObject({ grant_type: "authorization_code", code: "codigo-1", client_id: "cliente-agenda" });
    expect(canje.b.code_verifier).toMatch(/^[0-9a-f]{64}$/);

    // El estado sólo sirve una vez.
    expect(decodeURIComponent((await pedir(`/api/juancito/vuelta?code=codigo-1&state=${permiso.searchParams.get("state")}`)).res.headers.get("location"))).toMatch(/caducó/);

    // Lo de allá ya está aquí (t2 y q1), y la conexión dice que está conectada.
    let e = await estado();
    expect(e.acciones.map((a) => a.juancito?.id).filter(Boolean).sort()).toEqual(["q1", "t2"]);
    expect(e.conexiones.find((c) => c.servicio === "juancito")).toMatchObject({ conectada: true, error: null });

    // 3. Agendar aquí en el sombrero de Juancito Ads: se crea allá al momento y guarda su id.
    const nueva = nuevaAccion({ titulo: "Propuesta para Dcasa", sombrero: "trabajo", lista: "siguientes", cliente: "Dcasa", limite: "2026-11-20" }, "2026-11-06");
    expect((await pedir(`/api/elementos/accion/${nueva.id}`, { metodo: "PUT", datos: nueva })).estado).toBe(200);
    const crear = cal.llamadas.find((l) => l.name === "crear_tarea");
    expect(crear.args).toEqual({ titulo: "Propuesta para Dcasa", cliente: "Dcasa", fecha_limite: "2026-11-20" });
    e = await estado();
    const guardada = e.acciones.find((a) => a.id === nueva.id);
    expect(guardada.juancito.id).toBe("t10");

    // 4. Marcarla hecha aquí la marca allá.
    await pedir(`/api/elementos/accion/${nueva.id}`, { metodo: "PUT", datos: { ...guardada, estado: "hecha", hechaEl: "2026-11-06" } });
    expect(cal.llamadas.find((l) => l.name === "completar_tarea").args).toEqual({ tarea_id: "t10" });

    // 5. Lo que se marca hecho allá se marca aquí.
    cal.cambiarTareas(TAREAS.replace("Grabar reel marcada para 2026-11-07 (id t2)", "Grabar reel (hecha) (id t2)"));
    const s = await pedir("/api/juancito/sincronizar", { metodo: "POST", datos: {} });
    expect(s.datos).toMatchObject({ ok: true });
    e = await estado();
    expect(e.acciones.find((a) => a.juancito?.id === "t2").estado).toBe("hecha");
  });

  it("lo de otro sombrero no va a Juancito Ads, y sin conexión no se llama a nadie", async () => {
    const cal = calendarioFalso();
    env.JUANCITO = cal.binding;
    await darDeAlta();
    const a = nuevaAccion({ titulo: "Ensayo", sombrero: "artistico", lista: "siguientes" }, "2026-11-06");
    await pedir(`/api/elementos/accion/${a.id}`, { metodo: "PUT", datos: a });
    const b = nuevaAccion({ titulo: "Informe", sombrero: "trabajo", lista: "siguientes" }, "2026-11-06");
    await pedir(`/api/elementos/accion/${b.id}`, { metodo: "PUT", datos: b });
    expect(cal.binding.fetch).not.toHaveBeenCalled();
  });

  it("si allá retiran el permiso, la conexión se marca y pide volver a conectar", async () => {
    const cal = calendarioFalso();
    env.JUANCITO = cal.binding;
    await darDeAlta();
    const permiso = new URL((await pedir("/api/juancito/conectar", { metodo: "POST", datos: {} })).datos.url);
    await pedir(`/api/juancito/vuelta?code=c&state=${permiso.searchParams.get("state")}`);
    // El token caduca y la renovación falla.
    await env.DB.prepare("update conexiones set datos = json_set(datos, '$.tokens.caduca', 0) where servicio = 'juancito'").run();
    cal.binding.fetch.mockImplementation(async (req) => {
      const u = new URL(req.url);
      if (u.pathname === "/oauth/token") return Response.json({ error: "invalid_grant", error_description: "La conexión se desconectó." }, { status: 400 });
      return new Response("no", { status: 500 });
    });
    const r = await pedir("/api/juancito/sincronizar", { metodo: "POST", datos: {} });
    expect(r.datos.ok).toBe(false);
    const c = (await estado()).conexiones.find((x) => x.servicio === "juancito");
    expect(c.conectada).toBe(false);
    expect(c.error).toMatch(/Vuelve a conectar/);
  });
});

// ------------------------------------------------------------
// Google Calendar y Google Tasks
// ------------------------------------------------------------

describe("Google: de allá a aquí y de aquí a allá", () => {
  it("un evento con hora se pasa a la hora de Panamá; uno de todo el día, sin hora", () => {
    const e = deEventoGoogle({ id: "g1", summary: "Reunión con Adolfo", start: { dateTime: "2026-11-07T15:00:00Z" }, end: { dateTime: "2026-11-07T16:00:00Z" }, attendees: [{}, {}] }, { cuenta: "juan@x.com", calendario: "primary" });
    expect(e).toMatchObject({ id: "g1", dia: "2026-11-07", inicio: "10:00", fin: "11:00", titulo: "Reunión con Adolfo", conGente: true, todoElDia: false });
    expect(deEventoGoogle({ id: "g2", summary: "Feriado", start: { date: "2026-11-28" }, end: { date: "2026-11-29" } }, { cuenta: "a", calendario: "primary" })).toMatchObject({ dia: "2026-11-28", inicio: null, todoElDia: true });
  });

  it("un evento de aquí: con hora de Panamá, y los que se repiten con su RRULE", () => {
    expect(aEventoGoogle({ titulo: "Ensayo", fecha: "2026-11-07", inicio: "18:00", fin: "20:00" })).toMatchObject({
      summary: "Ensayo",
      start: { dateTime: "2026-11-07T18:00:00", timeZone: "America/Panama" },
      end: { dateTime: "2026-11-07T20:00:00", timeZone: "America/Panama" },
    });
    expect(aEventoGoogle({ titulo: "Célula", repite: { regla: "FREQ=WEEKLY;BYDAY=TH", inicio: "2026-11-05" }, inicio: "19:30", fin: "21:00" }).recurrence).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=TH"]);
  });

  it("una tarea: la fecha como día y la hora en las notas", () => {
    expect(aTareaGoogle({ titulo: "Pagar luz", limite: "2026-11-15", hora: "09:00", estado: "abierta" })).toEqual({ title: "Pagar luz", notes: "A las 09:00", due: "2026-11-15T00:00:00.000Z", status: "needsAction" });
  });

  it("lo hecho o reabierto allá se refleja aquí; lo nuevo entra en el sombrero de esa cuenta", () => {
    const local = nuevaAccion({ titulo: "Pagar luz", sombrero: "personal", lista: "siguientes", google: { id: "k1" } }, "2026-11-06");
    const cambios = cambiosDesdeGoogle(
      [
        { id: "k1", title: "Pagar luz", status: "completed" },
        { id: "k2", title: "Comprar regalo", status: "needsAction", due: "2026-11-20T00:00:00.000Z" },
        { id: "k3", title: "Ya hecha", status: "completed" },
        { id: "k4", title: "Borrada", deleted: true },
      ],
      [local],
      { hoy: "2026-11-06", cuenta: "juan@x.com", servicio: "google:juan@x.com", sombrero: "personal" },
    );
    expect(cambios).toHaveLength(2);
    expect(cambios[0]).toMatchObject({ id: local.id, estado: "hecha" });
    expect(cambios[1]).toMatchObject({ titulo: "Comprar regalo", sombrero: "personal", limite: "2026-11-20", origen: "google" });
  });

  it("los permisos se guardan cifrados y sólo se leen con el secreto", async () => {
    const guardado = await cifrar({ GOOGLE_CLIENT_SECRET: "secreto" }, "1//renovacion");
    expect(guardado).not.toContain("renovacion");
    expect(await descifrar({ GOOGLE_CLIENT_SECRET: "secreto" }, guardado)).toBe("1//renovacion");
    await expect(descifrar({ GOOGLE_CLIENT_SECRET: "otro" }, guardado)).rejects.toThrow();
  });

  it("conectar una cuenta: sus eventos salen en el estado y lo que se agenda con hora se crea en su calendario", async () => {
    env.GOOGLE_CLIENT_ID = "id-google";
    env.GOOGLE_CLIENT_SECRET = "secreto-google";
    const creados = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init = {}) => {
        const u = String(url);
        if (u === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "ya29", refresh_token: "1//r", expires_in: 3600 });
        if (u.startsWith("https://openidconnect.googleapis.com/")) return Response.json({ email: "Juan@Gmail.com" });
        if (u.includes("/calendars/primary/events?")) return Response.json({ items: [{ id: "ev1", summary: "Cita médica", start: { dateTime: "2099-01-05T14:00:00Z" }, end: { dateTime: "2099-01-05T15:00:00Z" } }] });
        if (u.endsWith("/calendars/primary/events") && init.method === "POST") {
          creados.push(JSON.parse(init.body));
          return Response.json({ id: "nuevo-ev" });
        }
        if (u.includes("tasks.googleapis.com") && (init.method ?? "GET") === "GET") return Response.json({ items: [] });
        if (u.includes("tasks.googleapis.com") && init.method === "POST") return Response.json({ id: "nueva-tarea" });
        return new Response("{}", { status: 404 });
      }),
    );
    await darDeAlta();
    const r = await pedir("/api/google/conectar", { metodo: "POST", datos: {} });
    const permiso = new URL(r.datos.url);
    expect(permiso.searchParams.get("access_type")).toBe("offline");
    expect(permiso.searchParams.get("scope")).toContain("https://www.googleapis.com/auth/tasks");
    const v = await pedir(`/api/google/vuelta?code=c&state=${permiso.searchParams.get("state")}`);
    expect(decodeURIComponent(v.res.headers.get("location"))).toMatch(/juan@gmail\.com\) quedó conectado/);

    // El permiso no se guarda en claro.
    const fila = await env.DB.prepare("select datos from conexiones where servicio = 'google:juan@gmail.com'").first();
    expect(fila.datos).not.toContain("1//r");
    expect(fila.datos).not.toContain("ya29");

    const e = await pedir("/api/estado?desde=2099-01-01&hasta=2099-01-31");
    expect(e.datos.externos).toEqual([expect.objectContaining({ id: "ev1", titulo: "Cita médica", inicio: "09:00" })]);
    // La primera cuenta lleva todos los sombreros; las tareas, menos el de Juancito Ads.
    expect(e.datos.conexiones[0].ajustes.tareasDe).toEqual(["artistico", "iglesia", "personal"]);

    const ev = { id: "e1", titulo: "Ensayo", fecha: "2099-01-06", inicio: "18:00", fin: "20:00", sombrero: "artistico", clase: "reunion" };
    await pedir("/api/elementos/evento/e1", { metodo: "PUT", datos: ev });
    expect(creados[0]).toMatchObject({ summary: "Ensayo", start: { dateTime: "2099-01-06T18:00:00" } });
    const despues = await pedir("/api/estado?desde=2099-01-01&hasta=2099-01-31");
    expect(despues.datos.eventos.find((x) => x.id === "e1").google).toMatchObject({ id: "nuevo-ev", cuenta: "juan@gmail.com" });
  });
});

describe("Google con UNA cuenta: todos sus calendarios", () => {
  const LISTA = [
    { id: "juan@agencia.com", summary: "juan@agencia.com", primary: true, accessRole: "owner", backgroundColor: "#4d9bff" },
    { id: "juan@gmail.com", summary: "juan@gmail.com", summaryOverride: "Personal", accessRole: "writer", backgroundColor: "#43c07a" },
    { id: "es.pa#holiday@group.v.calendar.google.com", summary: "Festivos en Panamá", accessRole: "reader" },
    { id: "oculto@group.calendar.google.com", summary: "Viejo", accessRole: "owner", selected: false },
  ];

  it("lee los que se ven en Google Calendar; guarda en el escogido sólo si se puede escribir en él", () => {
    const lista = LISTA.map(deCalendarioGoogle);
    expect(lista[1]).toEqual({ id: "juan@gmail.com", nombre: "Personal", principal: false, escribir: true, visible: true, color: "#43c07a" });
    expect(calendariosALeer(lista, {})).toEqual(["juan@agencia.com", "juan@gmail.com", "es.pa#holiday@group.v.calendar.google.com"]);
    expect(calendariosALeer(lista, { leer: ["juan@gmail.com", "no-existe"] })).toEqual(["juan@gmail.com"]);
    expect(calendariosALeer([], {})).toEqual(["primary"]);
    const datos = { lista, ajustes: { guardarEn: { personal: "juan@gmail.com", iglesia: "es.pa#holiday@group.v.calendar.google.com" } } };
    expect(calendarioParaGuardar(datos, "personal")).toBe("juan@gmail.com");
    expect(calendarioParaGuardar(datos, "iglesia")).toBe("primary"); // sólo lectura: al principal
    expect(calendarioParaGuardar(datos, "trabajo")).toBe("primary");
  });

  it("de punta a punta: lee el calendario compartido, los feriados van a especiales y cada sombrero se guarda en el suyo", async () => {
    env.GOOGLE_CLIENT_ID = "id-google";
    env.GOOGLE_CLIENT_SECRET = "secreto-google";
    const creados = [];
    const leidos = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init = {}) => {
        const u = String(url);
        if (u === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "ya29", refresh_token: "1//r", expires_in: 3600 });
        if (u.startsWith("https://openidconnect.googleapis.com/")) return Response.json({ email: "juan@agencia.com" });
        if (u.includes("/users/me/calendarList")) return Response.json({ items: LISTA });
        const ev = /\/calendars\/([^/]+)\/events(\?|$)/.exec(u);
        if (ev && (init.method ?? "GET") === "GET") {
          const cal = decodeURIComponent(ev[1]);
          leidos.push(cal);
          const items = {
            "juan@agencia.com": [{ id: "w1", summary: "Reunión con Dcasa", start: { dateTime: "2099-01-05T14:00:00Z" }, end: { dateTime: "2099-01-05T15:00:00Z" } }],
            "juan@gmail.com": [{ id: "p1", summary: "Cena con María", start: { dateTime: "2099-01-05T23:00:00Z" }, end: { dateTime: "2099-01-06T01:00:00Z" } }],
            "es.pa#holiday@group.v.calendar.google.com": [{ id: "h1", summary: "Día de los Mártires", start: { date: "2099-01-09" }, end: { date: "2099-01-10" } }],
          }[cal] ?? [];
          return Response.json({ items });
        }
        if (ev && init.method === "POST") {
          creados.push({ cal: decodeURIComponent(ev[1]), cuerpo: JSON.parse(init.body) });
          return Response.json({ id: `nuevo-${creados.length}` });
        }
        if (u.includes("tasks.googleapis.com")) return Response.json({ items: [] });
        return new Response("{}", { status: 404 });
      }),
    );
    await darDeAlta();
    const permiso = new URL((await pedir("/api/google/conectar", { metodo: "POST", datos: {} })).datos.url);
    await pedir(`/api/google/vuelta?code=c&state=${permiso.searchParams.get("state")}`);

    // Lee los tres que se ven (no el oculto), con su nombre.
    expect([...new Set(leidos)].sort()).toEqual(["es.pa#holiday@group.v.calendar.google.com", "juan@agencia.com", "juan@gmail.com"]);
    let e = (await pedir("/api/estado?desde=2099-01-01&hasta=2099-01-31")).datos;
    expect(e.conexiones[0].calendarios.map((k) => k.nombre)).toEqual(["juan@agencia.com", "Personal", "Festivos en Panamá", "Viejo"]);
    expect(e.externos.find((x) => x.id === "p1")).toMatchObject({ titulo: "Cena con María", inicio: "18:00", calendarioNombre: "Personal", color: "#43c07a" });
    expect(e.externos.find((x) => x.id === "h1")).toMatchObject({ todoElDia: true, dia: "2099-01-09" });

    // Lo de Personal se guarda en el calendario compartido; un calendario de sólo lectura no se acepta.
    expect((await pedir("/api/google/juan%40agencia.com", { metodo: "PUT", datos: { guardarEn: { personal: "juan@gmail.com", iglesia: "es.pa#holiday@group.v.calendar.google.com" } } })).estado).toBe(200);
    e = (await pedir("/api/estado")).datos;
    expect(e.conexiones[0].ajustes.guardarEn).toEqual({ personal: "juan@gmail.com" });
    await pedir("/api/elementos/evento/e1", { metodo: "PUT", datos: { id: "e1", titulo: "Aniversario: cena", fecha: "2099-01-07", inicio: "19:00", fin: "21:00", sombrero: "personal", clase: "reunion" } });
    await pedir("/api/elementos/evento/e2", { metodo: "PUT", datos: { id: "e2", titulo: "Reunión de equipo", fecha: "2099-01-07", inicio: "09:00", fin: "10:00", sombrero: "trabajo", clase: "reunion" } });
    expect(creados.map((x) => [x.cal, x.cuerpo.summary])).toEqual([["juan@gmail.com", "Aniversario: cena"], ["juan@agencia.com", "Reunión de equipo"].map((v, i) => (i === 0 ? "primary" : v))]);
    e = (await pedir("/api/estado?desde=2099-01-01&hasta=2099-01-31")).datos;
    expect(e.eventos.find((x) => x.id === "e1").google).toMatchObject({ calendario: "juan@gmail.com", id: "nuevo-1" });

    // Quitar uno de los que se ven: ya no se lee.
    leidos.length = 0;
    await pedir("/api/google/juan%40agencia.com", { metodo: "PUT", datos: { leer: ["juan@agencia.com", "juan@gmail.com"] } });
    expect([...new Set(leidos)].sort()).toEqual(["juan@agencia.com", "juan@gmail.com"]);
    e = (await pedir("/api/estado?desde=2099-01-01&hasta=2099-01-31")).datos;
    expect(e.externos.find((x) => x.id === "h1")).toBeUndefined();
  });
});

// ------------------------------------------------------------
// Claude (el MCP de la agenda)
// ------------------------------------------------------------

const b64url = (bytes) => Buffer.from(bytes).toString("base64url");
const reto = async (v) => b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v))));

describe("Claude: la agenda como MCP", () => {
  const conectarClaude = async () => {
    const reg = await pedir("/oauth/register", { metodo: "POST", datos: { client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] }, sinCookie: true });
    expect(reg.estado).toBe(201);
    const verificador = "v".repeat(50);
    const permiso = await pedir("/api/mcp/autorizar", {
      metodo: "POST",
      datos: { client_id: reg.datos.client_id, redirect_uri: "https://claude.ai/api/mcp/auth_callback", code_challenge: await reto(verificador), code_challenge_method: "S256", state: "xyz" },
    });
    expect(permiso.estado).toBe(200);
    const vuelta = new URL(permiso.datos.redireccion);
    expect(vuelta.searchParams.get("state")).toBe("xyz");
    const token = await pedir("/oauth/token", {
      metodo: "POST",
      sinCookie: true,
      datos: { grant_type: "authorization_code", code: vuelta.searchParams.get("code"), client_id: reg.datos.client_id, redirect_uri: "https://claude.ai/api/mcp/auth_callback", code_verifier: verificador },
    });
    expect(token.estado).toBe(200);
    return { ...token.datos, clienteId: reg.datos.client_id, codigo: vuelta.searchParams.get("code"), verificador };
  };

  const mcp = (acceso, mensaje) => pedir("/mcp", { metodo: "POST", datos: mensaje, cabeceras: { authorization: `Bearer ${acceso}` }, sinCookie: true });

  it("los metadatos dicen cómo conectarse", async () => {
    const r = await pedir("/.well-known/oauth-authorization-server", { sinCookie: true });
    expect(r.datos).toMatchObject({ authorization_endpoint: `${BASE}/autorizar`, token_endpoint: `${BASE}/oauth/token`, code_challenge_methods_supported: ["S256"] });
    const s = await pedir("/mcp", { metodo: "POST", datos: { jsonrpc: "2.0", id: 1, method: "initialize" }, sinCookie: true });
    expect(s.estado).toBe(401);
    expect(s.res.headers.get("www-authenticate")).toContain("/.well-known/oauth-protected-resource");
  });

  it("permiso con PKCE, un código de un solo uso y las herramientas", async () => {
    await darDeAlta();
    const t = await conectarClaude();
    expect(t.access_token).toBeTruthy();
    // El código ya se usó.
    const otra = await pedir("/oauth/token", { metodo: "POST", sinCookie: true, datos: { grant_type: "authorization_code", code: t.codigo, client_id: t.clienteId, redirect_uri: "https://claude.ai/api/mcp/auth_callback", code_verifier: t.verificador } });
    expect(otra.estado).toBe(400);

    const lista = await mcp(t.access_token, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(lista.datos.result.tools.map((x) => x.name)).toEqual(["capturar", "ver_agenda", "completar", "buscar"]);

    // Una tarea para ver y completar.
    const a = nuevaAccion({ titulo: "Llamar a Adolfo", sombrero: "iglesia", lista: "siguientes", cuando: "2026-01-01" }, "2026-01-01");
    await pedir(`/api/elementos/accion/${a.id}`, { metodo: "PUT", datos: a });
    const ver = await mcp(t.access_token, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "buscar", arguments: { texto: "adolfo" } } });
    expect(ver.datos.result.content[0].text).toContain(`Llamar a Adolfo [Iglesia]`);
    expect(ver.datos.result.content[0].text).toContain(`(id ${a.id})`);
    const hecha = await mcp(t.access_token, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "completar", arguments: { id: a.id } } });
    expect(hecha.datos.result.content[0].text).toBe("Hecha: «Llamar a Adolfo».");
    expect((await estado()).acciones.find((x) => x.id === a.id).estado).toBe("hecha");

    // Desconectar corta al momento.
    await pedir("/api/mcp/desconectar", { metodo: "POST", datos: {} });
    expect((await mcp(t.access_token, { jsonrpc: "2.0", id: 4, method: "tools/list" })).estado).toBe(401);
  });

  it("capturar pasa por el mismo asistente que la app", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ content: [{ type: "text", text: '```json\n{"respuesta":"Listo","elementos":[{"tipo":"accion","clase":"recordatorio","titulo":"Comprar flores","sombrero":"personal","cuando":"2099-02-14","hora":"09:00"}]}\n```' }], usage: { input_tokens: 10, output_tokens: 10 } }), { status: 200 }),
      ),
    );
    await darDeAlta();
    const t = await conectarClaude();
    const r = await mcp(t.access_token, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "capturar", arguments: { texto: "el 14 de febrero recuérdame comprar flores a las 9" } } });
    expect(r.datos.result.content[0].text).toMatch(/Recordatorio: «Comprar flores»/);
    const e = await estado();
    expect(e.acciones.find((a) => a.titulo === "Comprar flores")).toMatchObject({ clase: "recordatorio", hora: "09:00" });
    expect(e.conversacion[0]).toMatchObject({ canal: "claude" });
  });

  it("un código que no casa con su verificador no da token", async () => {
    await darDeAlta();
    const reg = await pedir("/oauth/register", { metodo: "POST", datos: { client_name: "Claude", redirect_uris: ["https://claude.ai/cb"] }, sinCookie: true });
    const p = await pedir("/api/mcp/autorizar", { metodo: "POST", datos: { client_id: reg.datos.client_id, redirect_uri: "https://claude.ai/cb", code_challenge: await reto("w".repeat(50)), code_challenge_method: "S256" } });
    const code = new URL(p.datos.redireccion).searchParams.get("code");
    const r = await pedir("/oauth/token", { metodo: "POST", sinCookie: true, datos: { grant_type: "authorization_code", code, client_id: reg.datos.client_id, redirect_uri: "https://claude.ai/cb", code_verifier: "x".repeat(50) } });
    expect(r.estado).toBe(400);
    // Y una dirección de vuelta que no es la registrada no recibe código.
    expect((await pedir("/api/mcp/autorizar", { metodo: "POST", datos: { client_id: reg.datos.client_id, redirect_uri: "https://otro.com/cb", code_challenge: await reto("w".repeat(50)), code_challenge_method: "S256" } })).estado).toBe(400);
  });
});

// ------------------------------------------------------------
// El seguimiento por Telegram
// ------------------------------------------------------------

describe("el seguimiento: qué se manda y cuándo", () => {
  const base = (cambios = {}) => ({
    ajustes: { ...AJUSTES_BASE, nombre: "Juan", ...cambios },
    ritmo: [],
    eventos: [],
    acciones: [],
    proyectos: [],
  });
  const hoy = "2026-11-09"; // lunes

  it("apagado no manda nada", () => {
    const estado = base({ seguimiento: { ...AJUSTES_BASE.seguimiento, activo: false } });
    expect(queToca({ estado, ahora: AJUSTES_BASE.avisos.resumen[1], hoy })).toEqual([]);
  });

  it("el resumen sale a su hora, y no antes", () => {
    const estado = base();
    const hora = estado.ajustes.avisos.resumen[1];
    expect(queToca({ estado, ahora: hora, hoy }).map((m) => m.clave)).toContain(`resumen:${hoy}`);
    const [h, m] = hora.split(":").map(Number);
    const antes = `${String(h - 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    expect(queToca({ estado, ahora: antes, hoy }).map((m) => m.clave)).not.toContain(`resumen:${hoy}`);
  });

  it("media hora antes de una reunión avisa, si está encendido", () => {
    const reunion = { id: "r1", titulo: "Reunión con Adolfo", fecha: hoy, inicio: "15:00", fin: "16:00", clase: "reunion" };
    const estado = { ...base(), eventos: [reunion] };
    expect(queToca({ estado, ahora: "14:31", hoy }).find((m) => m.clave === `reunion:r1:${hoy}`)?.texto).toMatch(/En media hora: Reunión con Adolfo/);
    const sin = { ...estado, ajustes: { ...estado.ajustes, seguimiento: { ...estado.ajustes.seguimiento, reuniones: false } } };
    expect(queToca({ estado: sin, ahora: "14:31", hoy }).find((m) => m.clave.startsWith("reunion:"))).toBeUndefined();
  });

  it("en el cierre pregunta por lo que se planeó y no se decidió, con botones", () => {
    const a = nuevaAccion({ titulo: "Mandar la propuesta", sombrero: "trabajo", lista: "siguientes", cuando: "2026-11-06" }, "2026-11-05");
    const estado = { ...base(), acciones: [a] };
    let pregunta = null;
    for (let h = 16; h <= 23 && !pregunta; h++) {
      for (const m of ["00", "30"]) {
        pregunta = queToca({ estado, ahora: `${h}:${m}`, hoy }).find((x) => x.clave.startsWith("pregunta:")) ?? pregunta;
        if (pregunta) break;
      }
    }
    expect(pregunta).toBeTruthy();
    expect(pregunta.botones[0].map((b) => b.callback_data)).toEqual([`h:${a.id}`, `m:${a.id}`, `s:${a.id}`]);
    expect(pregunta.marcar[0].id).toBe(a.id);
  });
});
