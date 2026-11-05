import { describe, it, expect } from "vitest";
import { hoyEn, horaEn, sumarDias, diasEntre, diaSemana, lunesDe, sumarMeses, textoFecha, textoHora, textoCorto, fecha } from "../src/lib/fechas.js";

describe("fechas", () => {
  it("«hoy» es el de Panamá aunque en UTC ya sea mañana", () => {
    // 4 nov 2026, 20:30 en Panamá = 5 nov 01:30 UTC.
    const momento = new Date("2026-11-05T01:30:00Z");
    expect(hoyEn("America/Panama", momento)).toBe("2026-11-04");
    expect(horaEn("America/Panama", momento)).toBe("20:30");
  });

  it("suma días, meses y cuenta sin correrse", () => {
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(diasEntre("2026-11-04", "2026-11-12")).toBe(8);
    expect(sumarMeses("2027-01-31", 1)).toBe("2027-02-28");
    expect(sumarMeses("2028-01-31", 1)).toBe("2028-02-29");
    expect(fecha(2026, 4, 31)).toBeNull();
  });

  it("los días de la semana y el lunes", () => {
    expect(diaSemana("2026-11-04")).toBe(3); // miércoles
    expect(lunesDe("2026-11-04")).toBe("2026-11-02");
    expect(lunesDe("2026-11-08")).toBe("2026-11-02"); // el domingo es el final de la semana
  });

  it("dice las fechas y horas como se hablan", () => {
    expect(textoFecha("2026-11-04", "2026-11-04")).toBe("hoy");
    expect(textoFecha("2026-11-05", "2026-11-04")).toBe("mañana");
    expect(textoFecha("2026-11-07", "2026-11-04")).toBe("el sábado");
    expect(textoCorto("2027-10-03", "2026-11-04")).toBe("dom 3 oct 2027");
    expect(textoHora("19:00")).toBe("7:00 p. m.");
    expect(textoHora("00:15")).toBe("12:15 a. m.");
  });
});
