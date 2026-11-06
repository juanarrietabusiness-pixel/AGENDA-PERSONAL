// ============================================================
// El mentor: un consejo con toda la vida de Juan delante
//
// Lo que el código ya calcula (valor, qué se puede delegar, el reparto entre
// sombreros frente a su prioridad, lo que lleva días parado) se le pasa al
// modelo, que escribe tres a cinco consejos concretos: qué hacer primero, qué
// delegar y a quién, qué soltar sin culpa, qué sombrero se está quedando sin
// tiempo. Nada se cambia solo: el consejo sugiere, Juan decide (o se lo dice
// al asistente).
// ============================================================

import { instruccionesBase, listasParaLaIA } from "../../src/lib/personalidad.js";
import { sacarJSON } from "../../src/lib/agente.js";
import { hoyEn, textoLargo } from "../../src/lib/fechas.js";
import { sombrerosDe } from "../../src/lib/sombreros.js";
import { paraElAsistente } from "../../src/lib/cerebro.js";
import { loQueMasVale, porDelegar, bajoValor, repartoAbierto } from "../../src/lib/agenda.js";
import { bloqueVersiculo } from "../../src/lib/mensajes.js";
import { versiculo as porId } from "../../src/lib/versiculos.js";
import { llamarModelo } from "./modelo.js";

const FORMA = `Responde SOLO con JSON:
{
  "consejos": [{ "titulo": "corto, con verbo", "texto": "dos o tres líneas concretas: qué, por qué (con lo que sabes de él) y el primer paso" }],
  "versiculo": "id del banco si encaja (momentos: planear, delegar, constancia, descanso)" | null
}
De 3 a 5 consejos. Nombra las tareas y las personas por su nombre. No inventes datos.`;

/** El consejo del mentor. Devuelve { texto, consejos, fecha }. */
export async function consejo(env, almacen, { momento = new Date() } = {}) {
  const [estado, cerebro] = await Promise.all([almacen.estado(), almacen.cerebro()]);
  const hoy = hoyEn(estado.ajustes?.zona, momento);
  const sombreros = sombrerosDe(estado.ajustes);
  const ctx = { hoy, proyectos: estado.proyectos, sombreros };
  const reparto = repartoAbierto(estado.acciones, sombreros);
  const analisis = [
    "LO QUE YA CALCULÓ EL CÓDIGO:",
    `- Lo que más vale ahora: ${loQueMasVale(estado.acciones, ctx).map((a) => a.titulo).join("; ") || "(nada marcado de valor alto)"}`,
    `- Se podría delegar: ${porDelegar(estado.acciones).map((a) => `${a.titulo} → ${a.delegable.a}`).join("; ") || "(nada)"}`,
    `- Valor bajo y abierto: ${bajoValor(estado.acciones, ctx).map((a) => a.titulo).join("; ") || "(nada)"}`,
    `- Lo abierto por sombrero (prioridad · cuántas · de valor alto): ${reparto.map((r) => `${r.prioridad}. ${r.nombre}: ${r.abiertas} (${r.altos} altas)`).join(", ")}`,
    `- Pospuesto tres veces o más: ${estado.acciones.filter((a) => a.estado === "abierta" && a.pospuesta >= 3).map((a) => a.titulo).join("; ") || "(nada)"}`,
  ].join("\n");
  const system = [
    instruccionesBase({ nombre: estado.ajustes?.nombre, sombreros }),
    "",
    `HOY es ${textoLargo(hoy)} (${hoy}).`,
    "",
    paraElAsistente(cerebro, "prioridades visión metas familia iglesia trabajo delegar").texto,
    "",
    listasParaLaIA({ acciones: estado.acciones, eventos: estado.eventos, proyectos: estado.proyectos, hoy, sombreros }),
    "",
    analisis,
    "",
    "Ahora hablas como su MENTOR de productividad: honesto, concreto y con gracia. Lo que más vale primero; lo que otro puede hacer, se delega; lo de poco valor, se suelta sin culpa; y el descanso también es obediencia.",
    "",
    FORMA,
  ].join("\n");
  const r = await llamarModelo(env, { funcion: "planear", ia: estado.ajustes?.ia ?? {}, system, messages: [{ role: "user", content: "¿Qué me aconsejas para esta semana?" }], max: 6000 });
  await almacen.registrarConsumo({ modelo: r.modelo, funcion: "planear", entrada: r.entrada, salida: r.salida, costo: r.costo });
  const datos = sacarJSON(r.texto) ?? {};
  const consejos = (Array.isArray(datos.consejos) ? datos.consejos : [])
    .map((c) => ({ titulo: String(c?.titulo ?? "").trim().slice(0, 100), texto: String(c?.texto ?? "").trim().slice(0, 600) }))
    .filter((c) => c.titulo && c.texto)
    .slice(0, 5);
  if (!consejos.length) throw new Error("El mentor no supo qué decir esta vez. Prueba otra vez.");
  const v = datos.versiculo && porId(datos.versiculo) ? bloqueVersiculo(datos.versiculo) : "";
  const texto = [...consejos.map((c, i) => `${i + 1}. ${c.titulo}\n${c.texto}`), v].filter(Boolean).join("\n\n");
  return { texto, consejos, versiculo: v || null, fecha: hoy };
}
