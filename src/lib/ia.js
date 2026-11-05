// ============================================================
// Quién piensa: Claude o Meta, escogido por función
//
// Tres trabajos distintos, y cada uno puede ir con un modelo distinto:
//
//   ordenar     leer lo que capturas y dejarlo en su sitio (muchas veces al día, corto)
//   conversar   hablar contigo por Telegram, la aplicación o Claude
//   planear     metas, revisión semanal, qué delegar, qué soltar (pocas veces, largo)
//
// Meta habla el MISMO formato de mensajes que Anthropic (api.meta.ai/v1/
// messages), así que la llamada es una y sólo cambia la puerta. Se le quita
// lo que es propio de Claude (el razonamiento, `effort`, las marcas de caché
// y las herramientas que ejecuta Anthropic), igual que en el calendario de
// marketing, donde Muse ya funciona.
//
// MUSE SPARK CONTRIBUTOR ENTRENA CON LO QUE RECIBE. Es la opción más barata,
// y aquí lo que recibe es tu vida: tu familia, tu iglesia, las personas que
// discipulas. Por eso: se puede escoger, pero la advertencia no se cierra
// mientras alguna función lo use, y lo CONFIDENCIAL nunca le llega (va con un
// modelo que no entrena).
// ============================================================

export const MODELOS = Object.freeze({
  "claude-haiku-5-5": { proveedor: "anthropic", nombre: "Claude Haiku 5.5", entrada: 0.1, salida: 0.5, entrena: false },
  "claude-sonnet-5-5": { proveedor: "anthropic", nombre: "Claude Sonnet 5.5", entrada: 2, salida: 10, entrena: false },
  "claude-opus-5-5": { proveedor: "anthropic", nombre: "Claude Opus 5.5", entrada: 4, salida: 20, entrena: false },
  "muse-spark-1.3": { proveedor: "meta", nombre: "Muse Spark 1.3", entrada: 1.25, salida: 4.25, entrena: false },
  "muse-spark-1.2-contributor": { proveedor: "meta", nombre: "Muse Spark 1.2 Contributor", entrada: 0.1, salida: 0.2, entrena: true },
});

export const PROVEEDORES = Object.freeze({
  anthropic: { nombre: "Claude (Anthropic)", llave: "ANTHROPIC_API_KEY" },
  meta: { nombre: "Meta (Muse Spark)", llave: "META_API_KEY" },
});

export const FUNCIONES = Object.freeze({
  ordenar: { nombre: "Ordenar lo que capturas", detalle: "Muchas veces al día, mensajes cortos" },
  conversar: { nombre: "Conversar", detalle: "Telegram, la aplicación y Claude" },
  planear: { nombre: "Planear y revisar", detalle: "Metas, revisión semanal, qué delegar y qué soltar" },
});

/** Los modelos de partida de cada proveedor, por función. Ninguno entrena: Contributor se escoge a propósito. */
export const POR_DEFECTO = Object.freeze({
  anthropic: { ordenar: "claude-haiku-5-5", conversar: "claude-sonnet-5-5", planear: "claude-sonnet-5-5" },
  meta: { ordenar: "muse-spark-1.3", conversar: "muse-spark-1.3", planear: "muse-spark-1.3" },
});

export const AJUSTES_IA_BASE = Object.freeze({ proveedor: "anthropic", modelos: {} });

export const modelosDe = (proveedor) => Object.keys(MODELOS).filter((id) => MODELOS[id].proveedor === proveedor);
export const esMeta = (id) => MODELOS[id]?.proveedor === "meta";

/** El modelo escogido para una función, sin mirar llaves ni confidencialidad. */
export function modeloEscogido(funcion, ia = AJUSTES_IA_BASE) {
  const propio = ia.modelos?.[funcion];
  if (propio && MODELOS[propio]) return propio;
  return POR_DEFECTO[ia.proveedor in POR_DEFECTO ? ia.proveedor : "anthropic"][funcion];
}

/**
 * El modelo que de verdad se usa:
 *   · si es CONFIDENCIAL y el escogido entrena → uno que no entrena (Muse Spark 1.3 si hay llave de Meta; si no, Claude);
 *   · si falta la llave de su proveedor → el del otro proveedor para esa función;
 *   · sin ninguna llave → null.
 * Devuelve { modelo, motivo } con el motivo del cambio, si lo hubo.
 */
export function modeloPara(funcion, ia, { confidencial = false, llaves = {} } = {}) {
  const tiene = (id) => Boolean(llaves[MODELOS[id].proveedor]);
  let modelo = modeloEscogido(funcion, ia);
  let motivo = null;
  if (confidencial && MODELOS[modelo].entrena) {
    modelo = llaves.meta ? "muse-spark-1.3" : POR_DEFECTO.anthropic[funcion];
    motivo = "confidencial";
  }
  if (!tiene(modelo)) {
    const otro = MODELOS[modelo].proveedor === "meta" ? "anthropic" : "meta";
    const alterno = POR_DEFECTO[otro][funcion];
    if (!tiene(alterno)) return { modelo: null, motivo: "sin-llaves" };
    modelo = alterno;
    motivo = motivo ?? "sin-llave";
  }
  return { modelo, motivo };
}

/** Las advertencias que la pantalla de ajustes enseña sin poder cerrarlas. */
export function advertencias(ia) {
  const entrenan = Object.keys(FUNCIONES).filter((f) => MODELOS[modeloEscogido(f, ia)]?.entrena);
  if (!entrenan.length) return [];
  const nombres = entrenan.map((f) => FUNCIONES[f].nombre.toLowerCase()).join(", ");
  return [
    `Muse Spark 1.2 Contributor (en: ${nombres}): Meta puede usar lo que recibe para entrenar sus modelos. Aquí eso es tu vida: tu familia, tu iglesia y las personas que discipulas. Lo marcado como confidencial nunca le llega: va con un modelo que no entrena.`,
  ];
}

// ------------------------------------------------------------
// ¿Es confidencial?
// ------------------------------------------------------------

/** Palabras que casi siempre traen algo de otra persona que no es para compartir. Estrechas a propósito. */
export const PALABRAS_CONFIDENCIALES = Object.freeze([
  "confidencial", "privado", "consejería", "consejeria", "discipulado", "petición de oración", "peticion de oracion",
  "pecado", "confesó", "confeso", "crisis", "divorcio", "separación", "separacion", "adicción", "adiccion",
  "diagnóstico", "diagnostico", "deuda", "denuncia",
]);

const sinTildes = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * ¿Esta captura debe ir con un modelo que no entrena? Sí si empieza por «privado:» o «confidencial:», si nombra a una
 * persona marcada como confidencial (las que discipulas, por ejemplo) o si trae una de las palabras de la lista.
 * Es una red, no una garantía: lo que no se reconoce no se detecta. Por eso Contributor nunca es el de partida.
 */
export function pareceConfidencial(texto, { personas = [], palabras = PALABRAS_CONFIDENCIALES } = {}) {
  const t = sinTildes(texto);
  if (/^\s*(privado|confidencial)\s*:/.test(t)) return true;
  if (palabras.some((p) => t.includes(sinTildes(p)))) return true;
  return personas.some((p) => p.confidencial && [p.nombre, ...(p.apodos ?? [])].some((n) => n && new RegExp(`\\b${escapar(sinTildes(n))}\\b`).test(t)));
}

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ------------------------------------------------------------
// La llamada
// ------------------------------------------------------------

const SOLO_ANTHROPIC = /^(web_search|web_fetch|code_execution|bash|text_editor|computer|memory)_/;

const sinCache = (bloques) =>
  Array.isArray(bloques)
    ? bloques.map((b) => {
      if (!b || typeof b !== "object" || !("cache_control" in b)) return b;
      const { cache_control: _quitada, ...resto } = b;
      return resto;
    })
    : bloques;

/** La petición tal como la acepta ese modelo. Pura. */
export function adaptarPeticion(peticion) {
  if (!esMeta(peticion?.model)) return peticion;
  const { thinking: _t, output_config: _o, ...resto } = peticion;
  const salida = { ...resto };
  if (Array.isArray(resto.system)) salida.system = sinCache(resto.system);
  if (Array.isArray(resto.messages)) {
    salida.messages = resto.messages.map((m) => (Array.isArray(m?.content) ? { ...m, content: sinCache(m.content) } : m));
  }
  if (Array.isArray(resto.tools)) {
    const tools = sinCache(resto.tools).filter((t) => !SOLO_ANTHROPIC.test(String(t?.type ?? "")));
    if (tools.length) salida.tools = tools;
    else {
      delete salida.tools;
      delete salida.tool_choice;
    }
  }
  return salida;
}

/** A dónde va la llamada y con qué cabeceras (Meta toma la llave como Bearer y también como x-api-key). */
export function destino(modelo, env = {}) {
  if (esMeta(modelo)) {
    const llave = env.META_API_KEY || env.MODEL_API_KEY || "";
    return {
      url: `${(env.META_BASE || "https://api.meta.ai/v1").replace(/\/$/, "")}/messages`,
      cabeceras: { "Content-Type": "application/json", "x-api-key": llave, Authorization: `Bearer ${llave}`, "anthropic-version": "2023-06-01" },
    };
  }
  return {
    url: "https://api.anthropic.com/v1/messages",
    cabeceras: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY || "", "anthropic-version": "2023-06-01" },
  };
}

/** US$ de una llamada con esos tokens. */
export function costo(modelo, { entrada = 0, salida = 0 }) {
  const m = MODELOS[modelo];
  if (!m) return 0;
  return (entrada * m.entrada + salida * m.salida) / 1_000_000;
}
