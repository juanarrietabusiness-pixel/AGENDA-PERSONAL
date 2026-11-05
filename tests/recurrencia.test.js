import { describe, it, expect } from "vitest";
import { leerRegla, escribirRegla, ocurrencias, siguiente, siguienteDespuesDeHecha, describir, tocaEl, ErrorRegla } from "../src/lib/recurrencia.js";

describe("reglas de repetición (RFC 5545)", () => {
  it("la célula de los jueves", () => {
    expect(ocurrencias("FREQ=WEEKLY;BYDAY=TH", "2026-01-08", "2026-11-01", "2026-11-30")).toEqual([
      "2026-11-05", "2026-11-12", "2026-11-19", "2026-11-26",
    ]);
    expect(describir("FREQ=WEEKLY;BYDAY=TH")).toBe("Cada jueves");
  });

  it("varios días de la semana, en orden", () => {
    expect(ocurrencias("FREQ=WEEKLY;BYDAY=TH,MO", "2026-11-02", "2026-11-02", "2026-11-12")).toEqual([
      "2026-11-02", "2026-11-05", "2026-11-09", "2026-11-12",
    ]);
    expect(describir("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR")).toBe("De lunes a viernes");
    expect(describir("FREQ=WEEKLY;BYDAY=TH,MO")).toBe("Cada lunes y jueves");
  });

  it("cada quince días cuenta desde la primera semana", () => {
    expect(ocurrencias("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", "2026-11-02", "2026-11-01", "2026-12-01")).toEqual([
      "2026-11-02", "2026-11-16", "2026-11-30",
    ]);
    expect(describir("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO")).toBe("Cada dos semanas, el lunes");
  });

  it("el último viernes y el segundo martes de cada mes", () => {
    expect(ocurrencias("FREQ=MONTHLY;BYDAY=-1FR", "2026-01-01", "2026-11-01", "2027-01-31")).toEqual([
      "2026-11-27", "2026-12-25", "2027-01-29",
    ]);
    expect(ocurrencias("FREQ=MONTHLY;BYDAY=2TU", "2026-01-01", "2026-11-01", "2026-12-31")).toEqual(["2026-11-10", "2026-12-08"]);
    expect(describir("FREQ=MONTHLY;BYDAY=-1FR")).toBe("Cada mes, el último viernes");
  });

  it("un día del mes que no existe se salta, como en Google Calendar", () => {
    expect(ocurrencias("FREQ=MONTHLY", "2027-01-31", "2027-01-01", "2027-05-31")).toEqual(["2027-01-31", "2027-03-31", "2027-05-31"]);
    expect(ocurrencias("FREQ=MONTHLY;BYMONTHDAY=-1", "2027-01-01", "2027-01-01", "2027-03-31")).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
  });

  it("un cumpleaños cada año", () => {
    expect(ocurrencias("FREQ=YEARLY", "2025-03-12", "2026-01-01", "2028-12-31")).toEqual(["2026-03-12", "2027-03-12", "2028-03-12"]);
    expect(describir("FREQ=YEARLY", "2025-03-12")).toBe("Cada año, el 12 de marzo");
  });

  it("COUNT cuenta desde la primera vez y UNTIL corta", () => {
    expect(ocurrencias("FREQ=WEEKLY;BYDAY=TH;COUNT=3", "2026-11-05", "2026-11-12", "2027-01-01")).toEqual(["2026-11-12", "2026-11-19"]);
    expect(ocurrencias("FREQ=DAILY;UNTIL=20261106", "2026-11-04", "2026-11-01", "2026-12-01")).toEqual(["2026-11-04", "2026-11-05", "2026-11-06"]);
  });

  it("la siguiente, y la de «después de hacerla»", () => {
    expect(siguiente("FREQ=WEEKLY;BYDAY=MO", "2026-01-05", "2026-11-02")).toBe("2026-11-09");
    expect(siguiente("FREQ=WEEKLY;BYDAY=MO;COUNT=1", "2026-11-02", "2026-11-02")).toBeNull();
    expect(siguienteDespuesDeHecha("FREQ=MONTHLY;INTERVAL=3", "2026-11-20")).toBe("2027-02-20");
    expect(tocaEl("FREQ=WEEKLY;BYDAY=WE", "2026-01-07", "2026-11-04")).toBe(true);
    expect(tocaEl("FREQ=WEEKLY;BYDAY=WE", "2026-01-07", "2026-11-05")).toBe(false);
  });

  it("lee y escribe lo mismo, y rechaza lo que no entiende", () => {
    const texto = "FREQ=MONTHLY;INTERVAL=2;BYDAY=-1FR;COUNT=4";
    expect(escribirRegla(leerRegla(texto))).toBe(texto);
    expect(() => leerRegla("FREQ=HOURLY")).toThrow(ErrorRegla);
    expect(() => leerRegla("FREQ=WEEKLY;BYDAY=2TU")).toThrow(ErrorRegla);
    expect(() => leerRegla("FREQ=WEEKLY;BYSETPOS=1")).toThrow(/BYSETPOS/);
  });
});
