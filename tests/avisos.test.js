import { describe, it, expect } from "vitest";
import { planDeAvisos, ubicar, avisosDelDia, horaDelCierre, preguntasDeHoy, preguntada, atascada } from "../src/lib/avisos.js";
import { nuevaAccion } from "../src/lib/metodo.js";
import { RITMO_BASE } from "../src/lib/ritmo.js";
import { AJUSTES_BASE } from "../src/lib/ajustes.js";

const HOY = "2026-11-04";
const ctx = { ajustes: AJUSTES_BASE, eventos: RITMO_BASE };

describe("la escalera de avisos", () => {
  it("importante con fecha límite: empezar (si es proyecto), 2 días antes, el día y una hora antes", () => {
    const a = nuevaAccion({ id: "pres", titulo: "Presentación", lista: "siguientes", importante: true, limite: "2026-11-20", hora: "19:00" });
    const avisos = planDeAvisos(a, { hoy: HOY, ajustes: AJUSTES_BASE, esProyecto: true });
    expect(avisos.map((x) => `${x.clase}@${x.dia} ${x.hora}`)).toEqual([
      "empezar@2026-11-13 06:15",
      "se-acerca@2026-11-18 07:30",
      "vence-hoy@2026-11-20 06:15",
      "en-una-hora@2026-11-20 18:00",
    ]);
  });
  it("sin importancia: sólo el día antes; algún día y la bandeja no avisan", () => {
    const a = nuevaAccion({ titulo: "Renovar dominio", lista: "siguientes", limite: "2026-11-10" });
    expect(planDeAvisos(a, { hoy: HOY, ajustes: AJUSTES_BASE }).map((x) => x.clase)).toEqual(["se-acerca"]);
    expect(planDeAvisos({ ...a, lista: "algun-dia" }, { hoy: HOY, ajustes: AJUSTES_BASE })).toEqual([]);
  });
  it("lo que espera de alguien avisa el día de preguntar", () => {
    const a = nuevaAccion({ titulo: "Presupuesto del sonido", lista: "espera", espera: { persona: "Carlos", preguntar: "2026-11-06" } });
    expect(planDeAvisos(a, { hoy: HOY, ajustes: AJUSTES_BASE })[0]).toMatchObject({ clase: "espera", dia: "2026-11-06" });
  });
});

describe("cuándo NO se avisa", () => {
  it("nada interrumpe la célula: sale al terminar", () => {
    const u = ubicar({ id: "x", dia: "2026-11-05", hora: "20:30" }, ctx);
    expect(u.hora).toBe("21:30");
    expect(u.movido).toBe(true);
  });
  it("lo que cae antes del resumen va dentro del resumen", () => {
    const u = ubicar({ id: "x", dia: "2026-11-05", hora: "05:30" }, ctx);
    expect(u).toMatchObject({ alResumen: true, hora: "06:15" });
  });
  it("lo que se cae al silencio pasa al resumen de mañana", () => {
    const u = ubicar({ id: "x", dia: "2026-11-04", hora: "22:15" }, ctx);
    expect(u).toMatchObject({ alResumen: true, dia: "2026-11-05", hora: "06:15" });
  });
  it("el cierre del miércoles sale al terminar el servicio, no durante", () => {
    expect(horaDelCierre("2026-11-04", ctx)).toBe("21:30");
    expect(horaDelCierre("2026-11-06", ctx)).toBe("21:00");
  });
  it("los avisos cercanos se juntan y nunca pasan del tope", () => {
    // Doce avisos de 9:00 a 20:00 un sábado (sin nada protegido a esas horas), más uno a cinco minutos del primero.
    const avisos = Array.from({ length: 12 }, (_, i) => ({ id: `a${i}`, dia: "2026-11-07", hora: `${String(9 + i).padStart(2, "0")}:00` }));
    avisos.push({ id: "cerca", dia: "2026-11-07", hora: "09:05" });
    const { mensajes } = avisosDelDia(avisos, { dia: "2026-11-07", ...ctx });
    expect(mensajes.length).toBeLessThanOrEqual(AJUSTES_BASE.avisos.tope);
    expect(mensajes[0].avisos.map((a) => a.id)).toContain("cerca");
    expect(mensajes.flatMap((m) => m.avisos)).toHaveLength(13);
  });
});

describe("«¿la completaste?»", () => {
  it("pregunta una vez al día y como mucho tres veces", () => {
    let a = nuevaAccion({ id: "v", titulo: "Pagar la luz", lista: "siguientes", limite: "2026-11-03" });
    expect(preguntasDeHoy([a], HOY)).toEqual([{ accionId: "v", intento: 1, vencida: true }]);
    a = preguntada(a, HOY);
    expect(preguntasDeHoy([a], HOY)).toEqual([]);
    a = preguntada(preguntada(a, "2026-11-05"), "2026-11-06");
    expect(atascada(a)).toBe(true);
    expect(preguntasDeHoy([a], "2026-11-07")).toEqual([]);
  });
});
