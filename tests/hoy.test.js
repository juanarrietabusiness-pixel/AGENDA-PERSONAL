import { inicioDePreparar, aplicarPreparacion, bloquesPreparados } from "../src/lib/preparar.js";
import { describe, it, expect } from "vitest";
import { eventosDelDia, huecos, ventanasPara, planDelDia, porDecidir, ahora } from "../src/lib/hoy.js";
import { nuevaAccion } from "../src/lib/metodo.js";
import { RITMO_BASE } from "../src/lib/ritmo.js";
import { AJUSTES_BASE } from "../src/lib/ajustes.js";

const JUEVES = "2026-11-05";

describe("lo fijo del día", () => {
  it("el jueves trae la oración, la Palabra, el estudio y la célula, en orden", () => {
    expect(eventosDelDia(RITMO_BASE, JUEVES).map((e) => e.id)).toEqual(["oracion-madrugada", "palabra-mediodia", "grabacion-estudio", "celula"]);
  });
  it("el domingo, el servicio", () => {
    expect(eventosDelDia(RITMO_BASE, "2026-11-08").map((e) => e.id)).toEqual(["servicio-domingo"]);
  });
  it("los huecos son lo que queda libre entre lo fijo", () => {
    const fijos = [{ inicio: "12:00", fin: "12:30" }, { inicio: "15:00", fin: "18:30" }];
    expect(huecos(fijos, { desde: "09:00", hasta: "20:00" })).toEqual([
      { inicio: "09:00", fin: "12:00", minutos: 180 },
      { inicio: "12:30", fin: "15:00", minutos: 150 },
      { inicio: "18:30", fin: "20:00", minutos: 90 },
    ]);
  });
  it("lo del Trabajo va dentro de la jornada y lo demás fuera; el sábado no hay jornada", () => {
    const hueco = { inicio: "07:00", fin: "20:00" };
    expect(ventanasPara("trabajo", hueco, JUEVES, AJUSTES_BASE)).toEqual([{ a: 540, b: 1080 }]);
    expect(ventanasPara("personal", hueco, JUEVES, AJUSTES_BASE)).toEqual([{ a: 420, b: 540 }, { a: 1080, b: 1200 }]);
    expect(ventanasPara("trabajo", hueco, "2026-11-07", AJUSTES_BASE)).toEqual([]);
  });
});

describe("el plan del día", () => {
  const acciones = [
    nuevaAccion({ id: "w1", titulo: "Enviar la propuesta a Dcasa", sombrero: "trabajo", lista: "siguientes", cuando: JUEVES, minutos: 60, importante: true }),
    nuevaAccion({ id: "p1", titulo: "Comprar el perfume para mi esposa", sombrero: "personal", lista: "siguientes", cuando: JUEVES, minutos: 30 }),
    nuevaAccion({ id: "i1", titulo: "Preparar el tema de la célula", sombrero: "iglesia", lista: "siguientes", cuando: JUEVES, minutos: 60, importante: true }),
    nuevaAccion({ id: "viejo", titulo: "Ordenar el estudio", sombrero: "artistico", lista: "siguientes", cuando: "2026-11-03" }),
    nuevaAccion({ id: "rojo", titulo: "Pagar la luz", sombrero: "personal", lista: "siguientes", limite: "2026-11-04", importante: true, minutos: 15 }),
  ];
  const plan = planDelDia({ dia: JUEVES, eventos: RITMO_BASE, acciones, ajustes: AJUSTES_BASE });

  it("propone bloques sin pisar lo fijo, cada sombrero en su ventana", () => {
    const w1 = plan.propuesta.find((b) => b.accionId === "w1");
    expect(w1.inicio >= "09:00" && w1.fin <= "18:00").toBe(true);
    const p1 = plan.propuesta.find((b) => b.accionId === "p1");
    expect(p1.fin <= "09:00" || p1.inicio >= "18:00").toBe(true);
    for (const b of plan.propuesta) {
      for (const f of plan.fijos) expect(b.fin <= f.inicio || b.inicio >= f.fin).toBe(true);
    }
    // Ningún bloque se monta sobre otro.
    const orden = [...plan.propuesta].sort((x, y) => x.inicio.localeCompare(y.inicio));
    for (let i = 1; i < orden.length; i++) expect(orden[i].inicio >= orden[i - 1].fin).toBe(true);
  });
  it("no planea antes del resumen de la mañana", () => {
    expect(plan.libres[0].inicio >= AJUSTES_BASE.avisos.resumen[4]).toBe(true);
  });
  it("lo de ayer va a «por decidir», no a rojo; lo vencido sí es urgente", () => {
    expect(plan.porDecidir.map((a) => a.id)).toEqual(["viejo"]);
    expect(plan.vencen.map((a) => a.id)).toContain("rojo");
    expect(porDecidir(acciones, JUEVES).map((a) => a.id)).not.toContain("rojo");
  });
  it("las 3 de hoy sugieren lo urgente e importante primero", () => {
    expect(plan.tres.sugeridas[0].id).toBe("rojo");
    expect(plan.tres.sugeridas).toHaveLength(3);
  });
  it("si no cabe, lo dice", () => {
    const muchas = Array.from({ length: 20 }, (_, i) => nuevaAccion({ id: `x${i}`, titulo: `Tarea ${i}`, sombrero: "trabajo", lista: "siguientes", cuando: JUEVES, minutos: 120 }));
    const lleno = planDelDia({ dia: JUEVES, eventos: RITMO_BASE, acciones: muchas, ajustes: AJUSTES_BASE });
    expect(lleno.sobrecarga).toBe(true);
    expect(lleno.noCaben.length).toBeGreaterThan(0);
  });
  it("«ahora» dice qué está pasando y qué sigue", () => {
    const { actual, siguiente } = ahora(plan, "20:15");
    expect(actual.id).toBe("celula");
    expect(siguiente).toBeNull();
  });
});

describe("lo que ya pasó del día", () => {
  it("a las siete de la noche no se propone nada para la mañana", () => {
    const acciones = [nuevaAccion({ id: "x", titulo: "Llamar a Adolfo", sombrero: "iglesia", lista: "siguientes", cuando: "2026-11-06", minutos: 15 })];
    const plan = planDelDia({ dia: "2026-11-06", eventos: RITMO_BASE, acciones, ajustes: AJUSTES_BASE, ahora: "18:52" });
    expect(plan.libres[0].inicio).toBe("18:55");
    expect(plan.propuesta[0].inicio >= "18:55").toBe(true);
  });
});

describe("prepara tu día", () => {
  const HOY = "2026-11-17"; // martes
  const MAN = "2026-11-18";
  const trabajo = { id: "tb", titulo: "Trabajo", sombrero: "trabajo", inicio: "08:00", fin: "12:00", repite: { regla: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", inicio: "2026-01-05" } };
  const t = (datos) => ({ ...nuevaAccion({ lista: "siguientes", sombrero: "trabajo", ...datos }, HOY), ...datos });
  const acciones = [
    t({ id: "p1", titulo: "Propuesta", cuando: MAN, importante: true }),
    t({ id: "p2", titulo: "Informe", cuando: MAN }),
    t({ id: "p3", titulo: "Llamar", cuando: MAN, planDia: { dia: MAN, n: 0 } }),
    t({ id: "v1", titulo: "Declaración", limite: "2026-11-19" }),
    t({ id: "q1", titulo: "Quedó del lunes", cuando: "2026-11-16", pasadas: 2, vieneDe: "2026-11-13" }),
    t({ id: "s1", titulo: "Sin día", sombrero: "personal" }),
  ];

  it("arranca con tus 3 propuestas, lo del día en su orden y lo que se puede sumar aparte", () => {
    const r = inicioDePreparar(acciones, [trabajo], MAN, { hoy: HOY });
    expect(r.tres).toHaveLength(3);
    expect(r.tres).toContain("p1");
    expect([...r.tres, ...r.orden].sort()).toEqual(expect.arrayContaining(["p1", "p2", "p3"]));
    expect(new Set([...r.tres, ...r.orden]).size).toBe(r.tres.length + r.orden.length);
    const sumar = Object.values(r.sumar).flat().map((a) => a.id);
    expect(sumar).toContain("s1");
    expect(sumar.some((id) => r.tres.includes(id) || r.orden.includes(id))).toBe(false);
  });

  it("al aplicar: tus 3 escogidas y en su orden, lo demás ordenado, lo quitado sin día y lo de antes decidido", () => {
    const nuevas = aplicarPreparacion(acciones, { dia: MAN, tres: ["q1", "p1"], orden: ["p3", "v1"], quitadas: ["p2"] });
    const a = Object.fromEntries(nuevas.map((x) => [x.id, x]));
    expect(a.q1).toMatchObject({ cuando: MAN, enfoque: MAN, pasadas: 0, vieneDe: null, planDia: { dia: MAN, n: -3 } });
    expect(a.p1).toMatchObject({ enfoque: MAN, planDia: { dia: MAN, n: -2 } });
    expect(a.p3).toMatchObject({ cuando: MAN, planDia: { dia: MAN, n: 0 }, enfoque: null });
    expect(a.v1).toMatchObject({ cuando: MAN, planDia: { dia: MAN, n: 1 } });
    expect(a.p2).toMatchObject({ cuando: null, planDia: null });
    expect(a.s1.cuando).toBeNull();
  });

  it("dice cómo quedan los bloques de ese día con lo preparado", () => {
    const b = bloquesPreparados(acciones, [trabajo], MAN, ["p1", "p2", "s1"]);
    expect(b.bloques[0]).toMatchObject({ ocupado: 60, cabe: 240 });
    expect(b.bloques[0].tareas.map((x) => x.id)).toEqual(["p1", "p2"]);
    expect(b.fuera.map((x) => x.id)).toEqual(["s1"]);
  });
});

describe("Hoy: la agenda en orden de hora y las tareas por bloque", () => {
  const D = "2026-11-17"; // martes
  const trabajo = { id: "tb", titulo: "Trabajo", sombrero: "trabajo", inicio: "08:00", fin: "12:00", repite: { regla: "FREQ=WEEKLY;BYDAY=TU", inicio: "2026-01-06" } };
  const dmc = { id: "dmc", titulo: "57DMC", sombrero: "artistico", inicio: "13:00", fin: "17:00", repite: { regla: "FREQ=WEEKLY;BYDAY=TU", inicio: "2026-01-06" } };
  const prov = { id: "pv", titulo: "Proverbios", clase: "recordatorio", inicio: "11:45", fin: "11:45", repite: { regla: "FREQ=WEEKLY;BYDAY=TU", inicio: "2026-01-06" } };
  const t = (datos) => ({ ...nuevaAccion({ lista: "siguientes", ...datos }, D), ...datos });

  it("la agenda: lo de todo el día aparte, lo demás en su hora, lo que pasó apagado y la raya de ahora en su sitio", async () => {
    const { agendaDelDia, indiceAhora } = await import("../src/lib/vistaHoy.js");
    const eventos = [
      { id: "e1", titulo: "Reunión con Dcasa", clase: "reunion", fecha: D, inicio: "10:00", fin: "11:00", sombrero: "trabajo" },
      { id: "e2", titulo: "Cita por definir", clase: "reunion", fecha: D, inicio: "00:00", fin: "23:59", horaPorDefinir: true },
    ];
    const acciones = [t({ id: "r1", titulo: "Llamar al banco", clase: "recordatorio", cuando: D, hora: "15:00" }), t({ id: "r2", titulo: "Llevar la tarjeta", clase: "recordatorio", cuando: D })];
    const a = agendaDelDia({ dia: D, hoy: D, hora: "11:30", ritmo: [trabajo, dmc, prov], eventos, acciones });
    expect(a.linea.map((x) => [x.inicio, x.tipo, x.titulo])).toEqual([
      ["08:00", "bloque", "Trabajo"],
      ["10:00", "reunion", "Reunión con Dcasa"],
      ["11:45", "fijo", "Proverbios"],
      ["13:00", "bloque", "57DMC"],
      ["15:00", "recordatorio", "Llamar al banco"],
    ]);
    expect(a.linea.filter((x) => x.pasado).map((x) => x.titulo)).toEqual(["Reunión con Dcasa"]);
    expect(a.sinHora.map((x) => x.titulo).sort()).toEqual(["Cita por definir", "Llevar la tarjeta"]);
    expect(indiceAhora(a.linea, { dia: D, hoy: D, hora: "11:30" })).toBe(2);
    expect(indiceAhora(a.linea, { dia: "2026-11-18", hoy: D, hora: "10:30" })).toBeNull();
  });

  it("las tareas: lo que quedó primero, luego cada bloque en su hora, lo suelto al final; sin lo que va en el centro", async () => {
    const { gruposDeTareas } = await import("../src/lib/vistaHoy.js");
    const tareas = [
      t({ id: "q", titulo: "Quedó", sombrero: "trabajo", cuando: "2026-11-16" }),
      t({ id: "a", titulo: "Propuesta", sombrero: "trabajo", cuando: D }),
      t({ id: "b", titulo: "Letra 57DMC", sombrero: "artistico", etiquetas: ["57dmc"], cuando: D }),
      t({ id: "c", titulo: "Pagar la luz", sombrero: "personal", cuando: D }),
      t({ id: "x", titulo: "Va en el centro", sombrero: "trabajo", cuando: D }),
    ];
    const g = gruposDeTareas(tareas, [trabajo, dmc], D, { hoy: D, fuera: new Set(["x"]) });
    expect(g.map((x) => [x.tipo, x.bloque?.id ?? null, x.tareas.map((a) => a.id)])).toEqual([
      ["decidir", null, ["q"]],
      ["bloque", "tb", ["a"]],
      ["bloque", "dmc", ["b"]],
      ["suelta", null, ["c"]],
    ]);
  });

  it("cuánto del bloque pasó y cuánto queda", async () => {
    const { avanceDelBloque } = await import("../src/lib/vistaHoy.js");
    expect(avanceDelBloque(trabajo, "09:00")).toEqual({ parte: 0.25, quedan: 180 });
    expect(avanceDelBloque(trabajo, "07:00")).toEqual({ parte: 0, quedan: 240 });
    expect(avanceDelBloque(trabajo, "13:00")).toEqual({ parte: 1, quedan: 0 });
  });
});
