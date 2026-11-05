import { describe, it, expect } from "vitest";
import { aclarar, listaDeDestino, nuevaAccion, completar, posponer, pideDecision, proyectosSinSiguiente, esperasPorPreguntar, pareceAccion } from "../src/lib/metodo.js";
import { cuadrante, urgencia, pasoAUrgente, ordenar } from "../src/lib/prioridad.js";

const HOY = "2026-11-04";

describe("aclarar (el árbol de GTD)", () => {
  it("lo que no se hace va a referencia, algún día o a la basura", () => {
    expect(aclarar({ accionable: false, noAccionable: "algun-dia" })).toEqual({ destino: "algun-dia", proyecto: false });
    expect(aclarar({ accionable: false })).toEqual({ destino: "referencia", proyecto: false });
  });
  it("menos de dos minutos: se hace ya", () => {
    expect(aclarar({ accionable: true, variosPasos: false, minutos: 2 }).destino).toBe("hazla-ya");
  });
  it("si no te toca, queda en espera; si tiene día fijo, al calendario", () => {
    expect(aclarar({ accionable: true, minutos: 30, laHagoYo: false }).destino).toBe("espera");
    expect(aclarar({ accionable: true, minutos: 30, laHagoYo: true, fechaFija: true }).destino).toBe("calendario");
    expect(aclarar({ accionable: true, variosPasos: true, minutos: 30, laHagoYo: true, fechaFija: false })).toEqual({ destino: "siguientes", proyecto: true });
    expect(listaDeDestino("espera")).toBe("espera");
    expect(listaDeDestino("calendario")).toBe("siguientes");
  });
  it("una acción empieza con un verbo", () => {
    expect(pareceAccion("Llamar a Adolfo")).toBe(true);
    expect(pareceAccion("Adolfo")).toBe(false);
  });
});

describe("hacer, posponer, repetir", () => {
  it("una tarea que se repite por calendario crea la siguiente en su fecha", () => {
    const a = nuevaAccion({ titulo: "Preparar el tema de la célula", lista: "siguientes", cuando: "2026-11-02", repite: { regla: "FREQ=WEEKLY;BYDAY=MO", modo: "calendario" } }, HOY);
    const { hecha, siguiente } = completar(a, HOY);
    expect(hecha.estado).toBe("hecha");
    expect(siguiente.cuando).toBe("2026-11-09");
    expect(siguiente.estado).toBe("abierta");
    expect(siguiente.id).not.toBe(a.id);
  });
  it("«después de hacerla» cuenta desde el día en que se hizo, y la fecha límite se corre con ella", () => {
    const a = nuevaAccion({ titulo: "Cambiar el filtro del agua", lista: "siguientes", cuando: "2026-11-01", limite: "2026-11-03", repite: { regla: "FREQ=MONTHLY;INTERVAL=3", modo: "despues" } }, HOY);
    const { siguiente } = completar(a, "2026-11-10");
    expect(siguiente.cuando).toBe("2027-02-10");
    expect(siguiente.limite).toBe("2027-02-12");
  });
  it("a la tercera vez que se pospone, pide decidir", () => {
    let a = nuevaAccion({ titulo: "Ordenar el estudio", lista: "siguientes", cuando: HOY });
    for (let i = 0; i < 3; i++) a = posponer(a, "2026-11-05");
    expect(pideDecision(a)).toBe(true);
  });
  it("un proyecto sin siguiente acción sale en la revisión; lo que espera de alguien, el día de preguntar", () => {
    const proyectos = [{ id: "p1", tipo: "proyecto", nombre: "Retiro" }, { id: "p2", tipo: "responsabilidad", nombre: "Célula" }];
    const acciones = [nuevaAccion({ titulo: "Pedir el presupuesto", lista: "espera", espera: { persona: "Pastor", preguntar: HOY } })];
    expect(proyectosSinSiguiente(proyectos, acciones).map((p) => p.id)).toEqual(["p1"]);
    expect(esperasPorPreguntar(acciones, HOY)).toHaveLength(1);
  });
});

describe("importante y urgente", () => {
  const a = (datos) => nuevaAccion({ lista: "siguientes", ...datos });
  it("urgente sólo lo dice la fecha límite real", () => {
    expect(urgencia(a({ limite: "2026-11-03" }), HOY)).toBe("vencida");
    expect(urgencia(a({ limite: HOY }), HOY)).toBe("hoy");
    expect(urgencia(a({ limite: "2026-11-07" }), HOY)).toBe("pronto");
    expect(urgencia(a({ cuando: "2026-11-01" }), HOY)).toBeNull();
  });
  it("los cuatro cuadrantes", () => {
    expect(cuadrante(a({ importante: true, limite: HOY }), HOY)).toBe(1);
    expect(cuadrante(a({ importante: true }), HOY)).toBe(2);
    expect(cuadrante(a({ limite: "2026-11-05" }), HOY)).toBe(3);
    expect(cuadrante(a({}), HOY)).toBe(4);
  });
  it("«pasó a urgente» sale una sola vez, el día que cruza, y sólo si es importante", () => {
    const x = a({ importante: true, limite: "2026-11-05" });
    expect(pasoAUrgente(x, "2026-11-03", HOY)).toBe(true);
    expect(pasoAUrgente(x, HOY, "2026-11-05")).toBe(false);
    expect(pasoAUrgente({ ...x, importante: false }, "2026-11-03", HOY)).toBe(false);
  });
  it("ordena: lo escogido para hoy, luego por cuadrante y fecha límite", () => {
    const lista = [a({ id: "c4" }), a({ id: "c2", importante: true }), a({ id: "c1", importante: true, limite: HOY }), a({ id: "foco", enfoque: HOY })];
    expect(ordenar(lista, HOY).map((x) => x.id)).toEqual(["foco", "c1", "c2", "c4"]);
  });
});
