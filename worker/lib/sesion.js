// ============================================================
// Quién entra: contraseña, sesión y el alta de la primera cuenta
//
// Lo que se aprendió en el calendario de marketing y no se repite:
//   · workerd rechaza más de 100.000 vueltas de PBKDF2 por llamada, y ni
//     Node ni `wrangler dev` lo aplican: en producción daba «Error interno».
//     Aquí se ENCADENAN tramos de 100.000 hasta las 600.000 de OWASP.
//   · La cookie es `__Host-`: sólo vale para este origen exacto.
//   · De la sesión sólo se guarda la HUELLA (SHA-256): quien lea la base no
//     puede entrar con ella.
//
// El ALTA: es una aplicación de UNA persona. La primera cuenta sólo se crea
// si la base no tiene ninguna Y con el código `CODIGO_ALTA` (un secreto del
// Worker). Sin eso, quien llegara primero a la dirección se quedaría con ella.
// ============================================================

export const COOKIE = "__Host-sesion";
export const ITERACIONES = 600_000;
export const MAX_POR_LLAMADA = 100_000;
export const DIAS_SESION = 60;
export const MIN_CONTRASENA = 10;
export const MAX_FALLOS_IP = 5;
export const MAX_FALLOS_TOTAL = 30;
export const VENTANA_FALLOS_MIN = 15;

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const deHex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));

export const aleatorio = (bytes = 32) => hex(crypto.getRandomValues(new Uint8Array(bytes)));
export const huella = async (texto) => hex(await crypto.subtle.digest("SHA-256", enc.encode(texto)));

/** PBKDF2-SHA256 encadenado: cada tramo parte del resultado del anterior. */
export async function derivar(contrasena, salHex, total = ITERACIONES) {
  let material = enc.encode(contrasena);
  let sal = deHex(salHex);
  let bits;
  for (let hechas = 0; hechas < total; hechas += MAX_POR_LLAMADA) {
    const vueltas = Math.min(MAX_POR_LLAMADA, total - hechas);
    const clave = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveBits"]);
    bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: vueltas }, clave, 256);
    material = new Uint8Array(bits);
    sal = deHex(salHex);
  }
  return hex(bits);
}

export async function hashearContrasena(contrasena) {
  const sal = aleatorio(16);
  return `pbkdf2$${ITERACIONES}$${sal}$${await derivar(contrasena, sal)}`;
}

/** Compara sin cortar en el primer carácter distinto. */
export function igualSeguro(a, b) {
  const x = enc.encode(String(a));
  const y = enc.encode(String(b));
  let dif = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) dif |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return dif === 0;
}

export async function contrasenaCorrecta(contrasena, guardado) {
  const [tipo, vueltas, sal, hash] = String(guardado).split("$");
  if (tipo !== "pbkdf2" || !sal || !hash) return false;
  return igualSeguro(await derivar(contrasena, sal, Number(vueltas)), hash);
}

export function leerCookie(req, nombre = COOKIE) {
  const todas = req.headers.get("cookie") ?? "";
  for (const parte of todas.split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nombre) return v.join("=");
  }
  return null;
}

export const cookieSesion = (valor, segundos = DIAS_SESION * 86_400) =>
  `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${segundos}`;

export const cookieBorrada = () => cookieSesion("", 0);

/** Abre una sesión y devuelve el valor de la cookie. */
export async function abrirSesion(db, usuarioId) {
  const testigo = aleatorio(32);
  const caduca = new Date(Date.now() + DIAS_SESION * 86_400_000).toISOString();
  await db.prepare("insert into sesiones (huella, usuario_id, caduca) values (?, ?, ?)").bind(await huella(testigo), usuarioId, caduca).run();
  return testigo;
}

/** La persona de la petición, o null. */
export async function usuarioDeLaPeticion(db, req) {
  const testigo = leerCookie(req);
  if (!testigo || !/^[0-9a-f]{64}$/.test(testigo)) return null;
  const fila = await db
    .prepare("select u.id, u.email, u.nombre from sesiones s join usuarios u on u.id = s.usuario_id where s.huella = ? and s.caduca > ?")
    .bind(await huella(testigo), new Date().toISOString())
    .first();
  return fila ? { id: fila.id, email: fila.email, nombre: fila.nombre } : null;
}

export async function cerrarSesion(db, req) {
  const testigo = leerCookie(req);
  if (testigo) await db.prepare("delete from sesiones where huella = ?").bind(await huella(testigo)).run();
}

export async function hayUsuarios(db) {
  return Boolean(await db.prepare("select 1 as hay from usuarios limit 1").first("hay"));
}

export async function entrar(db, email, contrasena) {
  const fila = await db.prepare("select id, hash from usuarios where email = ?").bind(String(email ?? "").trim().toLowerCase()).first();
  if (!fila || !(await contrasenaCorrecta(String(contrasena ?? ""), fila.hash))) return null;
  return fila.id;
}

/** La primera cuenta. Devuelve { id } o { error }. */
export async function darDeAlta(db, env, { codigo, email, nombre, contrasena }) {
  if (!env.CODIGO_ALTA) return { error: "El alta no está abierta: falta el secreto CODIGO_ALTA del Worker.", estado: 403 };
  if (await hayUsuarios(db)) return { error: "Ya hay una cuenta. Entra con ella.", estado: 409 };
  if (!igualSeguro(codigo ?? "", env.CODIGO_ALTA)) return { error: "El código de alta no es correcto.", estado: 403 };
  const correo = String(email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { error: "Ese correo no parece válido.", estado: 400 };
  if (String(contrasena ?? "").length < MIN_CONTRASENA) return { error: `La contraseña necesita al menos ${MIN_CONTRASENA} caracteres.`, estado: 400 };
  const id = crypto.randomUUID();
  await db
    .prepare("insert into usuarios (id, email, nombre, hash) values (?, ?, ?, ?)")
    .bind(id, correo, String(nombre ?? "").trim().slice(0, 60), await hashearContrasena(String(contrasena)))
    .run();
  return { id };
}

// ── El tope de intentos ──────────────────────────────────────

/** La IP de quien pide (Cloudflare la pone en `CF-Connecting-IP`). */
export const ipDe = (req) => req.headers.get("cf-connecting-ip") || "sin-ip";

/** ¿Esa IP (o todas juntas) ya falló demasiado en la ventana? Se mira ANTES de calcular la contraseña. */
export async function demasiadosFallos(db, ip) {
  const desde = new Date(Date.now() - VENTANA_FALLOS_MIN * 60_000).toISOString();
  const fila = await db
    .prepare("select coalesce(sum(case when clave = ? then 1 else 0 end), 0) as de_ip, count(*) as total from intentos_acceso where momento > ?")
    .bind(`ip:${ip}`, desde)
    .first();
  return Number(fila?.de_ip ?? 0) >= MAX_FALLOS_IP || Number(fila?.total ?? 0) >= MAX_FALLOS_TOTAL;
}

export async function apuntarFallo(db, ip) {
  const ahora = new Date();
  await db.batch([
    db.prepare("delete from intentos_acceso where momento < ?").bind(new Date(ahora.getTime() - 86_400_000).toISOString()),
    db.prepare("insert into intentos_acceso (id, clave, momento) values (?, ?, ?)").bind(crypto.randomUUID(), `ip:${ip}`, ahora.toISOString()),
  ]);
}

/** Entrar bien borra los fallos de esa IP. */
export async function olvidarFallos(db, ip) {
  await db.prepare("delete from intentos_acceso where clave = ?").bind(`ip:${ip}`).run();
}

// ── Telegram: el chat dice de quién es (el webhook no trae sesión) ──

export async function duenoDeChat(db, chatId) {
  if (chatId === undefined || chatId === null) return null;
  const fila = await db.prepare("select owner_id from telegram where chat_id = ?").bind(String(chatId)).first();
  return fila?.owner_id ?? null;
}

/** Ata el chat a la cuenta del código, si existe y no caducó. El código sirve UNA vez. Devuelve el dueño o null. */
export async function vincularChat(db, codigo, chatId, nombre = "") {
  if (!/^[0-9a-f]{32}$/.test(String(codigo ?? ""))) return null;
  const ahora = new Date().toISOString();
  const fila = await db.prepare("select owner_id from telegram where codigo = ? and caduca > ?").bind(await huella(codigo), ahora).first();
  if (!fila) return null;
  await db.batch([
    // Un chat es de una sola cuenta: si estaba atado a otra, se suelta.
    db.prepare("update telegram set chat_id = null, vinculado = null where chat_id = ? and owner_id <> ?").bind(String(chatId), fila.owner_id),
    db
      .prepare("update telegram set chat_id = ?, nombre = ?, vinculado = ?, codigo = null, caduca = null where owner_id = ?")
      .bind(String(chatId), String(nombre ?? "").slice(0, 60), ahora, fila.owner_id),
  ]);
  return fila.owner_id;
}
