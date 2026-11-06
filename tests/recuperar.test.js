import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import worker from "../worker/index.js";
import { d1EnMemoria } from "./utils/d1Memoria.js";

const BASE = "https://agenda.ejemplo";
const TOKEN = "123456:TOKEN-DE-PRUEBA";
let env;
let enviados; // lo que se le pidió a Telegram

const pedir = async (ruta, { metodo = "GET", datos, cookie = "" } = {}) => {
  const res = await worker.fetch(
    new Request(BASE + ruta, {
      method: metodo,
      headers: { ...(datos ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
      body: datos ? JSON.stringify(datos) : undefined,
    }),
    env,
  );
  const galleta = res.headers.get("set-cookie");
  return { estado: res.status, datos: await res.json().catch(() => null), cookie: galleta ? galleta.split(";")[0] : "" };
};

const CLAVE = "una contraseña larga";
const darDeAlta = async () => (await pedir("/api/alta", { metodo: "POST", datos: { codigo: "codigo-secreto", nombre: "Juan", email: "juan@ejemplo.com", contrasena: CLAVE } })).cookie;
const entrar = (contrasena) => pedir("/api/acceso", { metodo: "POST", datos: { email: "juan@ejemplo.com", contrasena } });

/** Ata un chat de Telegram a la cuenta como lo haría «Conectar Telegram». */
const atarTelegram = (chat = 99) => env.DB.prepare("insert into telegram (owner_id, chat_id, vinculado) select id, ?, '2026-01-01' from usuarios").bind(String(chat)).run();

beforeEach(() => {
  env = { DB: d1EnMemoria(), CODIGO_ALTA: "codigo-secreto", TELEGRAM_BOT_TOKEN: TOKEN, ASSETS: { fetch: async () => new Response("app") } };
  enviados = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      if (String(url).startsWith(`https://api.telegram.org/bot${TOKEN}/`)) {
        enviados.push(JSON.parse(init.body));
        return Response.json({ ok: true, result: {} });
      }
      return new Response("no", { status: 404 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const enlaceDe = (m) => /\/recuperar\?t=([0-9a-f]{64})/.exec(m.text)?.[1];

describe("¿Olvidaste tu contraseña?", () => {
  it("por Telegram: un enlace de un solo uso a SU chat, que pone la nueva y cierra las sesiones", async () => {
    const vieja = await darDeAlta();
    await atarTelegram(99);
    const r = await pedir("/api/recuperar/telegram", { metodo: "POST", datos: {} });
    expect(r.estado).toBe(200);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].chat_id).toBe("99");
    const token = enlaceDe(enviados[0]);
    expect(token).toBeTruthy();
    // El testigo no se guarda en claro.
    expect(JSON.stringify((await env.DB.prepare("select * from oauth_pendientes").all()).results)).not.toContain(token);

    // Muy corta: no se gasta el enlace.
    expect((await pedir("/api/recuperar/enlace", { metodo: "POST", datos: { token, contrasena: "corta" } })).estado).toBe(400);
    const ok = await pedir("/api/recuperar/enlace", { metodo: "POST", datos: { token, contrasena: "otra contraseña nueva" } });
    expect(ok.estado).toBe(200);
    expect(ok.cookie).toMatch(/^__Host-sesion=/);
    // Entra con la nueva (la sesión que trae ya vale), no con la vieja; la sesión de antes se cerró.
    expect((await pedir("/api/estado", { cookie: ok.cookie })).estado).toBe(200);
    expect((await pedir("/api/estado", { cookie: vieja })).estado).toBe(401);
    expect((await entrar(CLAVE)).estado).toBe(401);
    expect((await entrar("otra contraseña nueva")).estado).toBe(200);
    // Sirve una sola vez.
    expect((await pedir("/api/recuperar/enlace", { metodo: "POST", datos: { token, contrasena: "una tercera contraseña" } })).estado).toBe(403);
  });

  it("no llena el chat: un enlace cada dos minutos como mucho", async () => {
    await darDeAlta();
    await atarTelegram();
    await pedir("/api/recuperar/telegram", { metodo: "POST", datos: {} });
    const otra = await pedir("/api/recuperar/telegram", { metodo: "POST", datos: {} });
    expect(otra.datos.yaEnviado).toBe(true);
    expect(enviados).toHaveLength(1);
  });

  it("un enlace caducado o inventado no sirve, y cuenta como intento fallido", async () => {
    await darDeAlta();
    await atarTelegram();
    await pedir("/api/recuperar/telegram", { metodo: "POST", datos: {} });
    const token = enlaceDe(enviados[0]);
    await env.DB.prepare("update oauth_pendientes set caduca = '2000-01-01T00:00:00.000Z'").run();
    expect((await pedir("/api/recuperar/enlace", { metodo: "POST", datos: { token, contrasena: "otra contraseña nueva" } })).estado).toBe(403);
    for (let i = 0; i < 4; i++) await pedir("/api/recuperar/enlace", { metodo: "POST", datos: { token: "f".repeat(64), contrasena: "otra contraseña nueva" } });
    // Cinco fallos: la puerta se cierra también para entrar.
    expect((await entrar(CLAVE)).estado).toBe(429);
  });

  it("sin Telegram conectado lo dice, y se puede con el código de alta", async () => {
    await darDeAlta();
    expect((await pedir("/api/recuperar/telegram", { metodo: "POST", datos: {} })).estado).toBe(409);
    expect((await pedir("/api/recuperar/codigo", { metodo: "POST", datos: { codigo: "otro", contrasena: "otra contraseña nueva" } })).estado).toBe(403);
    const ok = await pedir("/api/recuperar/codigo", { metodo: "POST", datos: { codigo: "codigo-secreto", contrasena: "otra contraseña nueva" } });
    expect(ok.estado).toBe(200);
    expect((await entrar("otra contraseña nueva")).estado).toBe(200);
  });

  it("sin CODIGO_ALTA en el Worker, el código no abre nada", async () => {
    await darDeAlta();
    delete env.CODIGO_ALTA;
    expect((await pedir("/api/recuperar/codigo", { metodo: "POST", datos: { codigo: "", contrasena: "otra contraseña nueva" } })).estado).toBe(403);
  });
});

describe("cambiar la contraseña con la sesión abierta", () => {
  it("pide la de ahora y cierra las demás sesiones", async () => {
    const a = await darDeAlta();
    const b = (await entrar(CLAVE)).cookie;
    expect((await pedir("/api/contrasena", { metodo: "PUT", datos: { actual: "mal", nueva: "otra contraseña nueva" }, cookie: a })).estado).toBe(403);
    const r = await pedir("/api/contrasena", { metodo: "PUT", datos: { actual: CLAVE, nueva: "otra contraseña nueva" }, cookie: a });
    expect(r.estado).toBe(200);
    expect((await pedir("/api/estado", { cookie: r.cookie })).estado).toBe(200);
    expect((await pedir("/api/estado", { cookie: b })).estado).toBe(401);
    expect((await entrar("otra contraseña nueva")).estado).toBe(200);
  });

  it("sin sesión no se cambia nada", async () => {
    await darDeAlta();
    expect((await pedir("/api/contrasena", { metodo: "PUT", datos: { actual: CLAVE, nueva: "otra contraseña nueva" } })).estado).toBe(401);
  });
});
