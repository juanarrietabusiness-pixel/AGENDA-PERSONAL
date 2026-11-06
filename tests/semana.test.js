import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import worker from "../worker/index.js";
import { d1EnMemoria } from "./utils/d1Memoria.js";
import { conReino, rutinaDeGoogle, textoDias, horasPorSombrero, ahoraYDespues, tareasDelBloque, carga, semanaDelDia, sombreroPorTitulo } from "../src/lib/semana.js";
import { aplicarRitmo, RITMO_BASE } from "../src/lib/ritmo.js";
import { SOMBREROS, sombrerosDe } from "../src/lib/sombreros.js";
import { claseDeGoogle } from "../src/lib/agenda.js";
import { nuevaAccion } from "../src/lib/metodo.js";
import { aEventoBloque } from "../worker/lib/google.js";

const LUNES = "2026-11-09";
const bloque = (datos) => aplicarRitmo([], { accion: "agregar", ...datos }).bloque;

describe("Reino", () => {
  it("entra primero, una sola vez, y se lleva lo devocional de la semana", () => {
    const { perfil, cambio } = conReino({ ajustes: {}, ritmo: RITMO_BASE });
    expect(cambio).toBe(true);
    expect(sombrerosDe(perfil.ajustes).map((s) => s.id)).toEqual(["reino", "trabajo", "artistico", "iglesia", "personal"]);
    expect(perfil.ritmo.filter((e) => e.devocional).every((e) => e.sombrero === "reino")).toBe(true);
    expect(perfil.ritmo.find((e) => e.id === "celula").sombrero).toBe("iglesia");
    expect(conReino(perfil).cambio).toBe(false);
  });

  it("si ya había un sombrero «Reino» no lo repite", () => {
    const { perfil } = conReino({ ajustes: { sombreros: [...SOMBREROS, { id: "mi-reino", nombre: "Reino" }] }, ritmo: [] });
    expect(sombrerosDe(perfil.ajustes).filter((s) => s.nombre === "Reino")).toHaveLength(1);
  });

  it("al cargar el estado, el servidor lo pone una vez", async () => {
    const env = { DB: d1EnMemoria(), CODIGO_ALTA: "c", ASSETS: { fetch: async () => new Response("") } };
    const r = await worker.fetch(new Request("https://a.e/api/alta", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ codigo: "c", nombre: "Juan", email: "j@e.co", contrasena: "una contraseña larga" }) }), env);
    const cookie = r.headers.get("set-cookie").split(";")[0];
    const e = await (await worker.fetch(new Request("https://a.e/api/estado", { headers: { cookie } }), env)).json();
    expect(e.ajustes.sombreros[0]).toMatchObject({ id: "reino", nombre: "Reino" });
    expect(e.ajustes.reino).toBe(true);
  });
});

describe("tu semana por bloques", () => {
  const ritmo = [
    bloque({ titulo: "Reino", sombrero: "reino", inicio: "06:00", fin: "08:00", dias: [1, 2, 3, 4, 5], protegido: true }),
    bloque({ titulo: "Trabajo", sombrero: "trabajo", inicio: "08:00", fin: "12:00", dias: [1, 2, 3, 4, 5] }),
    bloque({ titulo: "Trabajo tarde", sombrero: "trabajo", inicio: "13:00", fin: "18:00", dias: [1, 2, 3, 4, 5] }),
    bloque({ titulo: "Proverbios", sombrero: "reino", clase: "recordatorio", inicio: "11:45", dias: [1, 2, 3, 4, 5], antes: 15 }),
  ];

  it("un recordatorio no necesita fin (son 5 minutos) y los días se leen en corto", () => {
    expect(ritmo[3]).toMatchObject({ clase: "recordatorio", inicio: "11:45", fin: "11:50", antes: 15 });
    expect(textoDias(ritmo[0])).toBe("L–V");
    expect(textoDias(bloque({ titulo: "x", inicio: "09:00", fin: "10:00", dias: [1, 3, 5] }))).toBe("L, X, V");
    expect(() => aplicarRitmo([], { accion: "agregar", titulo: "x", inicio: "09:00", fin: "10:00", dias: [1], antes: 500 })).toThrow(/120/);
  });

  it("qué toca ahora y qué sigue", () => {
    const r = ahoraYDespues(ritmo, LUNES, "09:30");
    expect(r.ahora.titulo).toBe("Trabajo");
    expect(r.despues.map((e) => e.titulo)).toEqual(["Proverbios", "Trabajo tarde"]);
    expect(ahoraYDespues(ritmo, "2026-11-08", "09:30").ahora).toBeNull(); // domingo
    expect(semanaDelDia(ritmo, LUNES).recordatorios.map((e) => e.titulo)).toEqual(["Proverbios"]);
  });

  it("las tareas de un bloque: las asignadas y las del sombrero sin otro bloque; su carga", () => {
    const acciones = [
      nuevaAccion({ id: "a1", titulo: "Propuesta Dcasa", sombrero: "trabajo", lista: "siguientes", cuando: LUNES, minutos: 120 }),
      nuevaAccion({ id: "a2", titulo: "Llamar al contador", sombrero: "trabajo", lista: "siguientes", cuando: LUNES, bloque: ritmo[2].id, minutos: 30 }),
      nuevaAccion({ id: "a3", titulo: "Ensayo", sombrero: "artistico", lista: "siguientes", cuando: LUNES }),
    ];
    acciones[1].bloque = ritmo[2].id;
    const manana = tareasDelBloque(acciones, ritmo[1], LUNES, { todos: ritmo });
    expect(manana.map((a) => a.id)).toEqual(["a1"]);
    const tarde = tareasDelBloque(acciones, ritmo[2], LUNES, { todos: ritmo });
    expect(tarde.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
    expect(carga(manana, ritmo[1])).toEqual({ ocupado: 120, cabe: 240, sobra: -120 });
  });

  it("las horas de cada sombrero salen de los bloques", () => {
    const h = horasPorSombrero(ritmo, conReino({ ajustes: {}, ritmo: [] }).perfil.ajustes.sombreros);
    expect(h.find((x) => x.id === "trabajo").minutos).toBe((240 + 300) * 5);
    expect(h.find((x) => x.id === "reino").minutos).toBe(120 * 5);
  });
});

describe("traer la rutina de Google a tu semana", () => {
  const ev = (id, serie, dia, titulo, inicio, fin) => ({ id, serie, tipo: "evento", dia, titulo, inicio, fin });
  const externos = [
    ev("o1", "s-orac", "2026-11-09", "Oración", "06:00", "06:45"),
    ev("o2", "s-orac", "2026-11-10", "Oración", "06:00", "06:45"),
    ev("p1", "s-prov", "2026-11-09", "Lectura de Proverbios", "11:45", "11:55"),
    ev("t1", "s-trab", "2026-11-09", "Inicio de trabajo", "08:00", "12:00"),
    ev("m1", "s-ment", "2026-11-14", "Mentoría", "09:00", "10:00"),
  ];
  const ajustes = conReino({ ajustes: {}, ritmo: [] }).perfil.ajustes;
  const esRutina = (x) => claseDeGoogle(x, ajustes) === "rutina";

  it("una entrada por serie, con sus días, su sombrero sugerido; lo corto es recordatorio; la mentoría no", () => {
    const { nuevos } = rutinaDeGoogle(externos, [], { ajustes, esRutina });
    expect(nuevos.map((n) => n.titulo).sort()).toEqual(["Inicio de trabajo", "Lectura de Proverbios", "Oración"]);
    const orac = nuevos.find((n) => n.titulo === "Oración");
    expect(orac).toMatchObject({ sombrero: "reino", clase: "bloque", protegido: true, google: "s-orac" });
    expect(orac.repite.regla).toBe("FREQ=WEEKLY;BYDAY=MO,TU");
    expect(nuevos.find((n) => n.titulo === "Lectura de Proverbios")).toMatchObject({ clase: "recordatorio", sombrero: "reino" });
    expect(nuevos.find((n) => n.titulo === "Inicio de trabajo").sombrero).toBe("trabajo");
  });

  it("no trae dos veces, y quita lo «por confirmar» de partida que cae a la misma hora", () => {
    const base = [{ ...RITMO_BASE.find((e) => e.id === "oracion-madrugada"), inicio: "06:00", fin: "07:00", porConfirmar: true }];
    const { nuevos, quitar } = rutinaDeGoogle(externos, base, { ajustes, esRutina });
    expect(quitar).toEqual(["oracion-madrugada"]);
    expect(rutinaDeGoogle(externos, nuevos, { ajustes, esRutina }).nuevos).toEqual([]);
    expect(sombreroPorTitulo("Ensayo con la banda", sombrerosDe(ajustes))).toBe("artistico");
  });
});

describe("publicar tu semana en Google («Kairos · Bloques»)", () => {
  let env;
  let cookie;
  const pedir = async (ruta, { metodo = "GET", datos } = {}) => {
    const res = await worker.fetch(new Request(`https://agenda.ejemplo${ruta}`, { method: metodo, headers: { ...(datos ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: datos ? JSON.stringify(datos) : undefined, redirect: "manual" }), env);
    const g = res.headers.get("set-cookie");
    if (g) cookie = g.split(";")[0];
    return { estado: res.status, datos: await res.clone().json().catch(() => null), res };
  };
  beforeEach(() => {
    env = { DB: d1EnMemoria(), CODIGO_ALTA: "c", GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secreto", ASSETS: { fetch: async () => new Response("") } };
    cookie = "";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("el evento de un bloque se repite con su regla y empieza en un día que toca", () => {
    const b = bloque({ titulo: "Trabajo", sombrero: "trabajo", inicio: "08:00", fin: "12:00", dias: [1, 2, 3, 4, 5] });
    const e = aEventoBloque(b, SOMBREROS);
    expect(e.recurrence).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"]);
    expect(e.start.dateTime).toBe("2026-01-05T08:00:00");
    expect(e.description).toContain("Bloque de Trabajo");
  });

  it("crea el calendario, sube la semana, cambia sólo lo cambiado, quita lo quitado y no lo lee de vuelta", async () => {
    const llamadas = [];
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init = {}) => {
        const u = String(url);
        const m = init.method ?? "GET";
        llamadas.push(`${m} ${u.replace("https://www.googleapis.com/calendar/v3", "")}`);
        if (u === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "ya29", refresh_token: "1//r", expires_in: 3600 });
        if (u.startsWith("https://openidconnect.googleapis.com/")) return Response.json({ email: "juan@agencia.com" });
        if (u.includes("/users/me/calendarList")) return Response.json({ items: [{ id: "juan@agencia.com", summary: "juan@agencia.com", primary: true, accessRole: "owner" }, { id: "kairos-cal", summary: "Kairos · Bloques", accessRole: "owner" }] });
        if (u.endsWith("/calendars") && m === "POST") return Response.json({ id: "kairos-cal" });
        if (u.includes("/calendars/kairos-cal/events") && m === "POST") return Response.json({ id: `ev${++n}` });
        if (m === "PUT" || m === "DELETE") return new Response(null, { status: m === "DELETE" ? 204 : 200, headers: { "content-type": "application/json" } });
        if (u.includes("/events?")) return Response.json({ items: [] });
        if (u.includes("tasks.googleapis.com")) return Response.json({ items: [] });
        return new Response("{}", { status: 404 });
      }),
    );
    await pedir("/api/alta", { metodo: "POST", datos: { codigo: "c", nombre: "Juan", email: "j@e.co", contrasena: "una contraseña larga" } });
    const permiso = new URL((await pedir("/api/google/conectar", { metodo: "POST", datos: {} })).datos.url);
    await pedir(`/api/google/vuelta?code=c&state=${permiso.searchParams.get("state")}`);
    let e = (await pedir("/api/estado")).datos;
    const ritmo = [
      bloque({ titulo: "Reino", sombrero: "reino", inicio: "06:00", fin: "08:00", dias: [1, 2, 3, 4, 5] }),
      bloque({ titulo: "Trabajo", sombrero: "trabajo", inicio: "08:00", fin: "12:00", dias: [1, 2, 3, 4, 5] }),
    ];
    await pedir("/api/perfil", { metodo: "PUT", datos: { ritmo } });
    llamadas.length = 0;
    expect((await pedir("/api/google/semana", { metodo: "POST", datos: { publicar: true } })).datos).toMatchObject({ ok: true, cambios: 2 });
    expect(llamadas.filter((l) => l.startsWith("POST"))).toEqual(["POST /calendars", "POST /calendars/kairos-cal/events", "POST /calendars/kairos-cal/events"]);
    e = (await pedir("/api/estado")).datos;
    const g = e.conexiones.find((c) => c.servicio.startsWith("google:"));
    expect(g.semana).toBe(true);
    expect(g.calendarios.map((k) => k.id)).toEqual(["juan@agencia.com"]);

    // Cambiar un bloque y quitar el otro: un PUT y un DELETE, nada más.
    llamadas.length = 0;
    await pedir("/api/perfil", { metodo: "PUT", datos: { ritmo: [{ ...ritmo[1], fin: "12:30" }] } });
    expect(llamadas.filter((l) => /^(PUT|DELETE|POST) \/calendars\/kairos-cal/.test(l))).toEqual(["PUT /calendars/kairos-cal/events/ev2", "DELETE /calendars/kairos-cal/events/ev1"]);

    // Al leer Google, el calendario de la semana no se lee.
    llamadas.length = 0;
    await pedir("/api/google/sincronizar", { metodo: "POST", datos: {} });
    expect(llamadas.some((l) => l.includes("/calendars/kairos-cal/events?"))).toBe(false);

    // Dejar de publicar borra el calendario.
    llamadas.length = 0;
    await pedir("/api/google/semana", { metodo: "POST", datos: { publicar: false } });
    expect(llamadas).toContain("DELETE /calendars/kairos-cal");
  });
});
