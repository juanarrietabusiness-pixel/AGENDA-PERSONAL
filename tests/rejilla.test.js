import { describe, it, expect } from "vitest";
import { piezasDelDia, carriles, huecos, rangoDeLaRejilla } from "../src/lib/rejilla.js";

const p = (clave, inicio, fin, tipo = "evento") => ({ clave, inicio, fin, tipo });

describe("la semana con horas", () => {
  it("separa lo que tiene hora de lo del día; un evento sin fin dura media hora", () => {
    const r = piezasDelDia({
      bloques: [{ bloque: { id: "t", titulo: "TRABAJO ", inicio: "08:00", fin: "12:00", sombrero: "trabajo" }, tareas: [{ id: "a" }], recordatorios: [] }],
      recordatorios: [{ id: "prov", titulo: "Proverbios", inicio: "12:00" }],
      tareas: [{ id: "x", titulo: "Llamar", hora: "15:00", minutos: 15 }, { id: "y", titulo: "Pagar la luz" }],
      eventos: [{ id: "e1", titulo: "Oración", inicio: "06:00", fin: "07:00" }, { id: "e2", titulo: "Concierto", inicio: "00:00", fin: "23:59" }, { id: "e3", titulo: "Llamada", inicio: "18:00" }],
    });
    expect(r.conHora.map((x) => [x.titulo, x.inicio, x.fin])).toEqual([
      ["Oración", "06:00", "07:00"], ["TRABAJO", "08:00", "12:00"], ["Proverbios", "12:00", "12:15"], ["Llamar", "15:00", "15:15"], ["Llamada", "18:00", "18:30"],
    ]);
    // Arriba del día, los eventos antes que las tareas.
    expect(r.delDia.map((x) => x.titulo)).toEqual(["Concierto", "Pagar la luz"]);
  });

  it("lo que se cruza va lado a lado; lo que no, a lo ancho", () => {
    const c = carriles([p("a", "08:00", "12:00", "bloque"), p("b", "10:00", "11:00"), p("c", "10:30", "11:30"), p("d", "13:00", "14:00")]);
    expect(c.get("a")).toEqual({ carril: 0, de: 3 });
    expect(c.get("b")).toEqual({ carril: 1, de: 3 });
    expect(c.get("c")).toEqual({ carril: 2, de: 3 });
    expect(c.get("d")).toEqual({ carril: 0, de: 1 });
  });

  it("los huecos libres entre lo que ocupa (los recordatorios no ocupan), y desde ahora si es hoy", () => {
    const piezas = [p("o", "06:00", "07:00"), p("t", "08:00", "12:00", "bloque"), p("r", "12:00", "12:15", "recordatorio"), p("t2", "13:00", "17:00", "bloque")];
    expect(huecos(piezas, { desde: "06:00", hasta: "22:00" })).toEqual([
      { inicio: "07:00", fin: "08:00", minutos: 60 },
      { inicio: "12:00", fin: "13:00", minutos: 60 },
      { inicio: "17:00", fin: "22:00", minutos: 300 },
    ]);
    expect(huecos(piezas, { desde: "06:00", hasta: "22:00", ahora: "12:20" }).map((h) => h.inicio)).toEqual(["12:30", "17:00"]);
  });

  it("la rejilla va del despertar más temprano a lo último que termina", () => {
    const dias = [{ dia: "2026-11-09", conHora: [p("x", "05:30", "06:00")] }, { dia: "2026-11-10", conHora: [p("y", "21:30", "22:15")] }];
    expect(rangoDeLaRejilla(dias, {})).toEqual({ desde: 5, hasta: 23 });
  });
});
