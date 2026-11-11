import { describe, it, expect } from "vitest";
import { aplicarRitmo } from "../src/lib/ritmo.js";
import { semanaDelDia, moverSiempre, claseDeRitmo, avisa, horasPorSombrero, rutinaDeGoogle, claseParaTraer, diaEnBloques } from "../src/lib/semana.js";
import { piezasDelDia, semanasDelMes, aPaso, duracionCercana, huecos } from "../src/lib/rejilla.js";
import { tablero, pasaFiltro, soltarEnTablero, moverUnPuesto, enOrden } from "../src/lib/tablero.js";
import { nombreParecido, sombreroDeLista, sombrerosDe, REINO } from "../src/lib/sombreros.js";

const CON_REINO = [REINO, ...sombrerosDe({})];
import { listaParaSombrero } from "../worker/lib/google.js";
import { nuevaAccion } from "../src/lib/metodo.js";

// Lunes 9 de noviembre de 2026 … domingo 15.
const LUN = "2026-11-09";
const MAR = "2026-11-10";
const MIE = "2026-11-11";
const trabajo = { id: "trabajo", titulo: "Trabajo", clase: "bloque", sombrero: "trabajo", inicio: "08:00", fin: "12:00", repite: { regla: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", inicio: "2026-01-05" } };
const lectura = { id: "lectura", titulo: "Lectura bíblica", clase: "compromiso", sombrero: "reino", inicio: "07:00", fin: "08:00", repite: { regla: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", inicio: "2026-01-05" } };

describe("el compromiso fijo de la semana tipo", () => {
  it("es su propia clase, no avisa y cuenta sus horas en su sombrero", () => {
    expect(claseDeRitmo(lectura)).toBe("compromiso");
    expect(avisa(lectura)).toBe(false);
    expect(avisa(trabajo)).toBe(true);
    const horas = horasPorSombrero([trabajo, lectura], CON_REINO);
    expect(horas.find((h) => h.id === "reino").minutos).toBe(5 * 60);
    expect(horas.find((h) => h.id === "trabajo").minutos).toBe(5 * 4 * 60);
  });

  it("se crea con aplicarRitmo y sale aparte en el día", () => {
    const { ritmo } = aplicarRitmo([trabajo], { accion: "agregar", titulo: "Ejercicio", clase: "compromiso", dias: [1, 5], inicio: "20:00", fin: "21:30", avisar: false });
    const dia = semanaDelDia(ritmo, LUN);
    expect(dia.compromisos.map((e) => e.titulo)).toEqual(["Ejercicio"]);
    expect(dia.bloques.map((e) => e.titulo)).toEqual(["Trabajo"]);
    expect(diaEnBloques(ritmo, LUN).compromisos).toHaveLength(1);
  });
});

describe("cambiar sólo un día de lo que se repite", () => {
  it("mover la hora un día deja los demás como estaban", () => {
    const { ritmo, bloque } = aplicarRitmo([trabajo], { accion: "unDia", id: "trabajo", dia: LUN, inicio: "09:00", fin: "13:00" });
    expect(bloque.cambios[LUN]).toEqual({ inicio: "09:00", fin: "13:00" });
    expect(semanaDelDia(ritmo, LUN).bloques[0]).toMatchObject({ inicio: "09:00", fin: "13:00", unDia: true });
    expect(semanaDelDia(ritmo, MAR).bloques[0]).toMatchObject({ inicio: "08:00", fin: "12:00" });
    // La semana tipo no ve el cambio de un día.
    expect(semanaDelDia(ritmo, LUN, { tipo: true }).bloques[0].inicio).toBe("08:00");
  });

  it("moverlo a otro día lo quita del suyo y lo pone una vez en el otro", () => {
    const sab = "2026-11-14";
    const { ritmo } = aplicarRitmo([trabajo], { accion: "unDia", id: "trabajo", dia: MIE, nuevoDia: sab, inicio: "10:00", fin: "14:00" });
    expect(semanaDelDia(ritmo, MIE).bloques).toHaveLength(0);
    expect(semanaDelDia(ritmo, sab).bloques[0]).toMatchObject({ inicio: "10:00", fin: "14:00" });
    expect(semanaDelDia(ritmo, "2026-11-21").bloques).toHaveLength(0);
    // Quitar esa vez extra la borra, no deja una marca de «quitado».
    const otra = aplicarRitmo(ritmo, { accion: "unDia", id: "trabajo", dia: sab, quitar: true });
    expect(otra.bloque.cambios[sab]).toBeUndefined();
  });

  it("quitar sólo un día y olvidar lo de hace más de un mes", () => {
    const { ritmo } = aplicarRitmo([trabajo], { accion: "unDia", id: "trabajo", dia: "2026-09-01", quitar: true });
    const { bloque } = aplicarRitmo(ritmo, { accion: "unDia", id: "trabajo", dia: MAR, quitar: true, hoy: MIE });
    expect(bloque.cambios).toEqual({ [MAR]: { quitado: true } });
  });

  it("rechaza horas al revés y fechas que no son fechas", () => {
    expect(() => aplicarRitmo([trabajo], { accion: "unDia", id: "trabajo", dia: LUN, inicio: "12:00", fin: "09:00" })).toThrow(/después/);
    expect(() => aplicarRitmo([trabajo], { accion: "unDia", id: "trabajo", dia: "lunes" })).toThrow(/fecha/);
  });

  it("mover para siempre cambia la hora y, si cambió de día, ese día de la semana", () => {
    expect(moverSiempre(trabajo, { desde: LUN, a: LUN, inicio: "09:00", fin: "13:00" })).toEqual({ accion: "cambiar", id: "trabajo", inicio: "09:00", fin: "13:00" });
    const c = moverSiempre(lectura, { desde: LUN, a: "2026-11-14", inicio: "07:00", fin: "08:00" });
    expect(c.dias.sort()).toEqual([2, 3, 4, 5, 6]);
    const { bloque } = aplicarRitmo([lectura], c);
    expect(bloque.repite.regla).toBe("FREQ=WEEKLY;BYDAY=TU,WE,TH,FR,SA");
  });
});

describe("pasar la rutina de Google a Kairos", () => {
  const ext = (id, titulo, inicio, fin, dia, extra = {}) => ({ id: `${id}_${dia}`, serie: id, tipo: "evento", titulo, inicio, fin, dia, ...extra });
  const externos = [
    ext("s1", "Lectura Bíblica", "07:00", "08:00", LUN),
    ext("s1", "Lectura Bíblica", "07:00", "08:00", MAR),
    ext("s2", "TRABAJO", "08:00", "12:00", LUN),
    ext("s3", "Mentoría con Pedro", "18:00", "19:00", MIE, { conGente: true }),
    ext("s4", "HOGAR - TASK", "18:00", "19:00", "2026-11-13"),
  ];

  it("trae todo lo que se repite y es sólo tuyo; lo que es con otras personas se queda en Google", () => {
    const { nuevos } = rutinaDeGoogle(externos, [], { ajustes: {}, todas: true });
    expect(nuevos.map((n) => n.titulo).sort()).toEqual(["HOGAR - TASK", "Lectura Bíblica", "TRABAJO"]);
    expect(nuevos.find((n) => n.titulo === "Lectura Bíblica")).toMatchObject({ clase: "compromiso", repite: { regla: "FREQ=WEEKLY;BYDAY=MO,TU" } });
    expect(nuevos.find((n) => n.titulo === "TRABAJO").clase).toBe("bloque");
    expect(nuevos.find((n) => n.titulo === "HOGAR - TASK").clase).toBe("bloque");
  });

  it("es bloque lo que lleva tareas; lo demás, compromiso", () => {
    expect(claseParaTraer("57DMC", null)).toBe("bloque");
    expect(claseParaTraer("Matrimonio", "personal")).toBe("compromiso");
    expect(claseParaTraer("Reunión semanal", "trabajo")).toBe("bloque");
  });
});

describe("la semana con horas: piezas, pasos y el mes", () => {
  it("un compromiso fijo ocupa su tiempo (no deja hueco)", () => {
    const { conHora } = piezasDelDia({ compromisos: [lectura] });
    expect(conHora[0]).toMatchObject({ tipo: "compromiso", inicio: "07:00", fin: "08:00" });
    expect(huecos(conHora, { desde: "06:00", hasta: "09:00" })).toEqual([
      { inicio: "06:00", fin: "07:00", minutos: 60 },
      { inicio: "08:00", fin: "09:00", minutos: 60 },
    ]);
  });

  it("redondea a cuartos de hora y a una duración que se estima", () => {
    expect(aPaso(7 * 60 + 8)).toBe("07:15");
    expect(aPaso(7 * 60 + 7)).toBe("07:00");
    expect(duracionCercana(50)).toBe(60);
    expect(duracionCercana(20)).toBe(15);
  });

  it("el mes va de su primer lunes al domingo de su última semana", () => {
    const s = semanasDelMes("2026-11-01");
    expect(s[0][0]).toBe("2026-10-26");
    expect(s.at(-1)[6]).toBe("2026-12-06");
    expect(s).toHaveLength(6);
    expect(semanasDelMes("2027-02-01")).toHaveLength(4);
  });
});

describe("Tareas: el panorama completo", () => {
  const sombreros = sombrerosDe({});
  const a = (datos) => nuevaAccion({ lista: "siguientes", ...datos }, MIE);
  const acciones = [
    a({ id: "t1", titulo: "Propuesta Dcasa", sombrero: "trabajo", cliente: "Dcasa", limite: "2026-11-10" }),
    a({ id: "t2", titulo: "Llamar a Rofer", sombrero: "trabajo", cliente: "Rofer" }),
    a({ id: "t3", titulo: "Pagar la luz", sombrero: "personal", cuando: MIE }),
    a({ id: "t4", titulo: "Aprender Ableton", sombrero: "artistico", lista: "algun-dia" }),
    a({ id: "t5", titulo: "Letra del verso", sombrero: "artistico", proyectoId: "p1" }),
    a({ id: "t6", titulo: "Sin sombrero", sombrero: null }),
    { ...a({ id: "t7", titulo: "Hecha", sombrero: "personal" }), estado: "hecha", hechaEl: MAR },
  ];
  const proyectos = [{ id: "p1", nombre: "Sencillo nuevo", sombrero: "artistico", estado: "activo" }, { id: "p2", nombre: "Retiro", sombrero: "iglesia", estado: "activo" }];

  it("una columna por sombrero, más «Sin sombrero» si hace falta, con empresas y proyectos", () => {
    const cols = tablero(acciones, { sombreros, proyectos, hoy: MIE });
    expect(cols.at(-1)).toMatchObject({ id: null, nombre: "Sin sombrero", total: 1 });
    const t = cols.find((c) => c.id === "trabajo");
    expect(t.grupos.map((g) => g.titulo)).toEqual([null, "Dcasa", "Rofer"]);
    const art = cols.find((c) => c.id === "artistico");
    expect(art.grupos.find((g) => g.tipo === "proyecto").tareas.map((x) => x.id)).toEqual(["t5"]);
    // Un proyecto sin nada abierto sale igual en «Todo»: le falta el siguiente paso.
    expect(cols.find((c) => c.id === "iglesia").grupos.find((g) => g.tipo === "proyecto")).toMatchObject({ titulo: "Retiro", tareas: [] });
    expect(cols.find((c) => c.id === "personal").hechas.map((x) => x.id)).toEqual(["t7"]);
  });

  it("los filtros", () => {
    const f = (filtro) => acciones.filter((x) => x.estado === "abierta" && pasaFiltro(x, filtro, MIE)).map((x) => x.id);
    expect(f("hoy")).toEqual(["t1", "t3"]);
    expect(f("vencidas")).toEqual(["t1"]);
    expect(f("algun")).toEqual(["t4"]);
    expect(f("sinFecha")).toEqual(["t2", "t5", "t6"]);
  });

  it("soltar en otra columna cambia el sombrero; en un proyecto, el proyecto; y el orden queda puesto", () => {
    const cols = tablero(acciones, { sombreros, proyectos, hoy: MIE });
    const art = cols.find((c) => c.id === "artistico");
    const proyecto = art.grupos.find((g) => g.tipo === "proyecto");
    const r = soltarEnTablero(acciones, { id: "t3", columna: art, grupo: proyecto, antesDe: "t5", proyectos });
    const t3 = r.find((x) => x.id === "t3");
    expect(t3).toMatchObject({ sombrero: "artistico", proyectoId: "p1", orden: 10 });
    expect(r.find((x) => x.id === "t5").orden).toBe(20);
    // A las sueltas de otra columna: sale del proyecto (es de otro sombrero).
    const igl = cols.find((c) => c.id === "iglesia");
    const r2 = soltarEnTablero(r, { id: "t5", columna: igl, grupo: igl.grupos[0], proyectos });
    expect(r2.find((x) => x.id === "t5")).toMatchObject({ sombrero: "iglesia", proyectoId: null });
  });

  it("lo que aún no ordenaste va arriba; Alt + flecha sube o baja un puesto", () => {
    const lista = [{ ...acciones[0], orden: 10 }, { ...acciones[1] }];
    expect(enOrden(lista, { hoy: MIE, proyectos, sombreros }).map((x) => x.id)).toEqual(["t2", "t1"]);
    const grupo = { tareas: [lista[1], lista[0]] };
    const r = moverUnPuesto(lista, grupo, "t1", -1);
    expect(r.find((x) => x.id === "t1").orden).toBeLessThan(r.find((x) => x.id === "t2").orden);
  });
});

describe("Google Tasks: cada lista con su sombrero", () => {
  const sombreros = CON_REINO;
  it("por el nombre, sin artículos ni plurales", () => {
    expect(nombreParecido("EL REINO")).toBe("reino");
    expect(nombreParecido("PERSONALES")).toBe("personal");
    expect(sombreroDeLista({ id: "l1", nombre: "EL REINO" }, sombreros)).toBe("reino");
    expect(sombreroDeLista({ id: "l2", nombre: "PERSONALES" }, sombreros)).toBe("personal");
    expect(sombreroDeLista({ id: "l3", nombre: "57DMC" }, sombreros)).toBeNull();
  });

  it("lo que escogió Juan manda; «no» deja la lista fuera", () => {
    const enlaces = { l3: "trabajo", l2: "no" };
    expect(sombreroDeLista({ id: "l3", nombre: "57DMC" }, sombreros, enlaces)).toBe("trabajo");
    expect(sombreroDeLista({ id: "l2", nombre: "PERSONALES" }, sombreros, enlaces)).toBeNull();
    const listas = [{ id: "l1", nombre: "TRABAJO" }, { id: "l3", nombre: "57DMC" }];
    expect(listaParaSombrero(listas, "trabajo", sombreros, enlaces)).toBe("l3");
    expect(listaParaSombrero(listas, "trabajo", sombreros, {})).toBe("l1");
    expect(listaParaSombrero(listas, "iglesia", sombreros, enlaces)).toBe("@default");
  });
});

describe("el mes chico del menú", () => {
  it("marca lo especial y las reuniones que no se repiten; lo de cada semana no", async () => {
    const { marcasDeDias } = await import("../src/lib/agenda.js");
    const estado = {
      acciones: [nuevaAccion({ titulo: "Cumpleaños de Abry", clase: "recordatorio", limite: "2026-11-20", repite: { regla: "FREQ=YEARLY", modo: "calendario", inicio: "2026-11-20" } }, MIE)],
      eventos: [
        { id: "r1", titulo: "Reunión con Dayano", clase: "reunion", fecha: "2026-11-24", inicio: "18:30", fin: "19:30" },
        { id: "r2", titulo: "Ensayo", clase: "reunion", fecha: null, repite: { regla: "FREQ=WEEKLY;BYDAY=TU", inicio: "2026-11-03" }, inicio: "19:00", fin: "21:00" },
      ],
      externos: [
        { id: "g1", tipo: "evento", dia: "2026-11-27", titulo: "Viaje", todoElDia: true },
        { id: "g2_1", serie: "g2", tipo: "evento", dia: "2026-11-25", titulo: "Equipo semanal", inicio: "10:00", fin: "11:00", conGente: true },
      ],
    };
    const m = marcasDeDias(estado, "2026-10-26", "2026-12-06");
    expect(Object.keys(m).sort()).toEqual(["2026-11-20", "2026-11-24", "2026-11-27"]);
    expect(m["2026-11-24"][0]).toMatchObject({ tipo: "reunion", titulo: "Reunión con Dayano" });
  });
});
