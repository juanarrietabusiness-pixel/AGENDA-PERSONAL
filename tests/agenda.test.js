import { describe, it, expect } from "vitest";
import { rango, mover, ordenarPor, accionesDelPeriodo, sinFecha, especialesDelMes, reunionesDelPeriodo, eventosDelPeriodo, loQueMasVale, porDelegar, bajoValor, repartoAbierto, valorDe } from "../src/lib/agenda.js";
import { aplicarSombrero, limpiarSombreros, sombrerosDe, prioridadDe, idPara, SOMBREROS, ErrorSombrero } from "../src/lib/sombreros.js";
import { buscar, paraElAsistente, limpiarAprendizajes, limpiarNota } from "../src/lib/cerebro.js";
import { leerOrden, aplicarOrden, deshacerOrden, tarjeta } from "../src/lib/agente.js";
import { nuevaAccion } from "../src/lib/metodo.js";
import { AJUSTES_BASE } from "../src/lib/ajustes.js";
import { RITMO_BASE } from "../src/lib/ritmo.js";

const HOY = "2026-11-06"; // viernes
const accion = (datos) => nuevaAccion({ lista: "siguientes", ...datos }, "2026-11-01");

describe("la agenda: periodos y orden", () => {
  it("el día, la semana (lunes a domingo) y el mes", () => {
    expect(rango("dia", HOY)).toEqual({ desde: HOY, hasta: HOY });
    expect(rango("semana", HOY)).toEqual({ desde: "2026-11-02", hasta: "2026-11-08" });
    expect(rango("mes", HOY)).toEqual({ desde: "2026-11-01", hasta: "2026-11-30" });
    expect(mover("mes", "2026-01-31", 1)).toMatch(/^2026-02/);
    expect(mover("semana", HOY, -1)).toBe("2026-10-30");
  });

  it("por prioridad manda el sombrero que va primero y el valor; por fecha límite, la más cercana", () => {
    const sombreros = SOMBREROS;
    const a = accion({ titulo: "Personal baja", sombrero: "personal", valor: "bajo", cuando: HOY });
    const b = accion({ titulo: "Trabajo alto", sombrero: "trabajo", valor: "alto", cuando: HOY });
    const c = accion({ titulo: "Iglesia vence mañana", sombrero: "iglesia", limite: "2026-11-07" });
    const ctx = { hoy: HOY, sombreros, proyectos: [] };
    expect(ordenarPor([a, b, c], "prioridad", ctx)[0].titulo).toBe("Trabajo alto");
    expect(ordenarPor([a, b, c], "limite", ctx)[0].titulo).toBe("Iglesia vence mañana");
    expect(ordenarPor([a, b, c], "prioridad", ctx).at(-1).titulo).toBe("Personal baja");
  });

  it("el valor de un proyecto de prioridad alta pasa a sus tareas", () => {
    const p = { id: "p1", nombre: "Disco", prioridad: "alta" };
    expect(valorDe(accion({ titulo: "Grabar", proyectoId: "p1" }), { proyectos: [p] })).toBe("alto");
  });

  it("tareas y recordatorios van aparte; las hechas del periodo también salen (para editarlas)", () => {
    const t = accion({ titulo: "Tarea", cuando: HOY });
    const r = accion({ titulo: "Recordatorio", clase: "recordatorio", cuando: HOY, hora: "09:00" });
    const h = { ...accion({ titulo: "Hecha", cuando: HOY }), estado: "hecha", hechaEl: HOY };
    const libre = accion({ titulo: "Sin fecha" });
    const d = rango("dia", HOY);
    const tareas = accionesDelPeriodo([t, r, h, libre], { ...d, hoy: HOY, clase: "tarea" });
    expect(tareas.abiertas.map((x) => x.titulo)).toEqual(["Tarea"]);
    expect(tareas.hechas.map((x) => x.titulo)).toEqual(["Hecha"]);
    expect(accionesDelPeriodo([t, r, h], { ...d, hoy: HOY, clase: "recordatorio" }).abiertas.map((x) => x.titulo)).toEqual(["Recordatorio"]);
    expect(sinFecha([t, r, h, libre]).map((x) => x.titulo)).toEqual(["Sin fecha"]);
  });

  it("los cumpleaños del mes salen aunque se mire un día", () => {
    const cumple = accion({ titulo: "Cumpleaños de Ana", clase: "recordatorio", repite: { regla: "FREQ=YEARLY", modo: "calendario", inicio: "1990-11-20" } });
    const boda = { id: "e1", titulo: "Boda de Pedro", clase: "especial", fecha: "2026-11-28", inicio: "00:00", fin: "23:59" };
    const fuera = { id: "e2", titulo: "Boda de diciembre", clase: "especial", fecha: "2026-12-05", inicio: "00:00" };
    expect(especialesDelMes([cumple], [boda, fuera], HOY).map((x) => [x.titulo, x.dia])).toEqual([
      ["Cumpleaños de Ana", "2026-11-20"],
      ["Boda de Pedro", "2026-11-28"],
    ]);
  });

  it("las reuniones juntan las propias y las de Google sin repetir las que se crearon desde aquí", () => {
    const propia = { id: "e1", titulo: "Ensayo", fecha: HOY, inicio: "18:00", fin: "20:00", clase: "reunion", google: { id: "g1" } };
    const repetida = { id: "e2", titulo: "Célula", repite: { regla: "FREQ=WEEKLY;BYDAY=FR", inicio: "2026-10-02" }, inicio: "19:30", fin: "21:00", clase: "reunion", google: { id: "g2" } };
    const externos = [
      { id: "g1", tipo: "evento", dia: HOY, inicio: "18:00", titulo: "Ensayo" },
      { id: "g2_20261106T003000Z", tipo: "evento", dia: HOY, inicio: "19:30", titulo: "Célula" },
      { id: "g9", tipo: "evento", dia: HOY, inicio: "08:00", titulo: "Dentista" },
    ];
    const r = reunionesDelPeriodo([propia, repetida], externos, rango("dia", HOY));
    expect(r.map((x) => x.titulo)).toEqual(["Dentista", "Ensayo", "Célula"]);
    expect(r[0].fuente).toBe("google");
  });

  it("lo de todo el día de Google (feriados, cumpleaños) va a especiales del mes, no a reuniones", () => {
    const externos = [
      { id: "h1", tipo: "evento", dia: "2026-11-28", todoElDia: true, titulo: "Independencia de España", calendarioNombre: "Festivos" },
      { id: "g1", tipo: "evento", dia: HOY, inicio: "10:00", titulo: "Llamada" },
    ];
    expect(reunionesDelPeriodo([], externos, rango("mes", HOY)).map((x) => x.id)).toEqual(["g1"]);
    expect(especialesDelMes([], [], HOY, externos).map((x) => [x.id, x.tipo])).toEqual([["h1", "google"]]);
  });

  it("un evento que se repite sale en cada día del periodo; una regla rota no tumba nada", () => {
    const e = { id: "e", titulo: "Servicio", repite: { regla: "FREQ=WEEKLY;BYDAY=TU,WE", inicio: "2026-10-01" }, inicio: "19:00" };
    const roto = { id: "r", titulo: "Roto", repite: { regla: "esto no es una regla", inicio: "2026-10-01" } };
    expect(eventosDelPeriodo([e, roto], rango("semana", HOY)).map((x) => x.dia)).toEqual(["2026-11-03", "2026-11-04"]);
  });
});

describe("el mentor", () => {
  const ctx = { hoy: HOY, sombreros: SOMBREROS, proyectos: [] };
  it("lo que más vale, lo delegable y lo de valor bajo", () => {
    const alto = accion({ titulo: "Cerrar contrato", sombrero: "trabajo", valor: "alto" });
    const deleg = accion({ titulo: "Editar video", sombrero: "trabajo", delegable: { a: "Ana", porque: "lo hace mejor" } });
    const bajo = accion({ titulo: "Ordenar el escritorio", sombrero: "personal", valor: "bajo" });
    expect(loQueMasVale([alto, deleg, bajo], ctx).map((a) => a.titulo)).toEqual(["Cerrar contrato"]);
    expect(porDelegar([alto, deleg, bajo]).map((a) => a.titulo)).toEqual(["Editar video"]);
    expect(bajoValor([alto, deleg, bajo], ctx).map((a) => a.titulo)).toEqual(["Ordenar el escritorio"]);
  });

  it("el reparto por sombrero con su prioridad", () => {
    const r = repartoAbierto([accion({ titulo: "a", sombrero: "trabajo" }), accion({ titulo: "b", sombrero: "trabajo" }), accion({ titulo: "c", sombrero: "personal" })], SOMBREROS);
    expect(r.find((x) => x.id === "trabajo")).toMatchObject({ prioridad: 1, abiertas: 2, porcentaje: 67 });
    expect(r.find((x) => x.id === "personal")).toMatchObject({ prioridad: 4, abiertas: 1 });
  });
});

describe("los sombreros a la medida", () => {
  it("crear, renombrar, mover (la prioridad) y quitar", () => {
    let { lista } = aplicarSombrero(undefined, { accion: "crear", nombre: "Estudios" });
    expect(lista.at(-1)).toMatchObject({ id: "estudios", nombre: "Estudios" });
    ({ lista } = aplicarSombrero(lista, { accion: "editar", id: "trabajo", nombre: "Juancito Ads" }));
    expect(lista[0]).toMatchObject({ id: "trabajo", nombre: "Juancito Ads", fuente: "juancito-ads" });
    ({ lista } = aplicarSombrero(lista, { accion: "mover", id: "personal", a: 1 }));
    expect(lista.map((s) => s.id)).toEqual(["personal", "trabajo", "artistico", "iglesia", "estudios"]);
    expect(prioridadDe("personal", lista)).toBe(1);
    ({ lista } = aplicarSombrero(lista, { accion: "quitar", id: "estudios" }));
    expect(lista).toHaveLength(4);
  });

  it("no deja nombres repetidos, vacíos, ni quedarse sin sombreros", () => {
    expect(() => aplicarSombrero(undefined, { accion: "crear", nombre: "trabajo" })).toThrow(ErrorSombrero);
    expect(() => aplicarSombrero(undefined, { accion: "editar", id: "trabajo", nombre: " " })).toThrow(ErrorSombrero);
    expect(() => aplicarSombrero([SOMBREROS[0]], { accion: "quitar", id: "trabajo" })).toThrow(/al menos un sombrero/);
  });

  it("lo guardado que no se entiende se cae; sin nada, los de partida", () => {
    expect(sombrerosDe({}).map((s) => s.id)).toEqual(["trabajo", "artistico", "iglesia", "personal"]);
    expect(limpiarSombreros([{ id: "X Y", nombre: "malo" }, { id: "ok-1", nombre: "Bien", color: "javascript:alert(1)" }]).map((s) => s.id)).toEqual(["ok-1"]);
    expect(limpiarSombreros([{ id: "ok-1", nombre: "Bien", color: "url(x)" }])[0].color).not.toContain("url");
    expect(idPara("Música y arte", SOMBREROS)).toBe("musica-y-arte");
  });
});

describe("el cerebro", () => {
  const notas = [
    { id: "f", tipo: "ficha", titulo: "Mi ficha", texto: "Juan, de Panamá. Lidera una célula." },
    { id: "n1", tipo: "aprendido", titulo: "Adolfo", texto: "Adolfo es su hermano de la iglesia; se reúnen los sábados." },
    { id: "n2", tipo: "nota", titulo: "Estudio", texto: "Graba los jueves en la tarde en el estudio de Pedro." },
  ];

  it("busca por palabras sin tildes ni mayúsculas", () => {
    expect(buscar(notas, "reunión con ADOLFO").map((n) => n.id)).toEqual(["n1"]);
    expect(buscar(notas, "grabación en el estudio").map((n) => n.id)).toEqual(["n2"]);
    expect(buscar(notas, "nada que ver")).toEqual([]);
  });

  it("al asistente va la ficha siempre y sólo las notas que tienen que ver", () => {
    const r = paraElAsistente(notas, "agenda con Adolfo el sábado");
    expect(r.texto).toContain("QUIÉN ES");
    expect(r.texto).toContain("Adolfo es su hermano");
    expect(r.texto).not.toContain("estudio de Pedro");
    expect(r.usadas).toEqual(["f", "n1"]);
  });

  it("lo que aprende: sin repetir, sin lo confidencial y como mucho tres por vez", () => {
    const nuevos = limpiarAprendizajes(
      [
        { titulo: "Adolfo", texto: "Adolfo es su hermano de la iglesia y se reúnen los sábados" },
        { titulo: "Clave del banco", texto: "1234", confidencial: true },
        { titulo: "Su esposa", texto: "Se llama María." },
        { titulo: "Café", texto: "Toma café sin azúcar." },
        { titulo: "Gimnasio", texto: "Va al gimnasio los martes." },
        { titulo: "Perro", texto: "Tiene un perro, Max." },
      ],
      notas,
    );
    expect(nuevos.map((n) => n.titulo)).toEqual(["Su esposa", "Café", "Gimnasio"]);
  });

  it("una nota escrita a mano queda limpia", () => {
    expect(limpiarNota({ tipo: "raro", titulo: "  Hola   mundo ", texto: "x".repeat(5000), sombrero: "nadie" }, { sombreros: SOMBREROS })).toMatchObject({ tipo: "nota", titulo: "Hola mundo", sombrero: null });
  });
});

describe("el asistente cambia lo que ya existe (por id) y lo deshace", () => {
  const base = () => {
    const a = accion({ id: "a1", titulo: "Llamar a Adolfo", sombrero: "iglesia", cuando: HOY });
    const b = accion({ id: "a2", titulo: "Editar el video", sombrero: "trabajo", cuando: HOY });
    return { acciones: [a, b], eventos: [{ id: "e1", titulo: "Reunión", fecha: "2026-11-09", inicio: "10:00", fin: "11:00", sombrero: "trabajo", clase: "reunion" }], proyectos: [], personas: [], ajustes: structuredClone(AJUSTES_BASE), ritmo: structuredClone(RITMO_BASE) };
  };

  it("completar, posponer, delegar y editar; lo que no existe no se toca", () => {
    const e = base();
    const orden = leerOrden(
      {
        respuesta: "Listo",
        operaciones: [
          { op: "completar", id: "a1" },
          { op: "delegar", id: "a2", a: "Ana" },
          { op: "posponer", id: "e1", a: "2026-11-10" },
          { op: "editar", id: "a2", cambios: { valor: "bajo", notas: "Con música" } },
          { op: "completar", id: "no-existe" },
          { op: "completar", id: "e1" },
        ],
      },
      { hoy: HOY, acciones: e.acciones, eventos: e.eventos, proyectos: [] },
    );
    expect(orden.operaciones.map((o) => o.op)).toEqual(["completar", "delegar", "posponer", "editar"]);
    expect(orden.avisos.join(" ")).toMatch(/No encontré/);
    expect(orden.avisos.join(" ")).toMatch(/no es una tarea/);
    const r = aplicarOrden(e, orden);
    expect(r.estado.acciones.find((x) => x.id === "a1").estado).toBe("hecha");
    // Delegar es pasarla: queda «en espera» de Ana, con cuándo preguntarle.
    expect(r.estado.acciones.find((x) => x.id === "a2")).toMatchObject({ lista: "espera", espera: { persona: "Ana", desde: HOY }, valor: "bajo", notas: "Con música" });
    expect(r.estado.eventos[0].fecha).toBe("2026-11-10");
    const t = tarjeta(r, orden, HOY);
    expect(t).toContain("Hecha: «Llamar a Adolfo»");
    const atras = deshacerOrden(r.estado, r.deshacer);
    expect(atras.acciones.find((x) => x.id === "a1").estado).toBe("abierta");
    expect(atras.acciones.find((x) => x.id === "a2")).toMatchObject({ lista: "siguientes", espera: null, valor: null });
    expect(atras.eventos[0].fecha).toBe("2026-11-09");
  });

  it("delegar sin decir a quién pregunta", () => {
    const e = base();
    const orden = leerOrden({ operaciones: [{ op: "delegar", id: "a2" }] }, { hoy: HOY, acciones: e.acciones });
    expect(orden.operaciones).toEqual([]);
    expect(orden.pregunta).toMatch(/A quién/);
  });

  it("un sombrero nuevo por el asistente, y aprende de lo que le cuentan", () => {
    const e = base();
    const orden = leerOrden(
      {
        elementos: [{ tipo: "sombrero", accion: "crear", nombre: "Estudios" }],
        aprendizajes: [{ titulo: "Su maestría", texto: "Estudia una maestría los sábados." }],
      },
      { hoy: HOY, cerebro: [] },
    );
    const r = aplicarOrden(e, orden);
    expect(r.estado.ajustes.sombreros.map((s) => s.nombre)).toContain("Estudios");
    expect(r.hecho.aprendizajes).toHaveLength(1);
    const atras = deshacerOrden(r.estado, r.deshacer);
    expect(sombrerosDe(atras.ajustes).map((s) => s.nombre)).not.toContain("Estudios");
  });
});
