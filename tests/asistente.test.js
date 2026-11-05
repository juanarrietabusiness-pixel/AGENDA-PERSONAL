import { describe, it, expect } from "vitest";
import { VERSICULOS, FUERA_DE_CONTEXTO, elegirVersiculo, tocaVersiculo, versiculo, MOMENTOS } from "../src/lib/versiculos.js";
import { modeloPara, modeloEscogido, advertencias, pareceConfidencial, adaptarPeticion, destino, costo, MODELOS } from "../src/lib/ia.js";
import { diaQueNoCuadra, calendarioParaLaIA, instruccionesParaOrdenar } from "../src/lib/personalidad.js";
import { resumenDeLaManana, preguntaCompletaste, bloqueVersiculo } from "../src/lib/mensajes.js";
import { planDelDia } from "../src/lib/hoy.js";
import { nuevaAccion } from "../src/lib/metodo.js";
import { RITMO_BASE } from "../src/lib/ritmo.js";
import { AJUSTES_BASE } from "../src/lib/ajustes.js";

const HOY = "2026-11-04";

describe("los versículos", () => {
  it("cada uno tiene contexto, para qué sí y para qué no, y momentos que existen", () => {
    const ids = new Set();
    for (const v of VERSICULOS) {
      expect(ids.has(v.id)).toBe(false);
      ids.add(v.id);
      expect(v.texto.length).toBeGreaterThan(20);
      expect(v.contexto && v.usarPara && v.noUsarPara).toBeTruthy();
      for (const m of v.momentos) expect(Object.keys(MOMENTOS)).toContain(m);
    }
  });
  it("los que se citan fuera de contexto no están en el banco", () => {
    const refs = VERSICULOS.map((v) => v.ref);
    for (const f of FUERA_DE_CONTEXTO) expect(refs).not.toContain(f.ref);
  });
  it("nunca en un recordatorio ni en «¿la completaste?»; con «poco», sólo mañana y revisión", () => {
    expect(tocaVersiculo("recordatorio")).toBe(false);
    expect(tocaVersiculo("seguimiento")).toBe(false);
    expect(tocaVersiculo("cierre", "poco")).toBe(false);
    expect(tocaVersiculo("manana", "nunca")).toBe(false);
  });
  it("no repite en 30 días y es estable para el mismo día", () => {
    const a = elegirVersiculo({ momento: "manana", hoy: HOY });
    expect(elegirVersiculo({ momento: "manana", hoy: HOY }).id).toBe(a.id);
    const b = elegirVersiculo({ momento: "manana", hoy: HOY, historial: [{ id: a.id, dia: "2026-10-20" }] });
    expect(b.id).not.toBe(a.id);
  });
  it("el resumen pone el texto del banco, tal cual", () => {
    expect(bloqueVersiculo("col-3-23")).toContain(versiculo("col-3-23").texto);
    expect(bloqueVersiculo("inventado-1-1")).toBe("");
  });
});

describe("Claude o Meta", () => {
  const llaves = { anthropic: true, meta: true };
  it("por defecto Claude; Meta se escoge y Contributor también, a propósito", () => {
    expect(modeloEscogido("ordenar", { proveedor: "anthropic", modelos: {} })).toBe("claude-haiku-5-5");
    expect(modeloEscogido("conversar", { proveedor: "meta", modelos: {} })).toBe("muse-spark-1.3");
    expect(modeloEscogido("ordenar", { proveedor: "meta", modelos: { ordenar: "muse-spark-1.2-contributor" } })).toBe("muse-spark-1.2-contributor");
  });
  it("lo confidencial nunca va a un modelo que entrena", () => {
    const ia = { proveedor: "meta", modelos: { ordenar: "muse-spark-1.2-contributor" } };
    expect(modeloPara("ordenar", ia, { llaves })).toEqual({ modelo: "muse-spark-1.2-contributor", motivo: null });
    expect(modeloPara("ordenar", ia, { llaves, confidencial: true })).toEqual({ modelo: "muse-spark-1.3", motivo: "confidencial" });
    expect(modeloPara("ordenar", ia, { llaves: { anthropic: true }, confidencial: true }).modelo).toBe("claude-haiku-5-5");
  });
  it("sin la llave de un proveedor se usa el otro, y sin ninguna, nada", () => {
    expect(modeloPara("conversar", { proveedor: "meta", modelos: {} }, { llaves: { anthropic: true } })).toEqual({ modelo: "claude-sonnet-5-5", motivo: "sin-llave" });
    expect(modeloPara("conversar", { proveedor: "anthropic", modelos: {} }, { llaves: {} }).modelo).toBeNull();
  });
  it("la advertencia de Contributor sale mientras alguna función lo use", () => {
    expect(advertencias({ proveedor: "anthropic", modelos: {} })).toEqual([]);
    expect(advertencias({ proveedor: "meta", modelos: { conversar: "muse-spark-1.2-contributor" } })[0]).toMatch(/entrenar/);
  });
  it("reconoce lo confidencial", () => {
    const personas = [{ nombre: "Ana Gómez", confidencial: true }];
    expect(pareceConfidencial("privado: hablar con el pastor", {})).toBe(true);
    expect(pareceConfidencial("Seguimiento del discipulado de Pedro", {})).toBe(true);
    expect(pareceConfidencial("Llamar a Ana Gómez mañana", { personas })).toBe(true);
    expect(pareceConfidencial("Comprar cuerdas para la guitarra", { personas })).toBe(false);
  });
  it("a Meta le llega la petición sin lo propio de Claude", () => {
    const p = adaptarPeticion({
      model: "muse-spark-1.3",
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: [{ type: "text", text: "x", cache_control: { type: "ephemeral" } }],
      tools: [{ type: "web_search_20260209", name: "web_search" }, { name: "crear_accion", input_schema: {} }],
      messages: [{ role: "user", content: "hola" }],
    });
    expect(p.thinking).toBeUndefined();
    expect(p.output_config).toBeUndefined();
    expect(p.system[0].cache_control).toBeUndefined();
    expect(p.tools.map((t) => t.name)).toEqual(["crear_accion"]);
    expect(adaptarPeticion({ model: "claude-haiku-5-5", thinking: { type: "adaptive" } }).thinking).toBeDefined();
    expect(destino("muse-spark-1.3", { META_API_KEY: "k" }).url).toBe("https://api.meta.ai/v1/messages");
    expect(destino("claude-haiku-5-5", {}).url).toBe("https://api.anthropic.com/v1/messages");
  });
  it("cuánto cuesta ordenar un mes de capturas", () => {
    // 30 al día con ~6.000 tokens de entrada y ~1.000 de salida.
    const mes = (m) => 900 * costo(m, { entrada: 6000, salida: 1000 });
    expect(mes("claude-haiku-5-5")).toBeCloseTo(0.99, 1);
    expect(mes("muse-spark-1.2-contributor")).toBeCloseTo(0.72, 1);
    expect(mes("claude-sonnet-5-5")).toBeCloseTo(19.8, 0);
    expect(Object.values(MODELOS).filter((m) => m.entrena).length).toBe(1);
  });
});

describe("la voz", () => {
  it("le da al modelo los días con su nombre y comprueba el día que nombró", () => {
    expect(calendarioParaLaIA(HOY, 2)).toBe("2026-11-04 miércoles (hoy)\n2026-11-05 jueves (mañana)");
    expect(diaQueNoCuadra("reunión con Adolfo el jueves a las 7", "2026-11-05")).toBeNull();
    expect(diaQueNoCuadra("reunión con Adolfo el jueves a las 7", "2026-11-06")).toBe("jueves");
    expect(diaQueNoCuadra("reunión con Adolfo mañana", "2026-11-06")).toBeNull();
  });
  it("las instrucciones llevan el banco de versículos por id y la forma de responder", () => {
    const s = instruccionesParaOrdenar({ ajustes: AJUSTES_BASE, hoy: HOY });
    expect(s).toContain("col-3-23");
    expect(s).toContain("Jeremías 29:11");
    expect(s).toContain("\"elementos\"");
    expect(s).not.toContain(versiculo("col-3-23").texto);
  });
  it("el resumen de la mañana sale sin IA y no reprocha", () => {
    const acciones = [nuevaAccion({ titulo: "Enviar la propuesta a Dcasa", sombrero: "trabajo", lista: "siguientes", cuando: "2026-11-05", importante: true })];
    const plan = planDelDia({ dia: "2026-11-05", eventos: RITMO_BASE, acciones, ajustes: AJUSTES_BASE });
    const texto = resumenDeLaManana({ nombre: "Juan", plan, versiculo: "mar-1-35" });
    expect(texto).toContain("Juan");
    expect(texto).toContain("Enviar la propuesta a Dcasa");
    expect(texto).toContain("Célula");
    expect(texto).toContain("Levantándose muy de mañana");
    expect(texto).not.toMatch(/perezoso/i);
  });
  it("«¿la completaste?» cambia de tono y a la tercera avisa que no insiste más", () => {
    const a = nuevaAccion({ id: "x", titulo: "Pagar la luz", limite: "2026-11-03" });
    expect(preguntaCompletaste(a, 3, HOY)).toMatch(/Última vez/);
    expect(preguntaCompletaste(a, 1, HOY)).toMatch(/Pagar la luz/);
  });
});
