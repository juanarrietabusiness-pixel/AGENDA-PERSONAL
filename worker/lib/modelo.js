// ============================================================
// La llamada a la IA: Claude o Meta, por la misma puerta
//
// Meta habla el formato de mensajes de Anthropic, así que la petición es una
// y `destino()` decide a dónde va. Lo que se aprendió en el calendario de
// marketing:
//   · el texto de la respuesta se junta de TODOS los bloques (con un bloque
//     de razonamiento delante, buscar «el primer texto» daba vacío);
//   · un id de modelo es una apuesta sobre la cuenta: si Anthropic contesta
//     que no lo tiene, se prueba el siguiente de la lista;
//   · si Meta rechaza el modelo (401/403/404) y hay llave de Anthropic, se
//     usa Claude y se dice.
// ============================================================

import { modeloPara, adaptarPeticion, destino, costo, MODELOS, POR_DEFECTO } from "../../src/lib/ia.js";

export class ErrorIA extends Error {
  constructor(mensaje, estado = 502) {
    super(mensaje);
    this.estado = estado;
  }
}

/** Si la cuenta no tiene el modelo, éstos van detrás, en orden. */
const RELEVOS_ANTHROPIC = Object.freeze({
  // Haiku 4.5 no va de relevo: rechaza `output_config.effort` (pasó en el calendario de marketing).
  "claude-haiku-5-5": ["claude-sonnet-5"],
  "claude-sonnet-5-5": ["claude-sonnet-5"],
  "claude-opus-5-5": ["claude-opus-5", "claude-sonnet-5"],
});

export const llaves = (env) => ({ anthropic: Boolean(env.ANTHROPIC_API_KEY), meta: Boolean(env.META_API_KEY || env.MODEL_API_KEY) });

const textoDe = (mensaje) =>
  (mensaje?.content ?? [])
    .filter((b) => b?.type === "text")
    .map((b) => b.text)
    .join("");

async function motivo(res) {
  const t = await res.text().catch(() => "");
  try {
    const j = JSON.parse(t);
    return { tipo: j?.error?.type ?? "", mensaje: j?.error?.message ?? t.slice(0, 300) };
  } catch {
    return { tipo: "", mensaje: t.slice(0, 300) };
  }
}

async function una(env, peticion) {
  const { url, cabeceras } = destino(peticion.model, env);
  const res = await fetch(url, { method: "POST", headers: cabeceras, body: JSON.stringify(adaptarPeticion(peticion)) });
  if (res.ok) return { ok: true, mensaje: await res.json() };
  return { ok: false, estado: res.status, ...(await motivo(res)) };
}

/**
 * Una llamada sin streaming (las de ordenar son cortas).
 *   { funcion: "ordenar" | "conversar" | "planear", ia, confidencial, system, messages, max }
 * Devuelve { texto, modelo, entrada, salida, costo, aviso }.
 */
export async function llamarModelo(env, { funcion, ia, confidencial = false, system, messages, max = 8000 }) {
  const eleccion = modeloPara(funcion, ia, { confidencial, llaves: llaves(env) });
  if (!eleccion.modelo) throw new ErrorIA("No hay ninguna llave de IA puesta en el Worker (ANTHROPIC_API_KEY o META_API_KEY).", 503);

  const esAnthropic = (m) => MODELOS[m]?.proveedor === "anthropic" || /^claude-/.test(m);
  const intentos = [eleccion.modelo, ...(esAnthropic(eleccion.modelo) ? RELEVOS_ANTHROPIC[eleccion.modelo] ?? [] : [])];
  let aviso = eleccion.motivo === "confidencial" ? "Era confidencial: no fue a un modelo que entrena." : null;

  for (let i = 0; i < intentos.length; i++) {
    const modelo = intentos[i];
    const peticion = {
      model: modelo,
      max_tokens: max,
      system,
      messages,
      // Ordenar es leer y clasificar: poco razonamiento basta.
      ...(funcion === "ordenar" ? { output_config: { effort: "low" } } : {}),
    };
    const r = await una(env, peticion);
    if (r.ok) {
      const uso = r.mensaje.usage ?? {};
      return {
        texto: textoDe(r.mensaje),
        modelo,
        entrada: uso.input_tokens ?? 0,
        salida: uso.output_tokens ?? 0,
        costo: costo(modelo, { entrada: uso.input_tokens ?? 0, salida: uso.output_tokens ?? 0 }),
        aviso,
      };
    }
    const noTieneElModelo = r.estado === 404 || r.tipo === "not_found_error" || /model/i.test(r.mensaje) && r.estado === 400;
    if (esAnthropic(modelo) && noTieneElModelo && i < intentos.length - 1) continue;
    // Meta no deja ese modelo: Claude, si hay llave.
    if (!esAnthropic(modelo) && [401, 403, 404].includes(r.estado) && env.ANTHROPIC_API_KEY) {
      aviso = `Meta no aceptó ${MODELOS[modelo]?.nombre ?? modelo} (${r.estado}); lo hizo Claude.`;
      intentos.splice(i + 1, 0, POR_DEFECTO.anthropic[funcion]);
      continue;
    }
    if (/credit balance/i.test(r.mensaje)) throw new ErrorIA("Se acabó el saldo de Anthropic: recárgalo en su consola.", 402);
    throw new ErrorIA(`La IA rechazó el pedido (${r.estado}): ${r.mensaje}`, 502);
  }
  throw new ErrorIA("Ningún modelo aceptó el pedido.", 502);
}
