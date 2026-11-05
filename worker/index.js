// ============================================================
// El Worker: la aplicación (recursos estáticos) y la API en el MISMO origen
//
// Así la CSP puede decir `connect-src 'self'` y la cookie es `__Host-`.
// Ninguna llave vive en el navegador: las de IA son secretos del Worker.
//
//   GET    /api/salud
//   GET    /api/arranque                 ¿quién soy? ¿se puede dar de alta la primera cuenta?
//   POST   /api/alta                     la primera cuenta (con CODIGO_ALTA)
//   POST   /api/acceso                   entrar
//   POST   /api/salir                    salir
//   ── con sesión ──
//   GET    /api/estado                   todo lo de la persona
//   PUT    /api/elementos/:tipo/:id      guardar una acción, proyecto, evento o persona
//   DELETE /api/elementos/:tipo/:id
//   PUT    /api/perfil                   ajustes y ritmo
//   POST   /api/capturas                 capturar y que el asistente lo ordene
//   POST   /api/capturas/:id/ordenar     volver a intentarlo
//   POST   /api/capturas/:id/deshacer
//   DELETE /api/capturas/:id
//   GET    /api/telegram                 ¿hay bot? ¿está conectado este chat?
//   POST   /api/telegram/conectar        el enlace de un solo uso para atar el chat
//   POST   /api/telegram/desconectar
//   ── sin sesión, firmado ──
//   POST   /api/telegram/webhook         lo que manda Telegram (con su secreto)
// ============================================================

import { json, error, noEncontrado, cuerpo } from "./lib/respuesta.js";
import {
  usuarioDeLaPeticion, abrirSesion, cerrarSesion, cookieSesion, cookieBorrada, entrar, darDeAlta, hayUsuarios,
  ipDe, demasiadosFallos, apuntarFallo, olvidarFallos, VENTANA_FALLOS_MIN, igualSeguro,
} from "./lib/sesion.js";
import { hayTelegram, secretoWebhook, procesar, conectar, ErrorTelegram } from "./lib/telegram.js";
import { crearAlmacen, perfilInicial, TIPOS_ELEMENTO } from "./lib/almacen.js";
import { ordenarCaptura, deshacerCaptura } from "./lib/ordenar.js";
import { llaves } from "./lib/modelo.js";

const MAX_CAPTURA = 4000;

const bloqueada = () =>
  json({ error: `Demasiados intentos fallidos. Espera ${VENTANA_FALLOS_MIN} minutos y vuelve a probar.` }, 429, {
    "Retry-After": String(VENTANA_FALLOS_MIN * 60),
  });

/** Lo que cambia algo tiene que venir como JSON y del mismo origen: así un formulario de otra web no puede escribir. */
function peticionSegura(req) {
  if (req.method === "GET" || req.method === "HEAD") return true;
  const origen = req.headers.get("origin");
  if (origen && origen !== new URL(req.url).origin) return false;
  if (req.method === "DELETE") return true;
  return (req.headers.get("content-type") ?? "").includes("application/json");
}

async function api(req, env) {
  const url = new URL(req.url);
  const partes = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const [recurso, a, b] = partes;
  const db = env.DB;
  if (!peticionSegura(req)) return error("Petición no permitida.", 403);

  if (recurso === "salud" && req.method === "GET") return json({ ok: true });

  if (recurso === "arranque" && req.method === "GET") {
    const usuario = await usuarioDeLaPeticion(db, req);
    return json({ usuario, alta: !usuario && Boolean(env.CODIGO_ALTA) && !(await hayUsuarios(db)) });
  }

  if (recurso === "alta" && req.method === "POST") {
    const ip = ipDe(req);
    if (await demasiadosFallos(db, ip)) return bloqueada();
    const datos = (await cuerpo(req)) ?? {};
    const r = await darDeAlta(db, env, datos);
    if (r.error) {
      // Un código de alta equivocado cuenta como un intento fallido: también se puede adivinar.
      if (r.estado === 403) await apuntarFallo(db, ip);
      return error(r.error, r.estado);
    }
    await crearAlmacen(db, r.id).guardarPerfil(perfilInicial(datos.nombre));
    const testigo = await abrirSesion(db, r.id);
    return json({ ok: true }, 201, { "Set-Cookie": cookieSesion(testigo) });
  }

  if (recurso === "acceso" && req.method === "POST") {
    const ip = ipDe(req);
    if (await demasiadosFallos(db, ip)) return bloqueada();
    const { email, contrasena } = (await cuerpo(req)) ?? {};
    const id = await entrar(db, email, contrasena);
    if (!id) {
      await apuntarFallo(db, ip);
      return error("Correo o contraseña incorrectos.", 401);
    }
    await olvidarFallos(db, ip);
    const testigo = await abrirSesion(db, id);
    return json({ ok: true }, 200, { "Set-Cookie": cookieSesion(testigo) });
  }

  // Telegram avisa sin sesión: vale su secreto (con el mismo tope que la entrada). Siempre contesta 200 tras procesar,
  // o Telegram repetiría el aviso sin fin.
  if (recurso === "telegram" && a === "webhook" && req.method === "POST") {
    if (!hayTelegram(env)) return noEncontrado("Esa ruta");
    const ip = ipDe(req);
    if (await demasiadosFallos(db, ip)) return bloqueada();
    if (!igualSeguro(req.headers.get("x-telegram-bot-api-secret-token") ?? "", await secretoWebhook(env))) {
      await apuntarFallo(db, ip);
      return error("Petición no permitida.", 403);
    }
    const update = await cuerpo(req);
    try {
      await procesar(env, update);
    } catch (e) {
      console.error("telegram:", e?.message ?? e);
    }
    return json({ ok: true });
  }

  if (recurso === "salir" && req.method === "POST") {
    await cerrarSesion(db, req);
    return json({ ok: true }, 200, { "Set-Cookie": cookieBorrada() });
  }

  // ── Todo lo demás, con sesión ──
  const usuario = await usuarioDeLaPeticion(db, req);
  if (!usuario) return error("No has entrado.", 401);
  const almacen = crearAlmacen(db, usuario.id);

  if (recurso === "estado" && req.method === "GET") {
    return json({ ...(await almacen.estado()), usuario, llaves: llaves(env) });
  }

  if (recurso === "elementos" && a in TIPOS_ELEMENTO && b) {
    if (req.method === "PUT") {
      const obj = await cuerpo(req);
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return error("Falta el elemento.");
      if (a !== "persona" && String(obj.id) !== b) return error("El id no coincide con la dirección.");
      try {
        await almacen.guardarElemento(a, obj);
      } catch (e) {
        return error(e.message);
      }
      return json({ ok: true });
    }
    if (req.method === "DELETE") return (await almacen.borrarElemento(a, b)) ? json({ ok: true }) : noEncontrado("El elemento");
  }

  if (recurso === "perfil" && req.method === "PUT") {
    const { ajustes, ritmo } = (await cuerpo(req)) ?? {};
    const actual = (await almacen.perfil()) ?? perfilInicial(usuario.nombre);
    if (ajustes !== undefined && (typeof ajustes !== "object" || Array.isArray(ajustes) || !ajustes)) return error("Los ajustes no son válidos.");
    if (ritmo !== undefined && !Array.isArray(ritmo)) return error("El ritmo no es válido.");
    await almacen.guardarPerfil({ ajustes: ajustes ?? actual.ajustes, ritmo: ritmo ?? actual.ritmo });
    return json({ ok: true });
  }

  if (recurso === "capturas") {
    if (!a && req.method === "POST") {
      const { texto, canal = "app" } = (await cuerpo(req)) ?? {};
      const limpio = String(texto ?? "").trim();
      if (!limpio) return error("No hay nada que capturar.");
      if (limpio.length > MAX_CAPTURA) return error(`Una captura tiene como mucho ${MAX_CAPTURA} caracteres.`);
      // Se guarda PRIMERO, tal cual: si la IA falla, queda en la Bandeja.
      const captura = await almacen.crearCaptura({ id: crypto.randomUUID(), texto: limpio, canal: ["app", "voz", "telegram", "claude"].includes(canal) ? canal : "app" });
      const r = await ordenarCaptura(env, almacen, captura);
      return json({ captura: { ...captura, estado: r.ok ? "ordenada" : "error" }, ...r }, r.ok ? 201 : 202);
    }
    if (a) {
      const captura = await almacen.captura(a);
      if (!captura) return noEncontrado("La captura");
      if (b === "ordenar" && req.method === "POST") {
        if (captura.estado === "ordenada") return error("Esa captura ya está ordenada.", 409);
        const r = await ordenarCaptura(env, almacen, captura);
        return json(r, r.ok ? 200 : 202);
      }
      if (b === "deshacer" && req.method === "POST") {
        const r = await deshacerCaptura(almacen, captura);
        return r.ok ? json(r) : error(r.error, 409);
      }
      if (!b && req.method === "DELETE") {
        await almacen.borrarCaptura(a);
        return json({ ok: true });
      }
    }
  }

  if (recurso === "telegram") {
    if (!a && req.method === "GET") return json({ configurado: hayTelegram(env), ...(await almacen.telegram()) });
    if (a === "conectar" && req.method === "POST") {
      if (!hayTelegram(env)) return error("Falta el token del bot: ponlo en Cloudflare como Secret TELEGRAM_BOT_TOKEN.", 409);
      try {
        return json(await conectar(env, almacen, url.origin));
      } catch (e) {
        return error(e instanceof ErrorTelegram ? e.message : "No se pudo hablar con Telegram.", 502);
      }
    }
    if (a === "desconectar" && req.method === "POST") {
      await almacen.desvincularTelegram();
      return json({ ok: true });
    }
  }

  return noEncontrado("Esa ruta");
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/") || url.pathname === "/api") {
      try {
        return await api(req, env);
      } catch (e) {
        console.error("api:", e?.stack ?? e);
        return error("Error interno.", 500);
      }
    }
    return env.ASSETS.fetch(req);
  },
};
