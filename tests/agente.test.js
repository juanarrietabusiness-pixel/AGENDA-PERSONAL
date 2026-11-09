import { describe, it, expect } from "vitest";
import { sacarJSON, leerOrden, aplicarOrden, deshacerOrden, tarjeta, diasNombrados } from "../src/lib/agente.js";
import { aplicarAjuste, AJUSTES_BASE, ErrorAjuste, horariosParaLaIA } from "../src/lib/ajustes.js";
import { aplicarRitmo, RITMO_BASE, ErrorRitmo } from "../src/lib/ritmo.js";
import { instruccionesParaOrdenar } from "../src/lib/personalidad.js";

const HOY = "2026-11-04"; // miércoles
const estado0 = () => ({ acciones: [], eventos: [], proyectos: [], personas: [], ajustes: structuredClone(AJUSTES_BASE), ritmo: structuredClone(RITMO_BASE) });

describe("leer lo que dice el asistente", () => {
  it("saca el JSON aunque venga entre ```json o con texto", () => {
    expect(sacarJSON('Aquí va:\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(sacarJSON("no hay nada")).toBeNull();
  });

  it("una reunión con día y hora es un evento; aprende a la persona", () => {
    const texto = "Agenda una reunión con mi hermano Adolfo de la iglesia el sábado a las 10";
    const o = leerOrden({
      elementos: [{ tipo: "evento", titulo: "Reunión con Adolfo", sombrero: "iglesia", cuando: "2026-11-07", hora: "10:00", minutos: 60, personas: ["Adolfo"] }],
      personas_nuevas: [{ nombre: "Adolfo", relacion: "hermano de la iglesia", sombrero: "iglesia" }],
      respuesta: "Listo",
    }, { hoy: HOY, texto });
    expect(o.eventos).toHaveLength(1);
    expect(o.eventos[0]).toMatchObject({ fecha: "2026-11-07", inicio: "10:00", fin: "11:00", sombrero: "iglesia" });
    expect(o.personas).toEqual([{ nombre: "Adolfo", relacion: "hermano de la iglesia", sombrero: "iglesia" }]);
  });

  it("si el modelo se equivoca de día de la semana, se corrige y se dice", () => {
    const o = leerOrden({ elementos: [{ tipo: "evento", titulo: "Reunión con Adolfo", sombrero: "iglesia", cuando: "2026-11-06", hora: "19:00" }] },
      { hoy: HOY, texto: "reunión con Adolfo el jueves a las 7 de la noche" });
    expect(o.eventos[0].fecha).toBe("2026-11-05");
    expect(o.avisos[0]).toMatch(/jueves/);
    expect(diasNombrados("el lunes y el jueves")).toEqual([1, 4]);
  });

  it("con dos días nombrados no corrige nada (sería adivinar)", () => {
    const o = leerOrden({ elementos: [{ tipo: "accion", titulo: "Comprar pan", sombrero: "personal", cuando: "2026-11-07" }] },
      { hoy: HOY, texto: "reunión el jueves y comprar pan el sábado" });
    expect(o.acciones[0].cuando).toBe("2026-11-07");
    expect(o.avisos).toEqual([]);
  });

  it("una fecha que ya pasó no se guarda: se pregunta", () => {
    const o = leerOrden({ elementos: [{ tipo: "accion", titulo: "Presentación", sombrero: "artistico", limite: "2026-10-03" }] }, { hoy: HOY, texto: "tengo una presentación el 3 de octubre" });
    expect(o.acciones[0].limite).toBeNull();
    expect(o.pregunta).toMatch(/ya pasó/);
  });

  it("un proyecto con subtareas crea el proyecto y sus pasos", () => {
    const o = leerOrden({
      elementos: [{ tipo: "accion", titulo: "Presentación de liderazgo", sombrero: "iglesia", limite: "2026-12-03", importante: true,
        subtareas: [{ titulo: "Definir el mensaje", cuando: "2026-11-15" }, { titulo: "Ensayar", cuando: "2026-12-01" }] }],
    }, { hoy: HOY });
    expect(o.proyectos).toHaveLength(1);
    expect(o.proyectos[0]).toMatchObject({ nombre: "Presentación de liderazgo", tipo: "proyecto", limite: "2026-12-03" });
    expect(o.acciones.map((a) => a.titulo)).toEqual(["Definir el mensaje", "Ensayar"]);
    expect(o.acciones.every((a) => a.proyectoId === o.proyectos[0].id)).toBe(true);
  });

  it("idea, recordatorio, espera y fecha especial van a su sitio", () => {
    const o = leerOrden({
      elementos: [
        { tipo: "idea", titulo: "Retiro de jóvenes en enero", sombrero: "iglesia", cuando: "2026-11-20" },
        { tipo: "recordatorio", titulo: "Comprar el perfume para mi esposa", sombrero: "personal", limite: "2026-11-06" },
        { tipo: "accion", titulo: "Presupuesto del sonido", sombrero: "artistico", espera_de: "Carlos" },
        { tipo: "fecha-especial", titulo: "Cumpleaños de mamá", sombrero: "personal", cuando: "2027-03-12" },
        { tipo: "inventado", titulo: "x" },
      ],
    }, { hoy: HOY });
    expect(o.acciones.map((a) => a.lista)).toEqual(["algun-dia", "siguientes", "espera", "siguientes"]);
    expect(o.acciones[2].espera.persona).toBe("Carlos");
    expect(o.acciones[3]).toMatchObject({ limite: "2027-03-12", repite: { regla: "FREQ=YEARLY" } });
    expect(o.avisos[0]).toMatch(/inventado/);
  });

  it("lo ilegible no rompe nada", () => {
    expect(leerOrden("lo siento, no puedo", { hoy: HOY }).ok).toBe(false);
  });
});

describe("los horarios y la semana, hablándole al asistente", () => {
  it("«madrugo a las 5 los lunes, martes, jueves y viernes»", () => {
    const a = aplicarAjuste(AJUSTES_BASE, { clave: "despierta", valor: "05:00", dias: [1, 2, 4, 5] });
    expect(a.dias[1].despierta).toBe("05:00");
    expect(a.dias[3].despierta).toBe("06:00");
    expect(a.porConfirmar.some((p) => p.clave === "despierta")).toBe(false);
    expect(AJUSTES_BASE.dias[1].despierta).toBe("04:45");
  });
  it("rechaza lo que no cuadra", () => {
    expect(() => aplicarAjuste(AJUSTES_BASE, { clave: "despierta", valor: "5am" })).toThrow(ErrorAjuste);
    expect(() => aplicarAjuste(AJUSTES_BASE, { clave: "inventada", valor: "x" })).toThrow(/No conozco/);
    expect(() => aplicarAjuste(AJUSTES_BASE, { clave: "jornada_hasta", valor: "08:00" })).toThrow(/antes de terminar/);
  });
  it("«la célula ahora es a las 7:30» y «el ensayo de los viernes de 7 a 9»", () => {
    const r1 = aplicarRitmo(RITMO_BASE, { accion: "cambiar", id: "celula", inicio: "19:30", fin: "21:00" });
    expect(r1.bloque).toMatchObject({ id: "celula", inicio: "19:30", fin: "21:00", porConfirmar: false });
    expect(r1.claves).toContain("ritmo:servicios");
    const r2 = aplicarRitmo(r1.ritmo, { accion: "agregar", titulo: "Ensayo de la banda", sombrero: "artistico", inicio: "19:00", fin: "21:00", dias: [5], protegido: true });
    expect(r2.bloque.repite.regla).toBe("FREQ=WEEKLY;BYDAY=FR");
    expect(r2.bloque.id).toBe("ensayo-de-la-banda");
    expect(() => aplicarRitmo(RITMO_BASE, { accion: "cambiar", id: "celula", inicio: "21:00", fin: "20:00" })).toThrow(ErrorRitmo);
    expect(() => aplicarRitmo(RITMO_BASE, { accion: "quitar", id: "no-existe" })).toThrow(/No encuentro/);
  });
  it("el asistente ve sus horarios, su semana y las claves que puede cambiar", () => {
    const s = instruccionesParaOrdenar({ ajustes: AJUSTES_BASE, hoy: HOY, ritmo: RITMO_BASE, horarios: horariosParaLaIA(AJUSTES_BASE), claves: { despierta: "x" } });
    expect(s).toContain("celula · bloque · Célula · Iglesia · 20:00–21:30");
    expect(s).toContain("Se despierta: dom 06:30");
    expect(s).toContain("- despierta: x");
  });
});

describe("aplicar, deshacer y la tarjeta", () => {
  it("aplica todo, la tarjeta dice lo que entró y se deshace entero", () => {
    const orden = leerOrden({
      elementos: [
        { tipo: "evento", titulo: "Reunión con Adolfo", sombrero: "iglesia", cuando: "2026-11-07", hora: "10:00" },
        { tipo: "accion", titulo: "Mandar el informe a Dcasa", sombrero: "trabajo", cuando: HOY },
        { tipo: "ajuste", clave: "cierre", valor: "21:45" },
        { tipo: "ritmo", accion: "cambiar", id: "celula", inicio: "19:30", fin: "21:00" },
        { tipo: "ajuste", clave: "despierta", valor: "las cinco" },
      ],
    }, { hoy: HOY });
    const r = aplicarOrden(estado0(), orden);
    expect(r.estado.eventos).toHaveLength(1);
    expect(r.estado.acciones).toHaveLength(1);
    expect(r.estado.ajustes.avisos.cierre).toBe("21:45");
    expect(r.estado.ritmo.find((e) => e.id === "celula").inicio).toBe("19:30");
    expect(r.problemas[0]).toMatch(/no es una hora/);
    const t = tarjeta(r, orden, HOY);
    expect(t).toMatch(/^Listo:/);
    expect(t).toContain("«Reunión con Adolfo» · Iglesia · sáb 7 nov, 10:00 a. m.");
    expect(t).toContain("en Juancito Ads");
    expect(t).toContain("No pude:");
    const atras = deshacerOrden(r.estado, r.deshacer);
    expect(atras.eventos).toHaveLength(0);
    expect(atras.acciones).toHaveLength(0);
    expect(atras.ajustes.avisos.cierre).toBe(AJUSTES_BASE.avisos.cierre);
    expect(atras.ritmo.find((e) => e.id === "celula").inicio).toBe("20:00");
  });
});

describe("reuniones, eventos y recordatorios van a su sitio (casos reales)", () => {
  const sombreros = [
    { id: "reino", nombre: "El Reino" },
    { id: "trabajo", nombre: "Trabajo" },
    { id: "artistico", nombre: "Artístico" },
    { id: "iglesia", nombre: "Iglesia" },
    { id: "personal", nombre: "Personal" },
  ];

  it("«Agendar reunión con Dayano» (sin día) es una reunión POR AGENDAR en Iglesia, no una tarea en Reino", () => {
    const o = leerOrden(
      { elementos: [{ tipo: "accion", titulo: "Agendar reunión con Dayano", sombrero: "reino", personas: ["Dayano"] }], respuesta: "Listo" },
      { hoy: HOY, texto: "Tengo una reunión pendiente con Dayano, un hermano de la iglesia, agendarlo en reuniones.", sombreros },
    );
    expect(o.acciones).toHaveLength(0);
    expect(o.eventos).toHaveLength(1);
    expect(o.eventos[0]).toMatchObject({ titulo: "Reunión con Dayano", clase: "reunion", sombrero: "iglesia", fecha: null, repite: null, inicio: null });
    expect(o.pregunta).toMatch(/día y a qué hora/);
    expect(tarjeta(aplicarOrden(estado0(), o), o, HOY, { sombreros })).toMatch(/Reunión: «Reunión con Dayano».*por agendar/);
  });

  it("la noche de alabanza el 20 sin hora es un EVENTO de ese día con la hora por definir; lo que prepara, una tarea", () => {
    const o = leerOrden(
      {
        elementos: [
          { tipo: "evento", titulo: "Noche de alabanza", sombrero: "reino", cuando: "2026-11-20" },
          { tipo: "accion", titulo: "Preparar dos canciones para la noche de alabanza", sombrero: "artistico", cuando: "2026-11-18" },
          { tipo: "recordatorio", titulo: "Noche de alabanza: participación especial", sombrero: "iglesia", cuando: "2026-11-20" },
        ],
        pregunta: "¿A qué hora es la noche de alabanza?",
      },
      { hoy: HOY, texto: "El 20 de noviembre tenemos la noche de alabanza, tengo que preparar dos canciones, agéndalo y el recordatorio", sombreros },
    );
    expect(o.eventos).toHaveLength(1);
    expect(o.eventos[0]).toMatchObject({ titulo: "Noche de alabanza", clase: "evento", fecha: "2026-11-20", inicio: "00:00", fin: "23:59", horaPorDefinir: true, sombrero: "iglesia" });
    expect(o.acciones.map((a) => [a.titulo, a.clase])).toEqual([
      ["Preparar dos canciones para la noche de alabanza", "tarea"],
      ["Noche de alabanza: participación especial", "recordatorio"],
    ]);
    expect(o.avisos.join(" ")).not.toMatch(/tarea de ese día/);
    expect(o.pregunta).toBe("¿A qué hora es la noche de alabanza?");
  });

  it("al darle la hora, la reunión por agendar se agenda (no se crea otra)", () => {
    const pendiente = { id: "e1", titulo: "Reunión con Dayano", clase: "reunion", sombrero: "iglesia", fecha: null, repite: null, inicio: null, fin: null };
    const o = leerOrden({ operaciones: [{ op: "editar", tipo: "evento", id: "e1", cambios: { fecha: "2026-11-10", inicio: "15:00" } }] }, { hoy: HOY, eventos: [pendiente], sombreros });
    expect(o.operaciones[0].cambios).toMatchObject({ fecha: "2026-11-10", inicio: "15:00", fin: "16:00", horaPorDefinir: false });
    const sinHora = leerOrden({ operaciones: [{ op: "editar", tipo: "evento", id: "e1", cambios: { fecha: "2026-11-10" } }] }, { hoy: HOY, eventos: [pendiente], sombreros });
    expect(sinHora.operaciones[0].cambios).toMatchObject({ fecha: "2026-11-10", inicio: "00:00", fin: "23:59", horaPorDefinir: true });
    const conHora = leerOrden({ operaciones: [{ op: "editar", tipo: "evento", id: "e2", cambios: { inicio: "19:30" } }] }, {
      hoy: HOY,
      eventos: [{ id: "e2", titulo: "Noche de alabanza", clase: "evento", fecha: "2026-11-20", inicio: "00:00", fin: "23:59", horaPorDefinir: true }],
      sombreros,
    });
    expect(conHora.operaciones[0].cambios).toMatchObject({ inicio: "19:30", fin: "20:30", horaPorDefinir: false });
  });

  it("Reino se queda con lo que es a solas; un evento sin gente en Reino no se mueve", () => {
    const o = leerOrden({ elementos: [{ tipo: "evento", titulo: "Ayuno", sombrero: "reino", cuando: "2026-11-09", hora: "06:00" }] }, { hoy: HOY, sombreros });
    expect(o.eventos[0].sombrero).toBe("reino");
  });

  it("las reglas que lee el modelo ya no le dicen que una reunión sin hora es una tarea", () => {
    const sistema = instruccionesParaOrdenar({ ajustes: { ...structuredClone(AJUSTES_BASE), nombre: "Juan", zona: "America/Panama" }, hoy: HOY, eventos: [{ id: "e1", titulo: "Reunión con Dayano", clase: "reunion", sombrero: "iglesia", fecha: null, repite: null }] });
    expect(sistema).not.toMatch(/sin hora, una acción/);
    expect(sistema).toMatch(/NUNCA una acción/);
    expect(sistema).toMatch(/POR AGENDAR[\s\S]*e1 · Reunión con Dayano/);
  });
});

describe("un proyecto con fecha: el evento, los ensayos y lo que hay que preparar", () => {
  it("el evento le da la fecha al proyecto, los ensayos se ligan y terminan el día antes, las tareas van al proyecto", async () => {
    const { proyectosConFecha } = await import("../src/lib/proyectos.js");
    const o = leerOrden({
      elementos: [
        { tipo: "evento", titulo: "Ensayo con la banda", sombrero: "artistico", proyecto: "Concierto de febrero", cuando: "2026-11-05", hora: "19:00", repite: { regla: "FREQ=WEEKLY;BYDAY=TH" } },
        { tipo: "evento", titulo: "Concierto de febrero", clase: "especial", sombrero: "artistico", proyecto: "Concierto de febrero", cuando: "2027-02-14" },
        { tipo: "accion", titulo: "Escoger el repertorio", sombrero: "artistico", proyecto: "Concierto de febrero", cuando: "2026-11-20" },
      ],
    }, { hoy: HOY });
    expect(o.proyectos).toHaveLength(1);
    expect(o.proyectos[0]).toMatchObject({ nombre: "Concierto de febrero", tipo: "proyecto", limite: "2027-02-14" });
    const pid = o.proyectos[0].id;
    expect(o.eventos.every((e) => e.proyectoId === pid)).toBe(true);
    expect(o.eventos[0].repite.regla).toBe("FREQ=WEEKLY;BYDAY=TH;UNTIL=20270213");
    expect(o.acciones[0].proyectoId).toBe(pid);
    const [p] = proyectosConFecha({ proyectos: o.proyectos, acciones: o.acciones, eventos: o.eventos, hoy: HOY });
    expect(p.siguiente.titulo).toBe("Escoger el repertorio");
    expect(p.evento?.titulo).toBe("Concierto de febrero");
    expect(p.ensayos.length).toBeGreaterThan(10);
    expect(p.ensayos.every((e) => e.dia < "2027-02-14")).toBe(true);
    expect(p.pasos).toEqual({ hechos: 0, abiertos: 1, total: 1 });
  });
});
