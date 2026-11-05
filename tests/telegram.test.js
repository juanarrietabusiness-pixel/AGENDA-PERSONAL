import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import worker from "../worker/index.js";
import { d1EnMemoria } from "./utils/d1Memoria.js";
import { secretoWebhook, MODELO_VOZ } from "../worker/lib/telegram.js";

const BASE = "https://agenda.ejemplo";
const TOKEN = "123456:TOKEN-DE-PRUEBA";
let env;
let cookie = "";
let telegram; // lo que se le pidió a Telegram: [{ metodo, datos }]
let respuestaModelo;

const pedir = async (ruta, { metodo = "GET", datos, cabeceras = {} } = {}) => {
  const req = new Request(BASE + ruta, {
    method: metodo,
    headers: { ...(datos ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...cabeceras },
    body: datos ? JSON.stringify(datos) : undefined,
  });
  const res = await worker.fetch(req, env);
  const galleta = res.headers.get("set-cookie");
  if (galleta) cookie = galleta.split(";")[0];
  return { estado: res.status, datos: await res.json().catch(() => null), res };
};

const darDeAlta = () =>
  pedir("/api/alta", { metodo: "POST", datos: { codigo: "codigo-secreto", nombre: "Juan", email: "juan@ejemplo.com", contrasena: "una contraseña larga" } });

/** Lo que manda Telegram al webhook, con su secreto. */
const aviso = async (update, secreto) =>
  worker.fetch(
    new Request(`${BASE}/api/telegram/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secreto ?? (await secretoWebhook(env)) },
      body: JSON.stringify(update),
    }),
    env,
  );

let siguiente = 1;
const mensaje = (chat, extra) => ({ update_id: siguiente++, message: { message_id: siguiente++, chat: { id: chat, type: "private" }, from: { first_name: "Juan" }, ...extra } });
const enviados = () => telegram.filter((t) => t.metodo === "sendMessage");

beforeEach(() => {
  env = {
    DB: d1EnMemoria(),
    CODIGO_ALTA: "codigo-secreto",
    ANTHROPIC_API_KEY: "llave",
    TELEGRAM_BOT_TOKEN: TOKEN,
    AI: { run: vi.fn(async () => ({ text: "El viernes a las 10 llamar a Adolfo" })) },
    ASSETS: { fetch: async () => new Response("app") },
  };
  cookie = "";
  telegram = [];
  respuestaModelo = { elementos: [{ tipo: "accion", titulo: "Llamar a Adolfo", sombrero: "iglesia", cuando: "2099-01-02" }], respuesta: "Listo" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      const u = String(url);
      if (u.startsWith(`https://api.telegram.org/file/bot${TOKEN}/`)) return new Response(new Uint8Array([1, 2, 3, 4]));
      if (u.startsWith(`https://api.telegram.org/bot${TOKEN}/`)) {
        const metodo = u.split("/").pop();
        telegram.push({ metodo, datos: JSON.parse(init.body) });
        const result = metodo === "getMe" ? { username: "agenda_juan_bot" } : metodo === "getFile" ? { file_path: "voice/nota.oga" } : true;
        return new Response(JSON.stringify({ ok: true, result }));
      }
      if (u === "https://api.anthropic.com/v1/messages") {
        return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(respuestaModelo) }], usage: { input_tokens: 10, output_tokens: 10 } }));
      }
      throw new Error(`fetch inesperado: ${u}`);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

/** Da de alta, conecta y ata el chat 555. */
async function conectado() {
  await darDeAlta();
  const r = await pedir("/api/telegram/conectar", { metodo: "POST", datos: {} });
  const codigo = new URL(r.datos.enlace).searchParams.get("start");
  await aviso(mensaje(555, { text: `/start ${codigo}` }));
  telegram = [];
  return codigo;
}

describe("Telegram", () => {
  it("sin token, la aplicación lo dice y el webhook no existe", async () => {
    delete env.TELEGRAM_BOT_TOKEN;
    await darDeAlta();
    expect((await pedir("/api/telegram")).datos).toMatchObject({ configurado: false, vinculado: false });
    expect((await pedir("/api/telegram/conectar", { metodo: "POST", datos: {} })).estado).toBe(409);
    expect((await aviso({}, "x")).status).toBe(404);
  });

  it("conectar registra el webhook con su secreto y da un enlace de un solo uso", async () => {
    await darDeAlta();
    const r = await pedir("/api/telegram/conectar", { metodo: "POST", datos: {} });
    expect(r.estado).toBe(200);
    expect(r.datos.bot).toBe("agenda_juan_bot");
    expect(r.datos.enlace).toMatch(/^https:\/\/t\.me\/agenda_juan_bot\?start=[0-9a-f]{32}$/);
    const webhook = telegram.find((t) => t.metodo === "setWebhook").datos;
    expect(webhook.url).toBe(`${BASE}/api/telegram/webhook`);
    expect(webhook.secret_token).toBe(await secretoWebhook(env));
    expect(webhook.secret_token).not.toContain(TOKEN);
    // Del código sólo queda la huella.
    const codigo = new URL(r.datos.enlace).searchParams.get("start");
    expect(JSON.stringify(env.DB.crudo.prepare("select * from telegram").all())).not.toContain(codigo);
    // Y el token no sale nunca hacia el navegador.
    expect(JSON.stringify((await pedir("/api/telegram")).datos)).not.toContain(TOKEN);
  });

  it("sin el secreto de Telegram no entra nada, y cuenta como intento fallido", async () => {
    await conectado();
    expect((await aviso(mensaje(555, { text: "hola" }), "otro")).status).toBe(403);
    expect(env.DB.crudo.prepare("select count(*) as n from intentos_acceso").get().n).toBe(1);
    expect(env.DB.crudo.prepare("select count(*) as n from capturas").get().n).toBe(0);
  });

  it("el /start con el código ata el chat; el código no sirve dos veces y a un desconocido no se le contesta", async () => {
    const codigo = await conectado();
    expect((await pedir("/api/telegram")).datos).toMatchObject({ configurado: true, vinculado: true, nombre: "Juan" });
    await aviso(mensaje(999, { text: `/start ${codigo}` }));
    await aviso(mensaje(999, { text: "acuérdame algo" }));
    expect(enviados()).toEqual([]);
    expect(env.DB.crudo.prepare("select count(*) as n from capturas").get().n).toBe(0);
  });

  it("un mensaje del chat atado se ordena y la respuesta trae la tarjeta y «Deshacer»", async () => {
    await conectado();
    const m = mensaje(555, { text: "El viernes llamar a Adolfo" });
    expect((await aviso(m)).status).toBe(200);
    const [r] = enviados();
    expect(r.datos.chat_id).toBe(555);
    expect(r.datos.text).toMatch(/^Listo:/);
    expect(r.datos.text).toContain("Llamar a Adolfo");
    expect(r.datos.reply_markup.inline_keyboard[0][0]).toMatchObject({ text: "Deshacer" });
    const c = env.DB.crudo.prepare("select canal, estado from capturas").all();
    expect(c).toEqual([{ canal: "telegram", estado: "ordenada" }]);
    // Telegram repite el aviso: no se guarda ni se paga dos veces.
    await aviso(m);
    expect(env.DB.crudo.prepare("select count(*) as n from capturas").get().n).toBe(1);
    expect(enviados()).toHaveLength(1);
  });

  it("«Deshacer» quita lo que hizo y lo dice en el mismo mensaje", async () => {
    await conectado();
    await aviso(mensaje(555, { text: "El viernes llamar a Adolfo" }));
    const [r] = enviados();
    const data = r.datos.reply_markup.inline_keyboard[0][0].callback_data;
    await aviso({ update_id: siguiente++, callback_query: { id: "cq1", data, message: { message_id: 77, chat: { id: 555 }, text: r.datos.text } } });
    expect(env.DB.crudo.prepare("select estado from capturas").get().estado).toBe("deshecha");
    expect((await pedir("/api/estado")).datos.acciones).toEqual([]);
    expect(telegram.find((t) => t.metodo === "editMessageText").datos.text).toMatch(/Deshecho/);
    // Un botón pulsado desde otro chat no deshace nada.
    await aviso({ update_id: siguiente++, callback_query: { id: "cq2", data, message: { message_id: 78, chat: { id: 999 } } } });
    expect(telegram.filter((t) => t.metodo === "editMessageText")).toHaveLength(1);
  });

  it("una nota de voz se transcribe con Whisper en español y se ordena como «voz»", async () => {
    await conectado();
    await aviso(mensaje(555, { voice: { file_id: "abc", file_size: 4000 } }));
    expect(env.AI.run).toHaveBeenCalledWith(MODELO_VOZ, expect.objectContaining({ language: "es", audio: "AQIDBA==" }));
    const [r] = enviados();
    expect(r.datos.text).toMatch(/^Escuché: «El viernes a las 10 llamar a Adolfo»/);
    expect(env.DB.crudo.prepare("select canal, texto from capturas").get()).toEqual({ canal: "voz", texto: "El viernes a las 10 llamar a Adolfo" });
  });

  it("si la IA falla, contesta que quedó en la Bandeja", async () => {
    await conectado();
    respuestaModelo = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        const u = String(url);
        if (u.startsWith("https://api.telegram.org/")) {
          telegram.push({ metodo: u.split("/").pop(), datos: JSON.parse(init.body) });
          return new Response(JSON.stringify({ ok: true, result: true }));
        }
        return new Response(JSON.stringify({ error: { type: "invalid_request_error", message: "Your credit balance is too low" } }), { status: 400 });
      }),
    );
    await aviso(mensaje(555, { text: "comprar pan" }));
    expect(enviados()[0].datos.text).toMatch(/Bandeja/);
    expect(env.DB.crudo.prepare("select estado from capturas").get().estado).toBe("error");
  });

  it("desconectar suelta el chat: deja de contestarle", async () => {
    await conectado();
    await pedir("/api/telegram/desconectar", { metodo: "POST", datos: {} });
    await aviso(mensaje(555, { text: "hola" }));
    expect(enviados()).toEqual([]);
  });
});
