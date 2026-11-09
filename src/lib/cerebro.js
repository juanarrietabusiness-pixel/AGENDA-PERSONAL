// ============================================================
// El cerebro: lo que el asistente sabe de la vida de Juan
//
// Traído del calendario de marketing (worker/lib/cerebro/conocimiento.js,
// que a su vez viene de Agents Office): la misma búsqueda BM25 por pasajes
// sobre palabras en español sin tildes, con los plurales recortados. Aquí las
// notas son cortas y pocas (decenas o cientos), así que el índice se arma en
// cada llamada: cuesta milisegundos y no hace falta guardarlo.
//
// QUÉ HAY DENTRO
//   · La FICHA: quién es Juan, qué le importa, cómo trabaja. Va SIEMPRE.
//   · NOTAS que escribe Juan (de un sombrero, de un proyecto, de una persona).
//   · Lo APRENDIDO: lo que el asistente nota al ordenar lo que se le dice
//     («la célula se prepara los miércoles», «Adolfo lleva el retiro»). Entra
//     solo, se ve en Ajustes → «Lo que sé de ti» y se borra con un toque.
//
// Al ordenar, el asistente recibe la ficha y las notas que más tienen que
// ver con lo que se dijo: así deja de sonar genérico.
// ============================================================

export const TIPOS_NOTA = Object.freeze({ ficha: "Tu ficha", nota: "Nota", aprendido: "Aprendido" });
export const MAX_APRENDIDOS_POR_VEZ = 3;
export const MAX_NOTA = 2000;
export const PRESUPUESTO = 3500;

const PARADA = new Set(
  ("de la que el en y a los del se las por un para con no una su al lo como mas pero sus le ya o este si porque esta entre " +
    "cuando muy sin sobre tambien me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso " +
    "ante ellos e esto mi antes algunos que unos yo otro otras otra el tanto esa estos mucho quienes nada muchos cual poco " +
    "ella estar estas algunas algo nosotros tengo tiene hacer hay mis tus tu te").split(" "),
);

export const fold = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const raiz = (w) => (w.length > 5 && w.endsWith("ciones") ? w.slice(0, -2) : w.length > 4 && w.endsWith("es") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);

/** Las palabras que cuentan de un texto: sin tildes, sin las de relleno, con plurales recortados. */
export const tokens = (s) => fold(s).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2 && !PARADA.has(w)).map(raiz);

/**
 * Las notas que más tienen que ver con la consulta (BM25, k1 1,2, b 0,75), las mejores primero. Una nota sin
 * ninguna palabra en común no sale. Las que nombran un sombrero de la consulta suman un poco.
 */
export function buscar(notas, consulta, { n = 6 } = {}) {
  const q = [...new Set(tokens(consulta))];
  if (!q.length) return [];
  const docs = notas.filter((x) => x.tipo !== "ficha").map((x) => {
    const ws = tokens(`${x.titulo} ${x.titulo} ${x.texto} ${x.sombrero ?? ""}`);
    const tf = new Map();
    for (const w of ws) tf.set(w, (tf.get(w) || 0) + 1);
    return { nota: x, tf, len: ws.length || 1 };
  });
  if (!docs.length) return [];
  const df = new Map();
  for (const d of docs) for (const w of d.tf.keys()) df.set(w, (df.get(w) || 0) + 1);
  const avg = docs.reduce((s, d) => s + d.len, 0) / docs.length;
  const N = docs.length;
  const k1 = 1.2;
  const b = 0.75;
  const puntuadas = docs.map((d) => {
    let s = 0;
    for (const w of q) {
      const f = d.tf.get(w);
      if (!f) continue;
      const idf = Math.log(1 + (N - df.get(w) + 0.5) / (df.get(w) + 0.5));
      s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / avg)));
    }
    return { nota: d.nota, s };
  });
  return puntuadas.filter((x) => x.s > 0).sort((a, b2) => b2.s - a.s).slice(0, n).map((x) => x.nota);
}

/** La ficha (o null). */
export const fichaDe = (notas) => notas.find((x) => x.tipo === "ficha") ?? null;

/**
 * Lo que va en el sistema del asistente: la ficha entera y las notas que tienen que ver con lo dicho, dentro de un
 * presupuesto de caracteres. Devuelve { texto, usadas } (los ids, para contar cuánto se usa cada nota).
 */
export function paraElAsistente(notas, consulta, { presupuesto = PRESUPUESTO } = {}) {
  const partes = [];
  const usadas = [];
  let resto = presupuesto;
  const ficha = fichaDe(notas);
  if (ficha?.texto?.trim()) {
    const t = ficha.texto.trim().slice(0, Math.min(1500, resto));
    partes.push(`QUIÉN ES (su ficha):\n${t}`);
    resto -= t.length;
    usadas.push(ficha.id);
  }
  const relevantes = buscar(notas, consulta);
  const lineas = [];
  for (const x of relevantes) {
    const linea = `- [${x.titulo}]${x.sombrero ? ` (${x.sombrero})` : ""}: ${x.texto.replace(/\s+/g, " ").trim()}`.slice(0, 600);
    if (linea.length > resto) break;
    lineas.push(linea);
    resto -= linea.length;
    usadas.push(x.id);
  }
  if (lineas.length) partes.push(`LO QUE SABES DE ÉL QUE TIENE QUE VER CON ESTO:\n${lineas.join("\n")}`);
  return { texto: partes.join("\n\n"), usadas };
}

const parecidos = (a, b) => {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return false;
  let comunes = 0;
  for (const w of ta) if (tb.has(w)) comunes++;
  return comunes / Math.min(ta.size, tb.size) >= 0.7;
};

/**
 * Lo que el asistente dice que aprendió, comprobado: con título y texto, corto, sin repetir lo que ya sabe y como
 * mucho tres por vez. Lo confidencial no se aprende. Devuelve la lista limpia.
 */
export function limpiarAprendizajes(lista, existentes = [], { sombreros = [] } = {}) {
  const out = [];
  for (const a of Array.isArray(lista) ? lista : []) {
    const titulo = String(a?.titulo ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    const texto = String(a?.texto ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
    if (!titulo || !texto || a?.confidencial) continue;
    if ([...existentes, ...out].some((x) => parecidos(x.titulo, titulo) || parecidos(x.texto ?? "", texto))) continue;
    out.push({ titulo, texto, sombrero: sombreros.some((s) => s.id === a.sombrero) ? a.sombrero : null });
    if (out.length >= MAX_APRENDIDOS_POR_VEZ) break;
  }
  return out;
}

/** Una nota escrita a mano o editada: limpia. */
export function limpiarNota(n = {}, { sombreros = [] } = {}) {
  const tipo = TIPOS_NOTA[n.tipo] ? n.tipo : "nota";
  return {
    titulo: String(n.titulo ?? (tipo === "ficha" ? "Mi ficha" : "")).replace(/\s+/g, " ").trim().slice(0, 80),
    texto: String(n.texto ?? "").trim().slice(0, tipo === "ficha" ? 4000 : MAX_NOTA),
    sombrero: sombreros.some((s) => s.id === n.sombrero) ? n.sombrero : null,
    tipo,
  };
}

/** La ficha de partida: lo que Juan contó al empezar. La edita él. */
export const FICHA_INICIAL = [
  "Juan David. Dirige su agencia de marketing, Juancito Ads, con su equipo.",
  "Es cristiano y sirve en su iglesia: lidera una célula (los jueves en la noche, se planifica los lunes) y va a los servicios del martes, el miércoles y el domingo.",
  "Tiene una vida artística (música, presentaciones, grabaciones en el estudio los jueves en la tarde).",
  "Está casado; su esposa y su familia son prioridad.",
  "Ora temprano casi todos los días y lee la Palabra al mediodía: esos tiempos no se interrumpen.",
  "Quiere un mentor de productividad, no sólo una agenda: que le diga qué vale más, qué delegar y qué soltar.",
].join("\n");
