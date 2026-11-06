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
//   GET    /api/estado                   todo lo de la persona (?desde&hasta: los eventos de Google del rango)
//   PUT    /api/elementos/:tipo/:id      guardar una acción, proyecto, evento o persona (y reflejarlo fuera)
//   DELETE /api/elementos/:tipo/:id
//   PUT    /api/perfil                   ajustes y ritmo
//   POST   /api/capturas                 capturar o hablar con el asistente
//   POST   /api/capturas/:id/ordenar     volver a intentarlo
//   POST   /api/capturas/:id/deshacer
//   DELETE /api/capturas/:id
//   POST   /api/recuperar/telegram · enlace · codigo   ¿olvidaste tu contraseña? (sin sesión)
//   PUT    /api/contrasena               cambiarla con la sesión abierta
//   PUT    /api/cerebro/:id · DELETE     lo que el asistente sabe de ti
//   POST   /api/mentor                   el consejo del mentor
//   GET    /api/telegram · POST conectar · POST desconectar
//   POST   /api/juancito/conectar · GET vuelta · POST sincronizar · PUT ajustes · POST desconectar
//   POST   /api/google/conectar · GET vuelta · POST sincronizar · PUT :cuenta · DELETE :cuenta
//   GET    /api/mcp/cliente · POST /api/mcp/autorizar · GET /api/mcp/conexiones · POST /api/mcp/desconectar
//   ── sin sesión, firmado ──
//   POST   /api/telegram/webhook         lo que manda Telegram (con su secreto)
//   /mcp, /oauth/*, /.well-known/*       Claude (worker/lib/mcp.js)
//   ── programado (cada minuto) ──
//   el seguimiento por Telegram y la sincronización con Juancito Ads y Google
// ============================================================

import { json, error, noEncontrado, cuerpo } from "./lib/respuesta.js";
import {
  usuarioDeLaPeticion, abrirSesion, cerrarSesion, cookieSesion, cookieBorrada, entrar, darDeAlta, hayUsuarios,
  ipDe, demasiadosFallos, apuntarFallo, olvidarFallos, VENTANA_FALLOS_MIN, igualSeguro,
  clienteMCP, crearCodigoMCP, conexionesMCP, desconectarMCP, chatDe,
  cuentaUnica, crearRecuperacion, duenoDeRecuperacion, ponerContrasena, contrasenaDe, MINUTOS_RECUPERAR, MIN_CONTRASENA,
} from "./lib/sesion.js";
import { hayTelegram, secretoWebhook, procesar, conectar, ErrorTelegram, llamar as llamarTelegram } from "./lib/telegram.js";
import { crearAlmacen, perfilInicial, TIPOS_ELEMENTO } from "./lib/almacen.js";
import { ordenarCaptura, deshacerCaptura } from "./lib/ordenar.js";
import { llaves, ErrorIA } from "./lib/modelo.js";
import { reflejar } from "./lib/reflejar.js";
import * as juancito from "./lib/juancito.js";
import * as google from "./lib/google.js";
import { rutaMCP } from "./lib/mcp.js";
import { consejo } from "./lib/mentor.js";
import { vuelta } from "./lib/seguimiento.js";
import { hoyEn, sumarDias } from "../src/lib/fechas.js";
import { limpiarNota } from "../src/lib/cerebro.js";
import { sombrerosDe } from "../src/lib/sombreros.js";

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

/** Volver a la aplicación después de dar un permiso (Juancito Ads, Google), con lo que pasó. */
const volver = (url, aviso) => new Response(null, { status: 302, headers: { Location: `${url.origin}/?aviso=${encodeURIComponent(aviso)}#ajustes`, "Cache-Control": "no-store" } });

async function api(req, env, ctx) {
  const url = new URL(req.url);
  const partes = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const [recurso, a, b] = partes;
  const db = env.DB;
  const despues = ctx?.waitUntil ? (p) => ctx.waitUntil(p) : null;
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

  // ¿Olvidaste tu contraseña? Sin sesión, con el mismo tope que la entrada (worker/lib/sesion.js lo explica).
  if (recurso === "recuperar" && req.method === "POST") {
    const ip = ipDe(req);
    if (await demasiadosFallos(db, ip)) return bloqueada();
    const datos = (await cuerpo(req)) ?? {};
    if (a === "telegram") {
      const dueno = await cuentaUnica(db);
      const chat = dueno && hayTelegram(env) ? await chatDe(db, dueno) : null;
      if (!chat) return error("Telegram no está conectado a tu agenda. Usa tu código de alta.", 409);
      const testigo = await crearRecuperacion(db, dueno);
      if (!testigo) return json({ ok: true, yaEnviado: true });
      try {
        await llamarTelegram(env, "sendMessage", {
          chat_id: chat,
          text: `Para poner una contraseña nueva en tu agenda, abre este enlace (vale ${MINUTOS_RECUPERAR} minutos y sirve una sola vez):\n${url.origin}/recuperar?t=${testigo}\n\nSi no lo pediste tú, no hagas nada: tu contraseña sigue igual.`,
          link_preview_options: { is_disabled: true },
        });
      } catch {
        return error("Telegram no aceptó el mensaje. Prueba con tu código de alta.", 502);
      }
      return json({ ok: true });
    }
    if (a === "enlace" || a === "codigo") {
      let dueno = null;
      if (a === "enlace") dueno = await duenoDeRecuperacion(db, datos.token);
      else if (env.CODIGO_ALTA && igualSeguro(String(datos.codigo ?? ""), env.CODIGO_ALTA)) dueno = await cuentaUnica(db);
      if (!dueno) {
        await apuntarFallo(db, ip);
        return error(a === "enlace" ? "El enlace caducó o ya se usó. Pide otro." : "El código de alta no es correcto.", 403);
      }
      if (String(datos.contrasena ?? "").length < MIN_CONTRASENA) return error(`La contraseña necesita al menos ${MIN_CONTRASENA} caracteres.`, 400);
      await ponerContrasena(db, dueno, datos.contrasena);
      await olvidarFallos(db, ip);
      return json({ ok: true }, 200, { "Set-Cookie": cookieSesion(await abrirSesion(db, dueno)) });
    }
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
  if (!usuario) {
    // Volver de un permiso sin sesión (otro navegador): a la aplicación, que pedirá entrar.
    if (req.method === "GET" && a === "vuelta") return volver(url, "Entra y vuelve a pulsar «Conectar».");
    return error("No has entrado.", 401);
  }
  const almacen = crearAlmacen(db, usuario.id);
  const perfil = async () => (await almacen.perfil()) ?? perfilInicial(usuario.nombre);
  const hoyDe = (aj) => hoyEn(aj?.zona);

  if (recurso === "estado" && req.method === "GET") {
    const p = await perfil();
    const hoy = hoyDe(p.ajustes);
    const desde = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("desde") ?? "") ? url.searchParams.get("desde") : sumarDias(hoy, -40);
    const hasta = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("hasta") ?? "") ? url.searchParams.get("hasta") : sumarDias(hoy, 70);
    // Lo de fuera se pone al día sin hacer esperar: lo nuevo llega en la siguiente lectura.
    const sync = Promise.all([juancito.sincronizar(env, almacen, { hoy }), google.sincronizar(env, almacen, { hoy })]).catch(() => null);
    if (despues) despues(sync);
    else await sync;
    return json({ ...(await almacen.estado({ completo: true, desde, hasta })), usuario, llaves: llaves(env), servicios: { telegram: hayTelegram(env), google: google.hayGoogle(env) } });
  }

  if (recurso === "elementos" && a in TIPOS_ELEMENTO && b) {
    const anterior = a === "accion" || a === "evento" ? await almacen.elemento(a, b) : null;
    if (req.method === "PUT") {
      const obj = await cuerpo(req);
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return error("Falta el elemento.");
      if (a !== "persona" && String(obj.id) !== b) return error("El id no coincide con la dirección.");
      try {
        await almacen.guardarElemento(a, obj);
      } catch (e) {
        return error(e.message);
      }
      if (a === "accion" || a === "evento") {
        const p = await perfil();
        const r = reflejar(env, almacen, [{ tipo: a, antes: anterior, despues: obj }], { hoy: hoyDe(p.ajustes), ajustes: p.ajustes }).catch(() => null);
        if (despues) despues(r);
        else await r;
      }
      return json({ ok: true });
    }
    if (req.method === "DELETE") {
      if (!(await almacen.borrarElemento(a, b))) return noEncontrado("El elemento");
      if (anterior) {
        const p = await perfil();
        const r = reflejar(env, almacen, [{ tipo: a, antes: anterior, despues: null }], { hoy: hoyDe(p.ajustes), ajustes: p.ajustes }).catch(() => null);
        if (despues) despues(r);
        else await r;
      }
      return json({ ok: true });
    }
  }

  // Cambiar la contraseña con la sesión abierta: pide la de ahora y cierra las demás sesiones.
  if (recurso === "contrasena" && req.method === "PUT") {
    const ip = ipDe(req);
    if (await demasiadosFallos(db, ip)) return bloqueada();
    const { actual, nueva } = (await cuerpo(req)) ?? {};
    if (!(await contrasenaDe(db, usuario.id, actual))) {
      await apuntarFallo(db, ip);
      return error("Tu contraseña de ahora no es esa.", 403);
    }
    if (String(nueva ?? "").length < MIN_CONTRASENA) return error(`La contraseña necesita al menos ${MIN_CONTRASENA} caracteres.`, 400);
    await ponerContrasena(db, usuario.id, nueva);
    return json({ ok: true }, 200, { "Set-Cookie": cookieSesion(await abrirSesion(db, usuario.id)) });
  }

  if (recurso === "perfil" && req.method === "PUT") {
    const { ajustes, ritmo } = (await cuerpo(req)) ?? {};
    const actual = await perfil();
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
      const r = await ordenarCaptura(env, almacen, captura, { despues });
      return json({ captura: { ...captura, estado: r.ok ? "ordenada" : "error" }, ...r }, r.ok ? 201 : 202);
    }
    if (a) {
      const captura = await almacen.captura(a);
      if (!captura) return noEncontrado("La captura");
      if (b === "ordenar" && req.method === "POST") {
        if (captura.estado === "ordenada") return error("Esa captura ya está ordenada.", 409);
        const r = await ordenarCaptura(env, almacen, captura, { despues });
        return json(r, r.ok ? 200 : 202);
      }
      if (b === "deshacer" && req.method === "POST") {
        const p = await perfil();
        const r = await deshacerCaptura(env, almacen, captura, { hoy: hoyDe(p.ajustes) });
        return r.ok ? json(r) : error(r.error, 409);
      }
      if (!b && req.method === "DELETE") {
        await almacen.borrarCaptura(a);
        return json({ ok: true });
      }
    }
  }

  if (recurso === "cerebro" && a) {
    if (req.method === "PUT") {
      const p = await perfil();
      const nota = limpiarNota((await cuerpo(req)) ?? {}, { sombreros: sombrerosDe(p.ajustes) });
      if (!nota.titulo || !nota.texto) return error("Una nota necesita título y texto.");
      await almacen.guardarNota({ id: a, ...nota, origen: "yo" });
      return json({ ok: true });
    }
    if (req.method === "DELETE") return (await almacen.borrarNota(a)) ? json({ ok: true }) : noEncontrado("La nota");
  }

  if (recurso === "mentor" && req.method === "POST") {
    try {
      const c = await consejo(env, almacen);
      const p = await perfil();
      await almacen.guardarPerfil({ ajustes: { ...p.ajustes, consejo: c }, ritmo: p.ritmo });
      return json(c);
    } catch (e) {
      return error(e.message, e instanceof ErrorIA ? e.estado : 502);
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

  if (recurso === "juancito") {
    try {
      if (a === "conectar" && req.method === "POST") return json({ url: await juancito.iniciar(env, almacen, url.origin) });
      if (a === "vuelta" && req.method === "GET") {
        if (url.searchParams.get("error")) return volver(url, "No diste permiso en Juancito Ads.");
        await juancito.terminar(env, almacen, { code: url.searchParams.get("code"), state: url.searchParams.get("state") });
        const p = await perfil();
        await juancito.sincronizar(env, almacen, { hoy: hoyDe(p.ajustes), forzar: true });
        return volver(url, "Juancito Ads quedó conectado.");
      }
      if (a === "sincronizar" && req.method === "POST") {
        const p = await perfil();
        return json(await juancito.sincronizar(env, almacen, { hoy: hoyDe(p.ajustes), forzar: true }));
      }
      if (a === "ajustes" && req.method === "PUT") {
        const c = await almacen.conexion(juancito.SERVICIO);
        if (!c) return noEncontrado("La conexión");
        const { todas } = (await cuerpo(req)) ?? {};
        await almacen.guardarConexion(juancito.SERVICIO, { ...c.datos, ajustes: { ...(c.datos.ajustes ?? {}), todas: Boolean(todas) } });
        return json({ ok: true });
      }
      if (a === "desconectar" && req.method === "POST") {
        await almacen.borrarConexion(juancito.SERVICIO);
        return json({ ok: true });
      }
    } catch (e) {
      if (a === "vuelta") return volver(url, e.message);
      return error(e.message, 502);
    }
  }

  if (recurso === "google") {
    try {
      if (a === "conectar" && req.method === "POST") return json({ url: await google.iniciar(env, almacen, url.origin) });
      if (a === "vuelta" && req.method === "GET") {
        if (url.searchParams.get("error")) return volver(url, "No diste permiso en Google.");
        const cuenta = await google.terminar(env, almacen, { code: url.searchParams.get("code"), state: url.searchParams.get("state"), origen: url.origin });
        const p = await perfil();
        await google.sincronizar(env, almacen, { hoy: hoyDe(p.ajustes), forzar: true });
        return volver(url, `Google (${cuenta}) quedó conectado.`);
      }
      if (a === "sincronizar" && req.method === "POST") {
        const p = await perfil();
        return json(await google.sincronizar(env, almacen, { hoy: hoyDe(p.ajustes), forzar: true }));
      }
      if (a && a !== "conectar" && a !== "vuelta" && a !== "sincronizar") {
        const servicio = `${google.PREFIJO}${decodeURIComponent(a).toLowerCase()}`;
        const c = await almacen.conexion(servicio);
        if (!c) return noEncontrado("Esa cuenta");
        if (req.method === "DELETE") {
          await almacen.borrarConexion(servicio);
          return json({ ok: true });
        }
        if (req.method === "PUT") {
          const p = await perfil();
          const ids = sombrerosDe(p.ajustes).map((s) => s.id);
          const q = (await cuerpo(req)) ?? {};
          const lista = (v) => (Array.isArray(v) ? v.filter((x) => ids.includes(x)) : undefined);
          const ajustes = { ...(c.datos.ajustes ?? {}) };
          if (lista(q.eventosDe)) ajustes.eventosDe = lista(q.eventosDe);
          if (lista(q.tareasDe)) ajustes.tareasDe = lista(q.tareasDe);
          // Qué calendarios se ven (null: los que la cuenta enseña en Google Calendar) y dónde se guarda cada sombrero.
          const cals = c.datos.lista ?? [];
          if (q.leer === null) delete ajustes.leer;
          else if (Array.isArray(q.leer)) ajustes.leer = q.leer.filter((x) => cals.some((k) => k.id === x)).slice(0, 15);
          if (q.guardarEn && typeof q.guardarEn === "object" && !Array.isArray(q.guardarEn)) {
            ajustes.guardarEn = Object.fromEntries(
              Object.entries({ ...(ajustes.guardarEn ?? {}), ...q.guardarEn }).filter(([s, cal]) => ids.includes(s) && cals.some((k) => k.id === cal && k.escribir)),
            );
          }
          await almacen.guardarConexion(servicio, { ...c.datos, ajustes }, { error: c.error ?? null });
          // Lo que se ve cambió: se vuelve a leer en la siguiente lectura.
          if (q.leer !== undefined) await google.sincronizar(env, almacen, { hoy: hoyDe(p.ajustes), forzar: true }).catch(() => null);
          return json({ ok: true });
        }
      }
    } catch (e) {
      if (a === "vuelta") return volver(url, e.message);
      return error(e.message, 502);
    }
  }

  if (recurso === "mcp") {
    if (a === "cliente" && req.method === "GET") {
      const c = await clienteMCP(db, url.searchParams.get("client_id"));
      if (!c || !c.redirectUris.includes(url.searchParams.get("redirect_uri") ?? "")) return error("Esa aplicación no está registrada o la dirección de vuelta no es la suya.", 400);
      return json({ nombre: c.nombre || "Una aplicación", vuelta: new URL(url.searchParams.get("redirect_uri")).host });
    }
    if (a === "autorizar" && req.method === "POST") {
      const q = (await cuerpo(req)) ?? {};
      const c = await clienteMCP(db, q.client_id);
      if (!c || !c.redirectUris.includes(q.redirect_uri)) return error("La dirección de vuelta no es la que registró esa aplicación.", 400);
      if (q.code_challenge_method !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(String(q.code_challenge ?? ""))) return error("Falta el reto PKCE (S256).", 400);
      const codigo = await crearCodigoMCP(db, { clienteId: c.id, ownerId: usuario.id, redirectUri: q.redirect_uri, reto: q.code_challenge });
      const vuelta = new URL(q.redirect_uri);
      vuelta.searchParams.set("code", codigo);
      if (q.state) vuelta.searchParams.set("state", String(q.state));
      return json({ redireccion: vuelta.toString() });
    }
    if (a === "conexiones" && req.method === "GET") return json({ conexiones: await conexionesMCP(db, usuario.id) });
    if (a === "desconectar" && req.method === "POST") {
      await desconectarMCP(db, usuario.id);
      return json({ ok: true });
    }
  }

  return noEncontrado("Esa ruta");
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    try {
      const mcp = await rutaMCP(req, env, ctx);
      if (mcp) return mcp;
      if (url.pathname.startsWith("/api/") || url.pathname === "/api") return await api(req, env, ctx);
    } catch (e) {
      console.error("api:", e?.stack ?? e);
      return error("Error interno.", 500);
    }
    return env.ASSETS.fetch(req);
  },

  /** Cada minuto: el seguimiento por Telegram y la sincronización con Juancito Ads y Google. */
  async scheduled(evento, env, ctx) {
    ctx.waitUntil(vuelta(env, new Date(evento?.scheduledTime ?? Date.now())).catch((e) => console.error("seguimiento:", e?.message ?? e)));
  },
};
