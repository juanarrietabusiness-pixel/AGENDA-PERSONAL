import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import worker from "../worker/index.js";
import { d1EnMemoria } from "./utils/d1Memoria.js";
import { derivar, MAX_POR_LLAMADA } from "../worker/lib/sesion.js";

const BASE = "https://agenda.ejemplo";
let env;
let cookie = "";

const pedir = async (ruta, { metodo = "GET", datos, sinCookie = false, cabeceras = {} } = {}) => {
  const req = new Request(BASE + ruta, {
    method: metodo,
    headers: { ...(datos ? { "content-type": "application/json" } : {}), ...(cookie && !sinCookie ? { cookie } : {}), ...cabeceras },
    body: datos ? JSON.stringify(datos) : undefined,
  });
  const res = await worker.fetch(req, env);
  const galleta = res.headers.get("set-cookie");
  if (galleta) cookie = galleta.split(";")[0];
  return { estado: res.status, datos: await res.json().catch(() => null), res };
};

/** Una respuesta de Anthropic con este JSON como texto. */
const respuestaIA = (obj) =>
  new Response(JSON.stringify({ content: [{ type: "thinking", thinking: "" }, { type: "text", text: "```json\n" + JSON.stringify(obj) + "\n```" }], usage: { input_tokens: 6000, output_tokens: 800 } }), { status: 200 });

beforeEach(() => {
  env = { DB: d1EnMemoria(), CODIGO_ALTA: "codigo-secreto", ANTHROPIC_API_KEY: "llave", ASSETS: { fetch: async () => new Response("app") } };
  cookie = "";
});
afterEach(() => vi.unstubAllGlobals());

const darDeAlta = () => pedir("/api/alta", { metodo: "POST", datos: { codigo: "codigo-secreto", nombre: "Juan", email: "Juan@Ejemplo.com", contrasena: "una contraseña larga" } });

describe("el acceso", () => {
  it("la primera cuenta sólo con el código, y nunca una segunda", async () => {
    expect((await pedir("/api/arranque")).datos).toEqual({ usuario: null, alta: true });
    expect((await pedir("/api/alta", { metodo: "POST", datos: { codigo: "otro", email: "a@b.co", contrasena: "1234567890" } })).estado).toBe(403);
    const r = await darDeAlta();
    expect(r.estado).toBe(201);
    expect(r.res.headers.get("set-cookie")).toMatch(/^__Host-sesion=[0-9a-f]{64}; Path=\/; HttpOnly; Secure; SameSite=Lax/);
    expect((await pedir("/api/arranque")).datos.usuario).toMatchObject({ email: "juan@ejemplo.com", nombre: "Juan" });
    cookie = "";
    expect((await darDeAlta()).estado).toBe(409);
    expect((await pedir("/api/arranque")).datos).toEqual({ usuario: null, alta: false });
  });

  it("sin CODIGO_ALTA no hay alta", async () => {
    delete env.CODIGO_ALTA;
    expect((await pedir("/api/arranque")).datos.alta).toBe(false);
    expect((await darDeAlta()).estado).toBe(403);
  });

  it("entrar, salir y lo que pide sesión", async () => {
    await darDeAlta();
    cookie = "";
    expect((await pedir("/api/estado")).estado).toBe(401);
    expect((await pedir("/api/acceso", { metodo: "POST", datos: { email: "juan@ejemplo.com", contrasena: "mal" } })).estado).toBe(401);
    expect((await pedir("/api/acceso", { metodo: "POST", datos: { email: "juan@ejemplo.com", contrasena: "una contraseña larga" } })).estado).toBe(200);
    const e = await pedir("/api/estado");
    expect(e.estado).toBe(200);
    expect(e.datos.ajustes.nombre).toBe("Juan");
    expect(e.datos.ritmo.find((x) => x.id === "celula")).toBeTruthy();
    expect(e.datos.llaves).toEqual({ anthropic: true, meta: false });
    await pedir("/api/salir", { metodo: "POST", datos: {} });
    expect((await pedir("/api/estado")).estado).toBe(401);
  });

  it("PBKDF2 en tramos de 100.000: el tope de workerd", async () => {
    const original = crypto.subtle.deriveBits.bind(crypto.subtle);
    const pedidas = [];
    vi.spyOn(crypto.subtle, "deriveBits").mockImplementation((alg, ...resto) => {
      pedidas.push(alg.iterations);
      return original(alg, ...resto);
    });
    await derivar("x", "00ff", 600_000);
    expect(pedidas).toHaveLength(6);
    expect(Math.max(...pedidas)).toBeLessThanOrEqual(MAX_POR_LLAMADA);
    vi.restoreAllMocks();
  });

  it("lo que cambia algo no puede venir de otra web", async () => {
    await darDeAlta();
    const r = await pedir("/api/perfil", { metodo: "PUT", datos: { ajustes: {} }, cabeceras: { origin: "https://malo.ejemplo" } });
    expect(r.estado).toBe(403);
  });

  it("las respuestas de la API llevan sus cabeceras de seguridad", async () => {
    const r = await pedir("/api/salud");
    expect(r.res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.res.headers.get("cache-control")).toBe("no-store");
    expect(r.res.headers.get("content-security-policy")).toMatch(/default-src 'none'/);
    expect(r.res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("cinco fallos desde una IP cierran la entrada a esa IP, aunque luego acierte", async () => {
    await darDeAlta();
    cookie = "";
    const intento = (contrasena, ip = "1.1.1.1") =>
      pedir("/api/acceso", { metodo: "POST", datos: { email: "juan@ejemplo.com", contrasena }, cabeceras: { "cf-connecting-ip": ip } });
    for (let i = 0; i < 5; i++) expect((await intento("mal")).estado).toBe(401);
    const cerrada = await intento("una contraseña larga");
    expect(cerrada.estado).toBe(429);
    expect(cerrada.res.headers.get("retry-after")).toBe("900");
    expect(cerrada.datos.error).toMatch(/Espera 15 minutos/);
    // Otra IP sí entra, y entrar bien borra sus propios fallos.
    expect((await intento("mal", "2.2.2.2")).estado).toBe(401);
    expect((await intento("una contraseña larga", "2.2.2.2")).estado).toBe(200);
    expect(env.DB.crudo.prepare("select count(*) as n from intentos_acceso where clave = 'ip:2.2.2.2'").get().n).toBe(0);
  });

  it("no calcula la contraseña con la entrada cerrada (cada intento cuesta CPU)", async () => {
    await darDeAlta();
    cookie = "";
    for (let i = 0; i < 5; i++) await pedir("/api/acceso", { metodo: "POST", datos: { email: "juan@ejemplo.com", contrasena: "mal" } });
    const espia = vi.spyOn(crypto.subtle, "deriveBits");
    expect((await pedir("/api/acceso", { metodo: "POST", datos: { email: "juan@ejemplo.com", contrasena: "mal" } })).estado).toBe(429);
    expect(espia).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("un código de alta equivocado también cuenta", async () => {
    const malo = () => pedir("/api/alta", { metodo: "POST", datos: { codigo: "otro", email: "a@b.co", contrasena: "1234567890" } });
    for (let i = 0; i < 5; i++) expect((await malo()).estado).toBe(403);
    expect((await darDeAlta()).estado).toBe(429);
  });

  it("treinta fallos repartidos entre IPs cierran la entrada a todas", async () => {
    await darDeAlta();
    cookie = "";
    for (let i = 0; i < 30; i++) {
      await pedir("/api/acceso", { metodo: "POST", datos: { email: "x@y.co", contrasena: "mal" }, cabeceras: { "cf-connecting-ip": `9.9.9.${i}` } });
    }
    const r = await pedir("/api/acceso", { metodo: "POST", datos: { email: "juan@ejemplo.com", contrasena: "una contraseña larga" }, cabeceras: { "cf-connecting-ip": "3.3.3.3" } });
    expect(r.estado).toBe(429);
  });
});

describe("la dirección y lo que se publica", () => {
  const raiz = join(import.meta.dirname, "..");
  const wrangler = JSON.parse(readFileSync(join(raiz, "wrangler.jsonc"), "utf8").replace(/^\s*\/\/.*$/gm, ""));

  it("sale en agenda.juancitoads.com como dominio propio, y workers.dev sigue de respaldo", () => {
    expect(wrangler.routes).toEqual([{ pattern: "agenda.juancitoads.com", custom_domain: true }]);
    // Con `routes` puesto y sin esto, wrangler apaga workers.dev en el siguiente despliegue.
    expect(wrangler.workers_dev).toBe(true);
  });

  it("ningún secreto vive en wrangler.jsonc", () => {
    expect(wrangler.vars ?? {}).toEqual({});
    expect(readFileSync(join(raiz, "wrangler.jsonc"), "utf8")).not.toMatch(/sk-ant-|LLM\||"[A-Za-z0-9_-]{40,}"/);
  });

  it("los buscadores no la indexan", () => {
    expect(readFileSync(join(raiz, "public", "_headers"), "utf8")).toMatch(/^\s+X-Robots-Tag: noindex, nofollow$/m);
    expect(readFileSync(join(raiz, "index.html"), "utf8")).toMatch(/<meta name="robots" content="noindex, nofollow" \/>/);
  });
});

describe("los datos", () => {
  it("guarda y borra acciones, y cada uno ve sólo lo suyo", async () => {
    await darDeAlta();
    const accion = { id: "a1", titulo: "Llamar a Adolfo", sombrero: "iglesia", lista: "siguientes", estado: "abierta" };
    expect((await pedir("/api/elementos/accion/a1", { metodo: "PUT", datos: accion })).estado).toBe(200);
    expect((await pedir("/api/elementos/accion/otro", { metodo: "PUT", datos: accion })).estado).toBe(400);
    expect((await pedir("/api/estado")).datos.acciones).toEqual([accion]);
    // Otra cuenta (metida a mano: el alta sólo deja una) no ve nada.
    env.DB.crudo.prepare("insert into usuarios (id, email, hash) values ('otro', 'otro@x.co', 'x')").run();
    env.DB.crudo.prepare("insert into elementos (owner_id, tipo, id, datos) values ('otro', 'accion', 'z', '{\"id\":\"z\"}')").run();
    expect((await pedir("/api/estado")).datos.acciones.map((a) => a.id)).toEqual(["a1"]);
    expect((await pedir("/api/elementos/accion/z", { metodo: "DELETE" })).estado).toBe(404);
    expect((await pedir("/api/elementos/accion/a1", { metodo: "DELETE" })).estado).toBe(200);
  });

  it("ninguna consulta vive fuera de almacen.js y sesion.js (D1 no tiene RLS)", () => {
    const dir = join(import.meta.dirname, "..", "worker");
    const archivos = [];
    const recorrer = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) recorrer(join(d, e.name));
        else if (e.name.endsWith(".js")) archivos.push(join(d, e.name));
      }
    };
    recorrer(dir);
    const conPrepare = archivos.filter((f) => /\.prepare\(/.test(readFileSync(f, "utf8"))).map((f) => f.split("/worker/")[1]);
    expect(conPrepare.sort()).toEqual(["lib/almacen.js", "lib/sesion.js"]);
  });

  it("todo `create` de las migraciones lleva `if not exists`", () => {
    const dir = join(import.meta.dirname, "..", "migraciones", "d1");
    for (const f of readdirSync(dir)) {
      const sql = readFileSync(join(dir, f), "utf8").replace(/--.*$/gm, "");
      for (const m of sql.matchAll(/create\s+(unique\s+)?(table|index)\s+(?!if not exists)/gi)) throw new Error(`${f}: «${m[0]}» sin if not exists`);
    }
  });
});

describe("capturar: el asistente ordena", () => {
  it("guarda la captura, el asistente la ordena, la tarjeta dice lo hecho y se deshace", async () => {
    await darDeAlta();
    const pedidosIA = [];
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      pedidosIA.push({ url, cuerpo: JSON.parse(init.body), cabeceras: init.headers });
      return respuestaIA({
        elementos: [
          { tipo: "evento", titulo: "Reunión con Adolfo", sombrero: "iglesia", cuando: "2099-01-03", hora: "10:00" },
          { tipo: "ajuste", clave: "cierre", valor: "21:45" },
        ],
        personas_nuevas: [{ nombre: "Adolfo", relacion: "hermano de la iglesia", sombrero: "iglesia" }],
        respuesta: "Listo",
      });
    }));
    const r = await pedir("/api/capturas", { metodo: "POST", datos: { texto: "Agenda una reunión con mi hermano Adolfo de la iglesia", canal: "voz" } });
    expect(r.estado).toBe(201);
    expect(r.datos.resultado.tarjeta).toMatch(/^Listo:/);
    expect(r.datos.resultado.tarjeta).toContain("Reunión con Adolfo");
    expect(pedidosIA[0].url).toBe("https://api.anthropic.com/v1/messages");
    expect(pedidosIA[0].cuerpo.model).toBe("claude-haiku-5-5");
    expect(pedidosIA[0].cuerpo.output_config).toEqual({ effort: "low" });
    expect(pedidosIA[0].cuerpo.system).toContain("SU SEMANA (bloques y recordatorios fijos");

    const e = await pedir("/api/estado");
    expect(e.datos.eventos.map((x) => x.titulo)).toEqual(["Reunión con Adolfo"]);
    expect(e.datos.personas.map((x) => x.nombre)).toEqual(["Adolfo"]);
    expect(e.datos.ajustes.avisos.cierre).toBe("21:45");
    expect(e.datos.bandeja).toEqual([]);

    expect((await pedir(`/api/capturas/${r.datos.captura.id}/deshacer`, { metodo: "POST", datos: {} })).estado).toBe(200);
    const d = await pedir("/api/estado");
    expect(d.datos.eventos).toEqual([]);
    expect(d.datos.personas).toEqual([]);
    expect(d.datos.ajustes.avisos.cierre).toBe("21:00");
    expect((await pedir(`/api/capturas/${r.datos.captura.id}/deshacer`, { metodo: "POST", datos: {} })).estado).toBe(409);
  });

  it("si la IA falla, la captura se queda en la Bandeja con su motivo", async () => {
    await darDeAlta();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { type: "invalid_request_error", message: "Your credit balance is too low" } }), { status: 400 })));
    const r = await pedir("/api/capturas", { metodo: "POST", datos: { texto: "comprar pan" } });
    expect(r.estado).toBe(202);
    expect(r.datos.error).toMatch(/saldo/);
    const e = await pedir("/api/estado");
    expect(e.datos.bandeja).toHaveLength(1);
    expect(e.datos.bandeja[0]).toMatchObject({ texto: "comprar pan", estado: "error" });
  });

  it("si la cuenta no tiene el modelo, prueba el siguiente", async () => {
    await darDeAlta();
    const modelos = [];
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      const m = JSON.parse(init.body).model;
      modelos.push(m);
      if (m === "claude-haiku-5-5") return new Response(JSON.stringify({ error: { type: "not_found_error", message: "model: claude-haiku-5-5" } }), { status: 404 });
      return respuestaIA({ elementos: [{ tipo: "idea", titulo: "Retiro de jóvenes", sombrero: "iglesia" }] });
    }));
    const r = await pedir("/api/capturas", { metodo: "POST", datos: { texto: "idea: retiro de jóvenes" } });
    expect(r.estado).toBe(201);
    expect(modelos).toEqual(["claude-haiku-5-5", "claude-sonnet-5"]);
  });

  it("con Meta escogido va a api.meta.ai, sin lo propio de Claude; lo confidencial no va a Contributor", async () => {
    await darDeAlta();
    env.META_API_KEY = "llave-meta";
    const e0 = await pedir("/api/estado");
    await pedir("/api/perfil", { metodo: "PUT", datos: { ajustes: { ...e0.datos.ajustes, ia: { proveedor: "meta", modelos: { ordenar: "muse-spark-1.2-contributor" } } } } });
    const pedidos = [];
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      pedidos.push({ url, cuerpo: JSON.parse(init.body) });
      return respuestaIA({ elementos: [{ tipo: "accion", titulo: "Llamar a Pedro", sombrero: "iglesia" }] });
    }));
    await pedir("/api/capturas", { metodo: "POST", datos: { texto: "llamar a Pedro mañana" } });
    await pedir("/api/capturas", { metodo: "POST", datos: { texto: "seguimiento del discipulado de Pedro" } });
    expect(pedidos.map((p) => p.cuerpo.model)).toEqual(["muse-spark-1.2-contributor", "muse-spark-1.3"]);
    expect(pedidos[0].url).toBe("https://api.meta.ai/v1/messages");
    expect(pedidos[0].cuerpo.output_config).toBeUndefined();
  });
});
