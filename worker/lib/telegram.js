// ============================================================
// Telegram: capturar desde el teléfono, por texto o nota de voz
//
// El bot es de UNA persona. Lo que llega por el webhook se comprueba dos
// veces: la firma (Telegram manda en cada aviso el secreto que se le dio al
// conectar; sale del token, así no hay otro secreto que guardar) y el chat
// (sólo responde al chat atado a la cuenta con el código de un solo uso).
// A un desconocido no se le contesta nada.
//
// Lo que se dice va por el MISMO camino que en la aplicación: se guarda tal
// cual (si la IA falla, queda en la Bandeja), el asistente lo ordena y se
// contesta con la tarjeta y un botón «Deshacer». La voz la transcribe
// Whisper en Workers AI antes de que la lea el asistente.
// ============================================================

import { huella, aleatorio, duenoDeChat, vincularChat } from "./sesion.js";
import { crearAlmacen } from "./almacen.js";
import { ordenarCaptura, deshacerCaptura } from "./ordenar.js";

export const MODELO_VOZ = "@cf/openai/whisper-large-v3-turbo";
export const MINUTOS_CODIGO = 15;
const MAX_TEXTO = 4000;
const MAX_AUDIO = 20 * 1024 * 1024; // lo más que deja bajar la API de bots

export const BIENVENIDA =
  "Listo, quedamos conectados. Escríbeme o mándame una nota de voz con lo que tengas en mente: una reunión, un recordatorio, una idea, lo que te pidió alguien. Yo lo ordeno y te digo qué hice.";
export const AYUDA =
  "Escríbeme o mándame una nota de voz, como te salga: «el viernes a las 10 llamar a Adolfo», «acuérdame comprar el regalo de mi esposa», «la célula ahora es los viernes». Lo ordeno y te digo qué hice; si me equivoco, pulsa «Deshacer».";

export class ErrorTelegram extends Error {}

export const hayTelegram = (env) => Boolean(env.TELEGRAM_BOT_TOKEN);

/** Una llamada a la API de bots. El token va en la dirección y NUNCA en un error. */
export async function llamar(env, metodo, datos = {}) {
  let res;
  try {
    res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${metodo}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(datos),
    });
  } catch {
    throw new ErrorTelegram("No se pudo hablar con Telegram.");
  }
  const j = await res.json().catch(() => null);
  if (!j?.ok) throw new ErrorTelegram(`Telegram no aceptó «${metodo}»: ${j?.description ?? res.status}`);
  return j.result;
}

/** El secreto del webhook: HMAC del token, en hexadecimal (Telegram admite letras, números, _ y -). */
export async function secretoWebhook(env) {
  const enc = new TextEncoder();
  const clave = await crypto.subtle.importKey("raw", enc.encode(env.TELEGRAM_BOT_TOKEN), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign("HMAC", clave, enc.encode("agenda-personal/webhook"));
  return [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Conectar: le dice a Telegram dónde avisar y da el enlace para atar el chat (código de un solo uso). */
export async function conectar(env, almacen, origen) {
  const yo = await llamar(env, "getMe");
  await llamar(env, "setWebhook", {
    url: `${origen}/api/telegram/webhook`,
    secret_token: await secretoWebhook(env),
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  const codigo = aleatorio(16);
  await almacen.codigoTelegram(await huella(codigo), new Date(Date.now() + MINUTOS_CODIGO * 60_000).toISOString());
  return { bot: yo.username, enlace: `https://t.me/${yo.username}?start=${codigo}` };
}

const enviar = (env, chatId, texto, botones) =>
  llamar(env, "sendMessage", {
    chat_id: chatId,
    text: String(texto).slice(0, MAX_TEXTO),
    link_preview_options: { is_disabled: true },
    ...(botones ? { reply_markup: { inline_keyboard: botones } } : {}),
  });

const escribiendo = (env, chatId) => llamar(env, "sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});

function base64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Una nota de voz a texto, con Whisper en Workers AI. */
export async function transcribir(env, archivo) {
  if (!env.AI) return { ok: false, error: "Para las notas de voz falta conectar Workers AI. Mientras, escríbemelo." };
  if ((archivo.file_size ?? 0) > MAX_AUDIO) return { ok: false, error: "Esa nota es demasiado larga para Telegram. ¿Me la partes en dos?" };
  try {
    const f = await llamar(env, "getFile", { file_id: archivo.file_id });
    const res = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${f.file_path}`);
    if (!res.ok) return { ok: false, error: "No pude bajar la nota de voz. ¿Me la mandas otra vez?" };
    const r = await env.AI.run(MODELO_VOZ, { audio: base64(new Uint8Array(await res.arrayBuffer())), language: "es", task: "transcribe" });
    const texto = String(r?.text ?? "").trim();
    if (!texto) return { ok: false, error: "No entendí la nota de voz. ¿Me la escribes?" };
    return { ok: true, texto };
  } catch {
    return { ok: false, error: "No pude escuchar la nota de voz. ¿Me la escribes?" };
  }
}

const hizoAlgo = (d) => Boolean(d && (d.acciones?.length || d.eventos?.length || d.proyectos?.length || d.personas?.length || d.ajustes || d.ritmo));

/** Lo que llega por el webhook (ya con la firma comprobada). */
export async function procesar(env, update) {
  if (update?.callback_query) return alPulsar(env, update.callback_query);
  const m = update?.message;
  if (!m?.chat || m.chat.type !== "private") return;
  const db = env.DB;
  const chatId = m.chat.id;
  const texto = String(m.text ?? "").trim();
  const dueno = await duenoDeChat(db, chatId);

  if (/^\/start\b/.test(texto)) {
    const codigo = texto.split(/\s+/)[1];
    if (codigo && (await vincularChat(db, codigo, chatId, m.from?.first_name ?? ""))) return enviar(env, chatId, BIENVENIDA);
    if (!dueno) return; // un desconocido: ni se le contesta
    return enviar(env, chatId, codigo ? `Ese enlace ya caducó o ya se usó, pero este chat ya está conectado.\n\n${AYUDA}` : AYUDA);
  }
  if (!dueno) return;
  if (texto.startsWith("/")) return enviar(env, chatId, AYUDA);

  const almacen = crearAlmacen(db, dueno);
  // Un id fijo por mensaje: si Telegram repite el aviso, no se guarda (ni se paga) dos veces.
  const id = `tg-${chatId}-${m.message_id}`;
  if (await almacen.captura(id)) return;

  let contenido = texto;
  let canal = "telegram";
  let antes = "";
  if (m.voice || m.audio) {
    await escribiendo(env, chatId);
    const t = await transcribir(env, m.voice ?? m.audio);
    if (!t.ok) return enviar(env, chatId, t.error);
    contenido = t.texto;
    canal = "voz";
    antes = `Escuché: «${t.texto}»\n\n`;
  } else if (!texto) {
    return enviar(env, chatId, "Por ahora entiendo texto y notas de voz.");
  }
  if (contenido.length > MAX_TEXTO) return enviar(env, chatId, `Eso es muy largo para una captura (más de ${MAX_TEXTO} caracteres). ¿Me lo partes?`);

  await escribiendo(env, chatId);
  const captura = await almacen.crearCaptura({ id, texto: contenido, canal });
  const r = await ordenarCaptura(env, almacen, captura);
  if (!r.ok) return enviar(env, chatId, `${antes}Lo guardé en la Bandeja, pero no lo pude ordenar: ${r.error}`);
  const botones = hizoAlgo(r.resultado?.deshacer) ? [[{ text: "Deshacer", callback_data: `d:${id}` }]] : undefined;
  return enviar(env, chatId, antes + r.resultado.tarjeta, botones);
}

async function alPulsar(env, cq) {
  const chatId = cq.message?.chat?.id;
  const dueno = await duenoDeChat(env.DB, chatId);
  const [tipo, id] = String(cq.data ?? "").split(/:(.+)/);
  if (!dueno || tipo !== "d" || !id) return llamar(env, "answerCallbackQuery", { callback_query_id: cq.id });
  const almacen = crearAlmacen(env.DB, dueno);
  const captura = await almacen.captura(id);
  const r = captura ? await deshacerCaptura(almacen, captura) : { ok: false, error: "Esa captura ya no existe." };
  await llamar(env, "answerCallbackQuery", { callback_query_id: cq.id, text: r.ok ? "Deshecho" : r.error });
  if (r.ok && cq.message?.message_id) {
    await llamar(env, "editMessageText", {
      chat_id: chatId,
      message_id: cq.message.message_id,
      text: `${cq.message.text ?? ""}\n\nDeshecho: no quedó nada guardado.`.slice(0, MAX_TEXTO),
    }).catch(() => {});
  }
}
