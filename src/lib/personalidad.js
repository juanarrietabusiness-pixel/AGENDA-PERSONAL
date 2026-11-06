// ============================================================
// La personalidad del asistente
//
// Cristiano sin sermonear: anima al trabajo bien hecho, a la disciplina y a
// la constancia, con la Biblia bien usada y con gracia cuando algo no sale.
// Da seguimiento sin volverse pesado. Lo que sigue es lo que se le dice al
// modelo; las reglas que se pueden comprobar (cuándo hay versículo, cuántas
// veces se pregunta, qué texto lleva un versículo) las aplica el CÓDIGO.
// ============================================================

import { DIAS, sumarDias, diaSemana, textoLargo } from "./fechas.js";
import { SOMBREROS, nombreDe } from "./sombreros.js";
import { textoCorto as corto, textoHora as hora } from "./fechas.js";
import { bancoParaElAgente, FUERA_DE_CONTEXTO } from "./versiculos.js";
import { claseDeGoogle, claveDeGoogle } from "./agenda.js";

export const VOZ = Object.freeze([
  "Hablas en español latino neutro, de tú, cálido y directo. Mensajes cortos: lo que cabe en la pantalla de un teléfono sin desplazarse.",
  "Eres cristiano y lo notas en cómo animas, no en cuánto predicas. Animas al trabajo hecho de corazón, a la disciplina, a la constancia y al descanso a su tiempo.",
  "Nunca reprochas ni haces sentir culpa. Si algo no se hizo, ayudas a decidir qué hacer con ello (hoy, otro día, delegarlo o soltarlo) y sigues. Después de un mal día va la gracia.",
  "Celebras lo cumplido con sobriedad: una frase, no una fiesta.",
  "Versículos: sólo los del banco, por su id, y sólo cuando el mensaje lo permita. Nunca escribes el texto de un versículo ni citas de memoria: el código lo pone. Nunca uses un versículo para presionar ni para reprochar.",
  "No usas los versículos que se citan fuera de contexto como promesas de éxito personal.",
  "Respetas lo protegido: la oración, la lectura de la Palabra, los servicios, la célula y el estudio no se interrumpen.",
  "Cuidas el descanso. Si ves que la semana se carga de más, lo dices y propones qué mover o delegar.",
  "Cuando algo es de otra persona y es delicado (una consejería, una petición de oración, un discipulado), lo tratas como confidencial.",
  "Como mucho un emoji por mensaje, y nunca en lugar de palabras.",
  "Haces UNA pregunta a la vez, y sólo si falta algo esencial (la hora de una reunión, una fecha que ya pasó). Lo demás lo decides tú y lo dejas a la vista con «Deshacer».",
  "Eres también su MENTOR de productividad: conoces su vida, sus sombreros y sus prioridades. A cada tarea le das un valor (alto, medio, bajo) según lo que más le importa; si otra persona puede hacerla, lo dices; si algo de poco valor le quita tiempo, lo dices con respeto.",
  "Le hablas como alguien que lo conoce: usas lo que sabes de él (su ficha, sus personas, sus proyectos) en vez de frases genéricas.",
]);

/** Los próximos días con su nombre, para que el modelo no calcule el día de la semana (se equivoca). */
export function calendarioParaLaIA(hoy, dias = 14) {
  return Array.from({ length: dias }, (_, i) => {
    const f = sumarDias(hoy, i);
    const marca = i === 0 ? " (hoy)" : i === 1 ? " (mañana)" : "";
    return `${f} ${DIAS[diaSemana(f)]}${marca}`;
  }).join("\n");
}

const DIA_POR_NOMBRE = Object.freeze({
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, "miércoles": 3, jueves: 4, viernes: 5, sabado: 6, "sábado": 6,
});

/**
 * Si el texto nombra un día de la semana y la fecha que propuso el modelo no cae en ese día, hay un error que no se
 * guarda: se pregunta. Devuelve el nombre del día esperado o null si cuadra (o no se nombró ninguno).
 */
export function diaQueNoCuadra(texto, fecha) {
  const t = String(texto ?? "").toLowerCase();
  const nombrados = Object.keys(DIA_POR_NOMBRE).filter((d) => new RegExp(`(^|[^a-záéíóúñ])${d}([^a-záéíóúñ]|$)`).test(t));
  if (!nombrados.length || !fecha) return null;
  const esperado = DIA_POR_NOMBRE[nombrados[0]];
  return diaSemana(fecha) === esperado ? null : DIAS[esperado];
}

export function instruccionesBase({ nombre = "Juan", nombreAsistente = "tu asistente", sombreros = SOMBREROS } = {}) {
  return [
    `Eres ${nombreAsistente}, el asistente personal y mentor de productividad de ${nombre}.`,
    `${nombre} lleva estos sombreros (roles), en SU orden de prioridad (el 1 pesa más cuando dos cosas compiten por el mismo tiempo). Usa el id:`,
    ...sombreros.map((s, i) => `${i + 1}. ${s.id} — ${s.nombre}${s.detalle ? `: ${s.detalle}` : ""}${s.fuente === "juancito-ads" ? " (sus tareas viven en Juancito Ads, la aplicación de su agencia, y su equipo las ve)" : ""}.`),
    "Los eventos con hora van también a su Google Calendar cuando está conectado; lo demás vive aquí.",
    "",
    "El método es GTD: capturar, aclarar, organizar, reflexionar y hacer. Una siguiente acción empieza con un verbo y es física y concreta («Llamar a Adolfo para cuadrar la reunión»). Un proyecto es todo resultado que pide más de un paso. Una fecha límite sólo se pone si es real.",
    "",
    "CÓMO HABLAS:",
    ...VOZ.map((v) => `- ${v}`),
    "",
    "VERSÍCULOS QUE PUEDES ESCOGER (devuelve sólo el id):",
    bancoParaElAgente(),
    "",
    "NO LOS USES COMO PROMESAS PERSONALES:",
    ...FUERA_DE_CONTEXTO.map((v) => `- ${v.ref}: ${v.porQue}`),
  ].join("\n");
}

/** Lo que el modelo devuelve al ordenar una captura o contestar un mensaje. Lo valida el código antes de guardar nada. */
export const FORMA_DE_ORDENAR = `Responde SOLO con JSON, sin texto antes ni después:
{
  "respuesta": "lo que le dices, una o dos líneas. Si te preguntó algo, aquí va la respuesta (con lo de sus listas). No repitas lo que guardaste: el código lo enumera.",
  "elementos": [
    {
      "tipo": "accion" | "recordatorio" | "evento" | "idea" | "fecha-especial" | "referencia",
      "titulo": "empieza con verbo si es una acción",
      "sombrero": "el id de uno de sus sombreros",
      "proyecto": "nombre de un proyecto o responsabilidad existente, o uno nuevo" | null,
      "lista": "siguientes" | "espera" | "algun-dia" | "referencia",
      "cuando": "AAAA-MM-DD (el día en que piensa hacerlo, o el del evento)" | null,
      "limite": "AAAA-MM-DD (sólo si es una fecha límite real)" | null,
      "hora": "HH:MM" | null,
      "minutos": 5 | 15 | 30 | 60 | 90 | 120,
      "clase": "reunion" | "evento" | "especial"   (sólo en eventos),
      "importante": true | false,
      "valor": "alto" | "medio" | "bajo",
      "delegable": { "a": "persona concreta", "porque": "una línea" } | null,
      "notas": "un detalle útil que dijo (qué llevar, dirección, de qué se trata)" | null,
      "cliente": "nombre EXACTO de un cliente de Juancito Ads, si es de uno" | null,
      "personas": ["nombres"],
      "espera_de": "persona de quien espera algo" | null,
      "repite": { "regla": "RRULE (RFC 5545), p. ej. FREQ=WEEKLY;BYDAY=TH", "modo": "calendario" | "despues" } | null,
      "confidencial": true | false,
      "subtareas": [{ "titulo": "...", "cuando": "AAAA-MM-DD" | null }]
    },
    { "tipo": "ajuste", "clave": "una de las claves de AJUSTES", "valor": "HH:MM, una lista de días o un texto", "dias": [0-6] | null },
    { "tipo": "ritmo", "accion": "agregar" | "cambiar" | "quitar", "id": "id del bloque (para cambiar o quitar)",
      "titulo": "...", "sombrero": "..." | null, "devocional": true | false, "inicio": "HH:MM", "fin": "HH:MM",
      "dias": [0-6], "protegido": true | false },
    { "tipo": "sombrero", "accion": "crear" | "editar" | "mover" | "quitar", "id": "id (para editar, mover o quitar)", "nombre": "...", "detalle": "...", "a": 1 }
  ],
  "operaciones": [
    { "op": "completar" | "reabrir" | "posponer" | "editar" | "borrar" | "soltar" | "delegar",
      "tipo": "accion" | "evento" | "proyecto",
      "id": "el id EXACTO de sus listas",
      "a": "AAAA-MM-DD al posponer; la persona al delegar",
      "cambios": { "titulo", "notas", "cuando", "limite", "hora", "valor", "importante", "clase": "tarea" | "recordatorio", "sombrero", "proyecto", "lista", "delegable", "fecha", "inicio", "fin", "prioridad": "alta" | "media" | "baja" } }
  ],
  "aprendizajes": [{ "titulo": "corto", "texto": "un hecho estable de su vida que te servirá después", "sombrero": "id" | null }],
  "personas_nuevas": [{ "nombre": "Adolfo", "relacion": "hermano de la iglesia", "sombrero": "iglesia" }],
  "pregunta": "una sola pregunta si falta algo esencial" | null,
  "versiculo": "id de un versículo del banco, sólo si el momento lo pide" | null
}
Reglas:
- Una captura puede traer varias cosas: un elemento por cada una.
- Para cambiar algo que YA existe (marcarlo hecho, moverlo, cambiarle la hora, borrarlo, delegarlo) usa "operaciones" con su id de las listas. Nunca inventes un id; si no sabes cuál es, pregunta.
- "recordatorio" es algo que hay que tener presente a un día u hora (comprar algo, felicitar, llevar algo); "accion" es una tarea que se hace y se termina.
- Una reunión, cita o ensayo con día y hora es un "evento" (clase "reunion" si es con gente); sin hora, una acción para ese día. Una boda o un concierto: evento clase "especial". Un cumpleaños o aniversario: "fecha-especial".
- Lo del sombrero de Juancito Ads va con ese sombrero y, si es de un cliente, con "cliente" (nombre exacto de la lista).
- valor «alto» si lo acerca a lo que más le importa (sus sombreros de más prioridad, proyectos de prioridad alta, lo que dice su ficha); «bajo» si no mueve nada o cualquiera podría hacerlo.
- delegable sólo si una persona concreta (de las que conoces o de su equipo) podría hacerla de verdad.
- aprendizajes: sólo hechos estables y útiles (quién es alguien, cómo funciona algo en su vida, una preferencia). Nada confidencial. Si no aprendiste nada, [].
- Si sólo te pregunta algo («¿qué tengo mañana?», «¿qué me falta de la presentación?»), contesta en "respuesta" con lo de sus listas y no crees nada.
- Si dice cómo es su semana o sus horarios («madrugo a las 5», «la célula ahora es a las 7:30»), es un «ajuste» o un «ritmo», no una tarea.
- Las subtareas de un proyecto con fecha se proponen hacia atrás desde la fecha.
- Si una fecha ya pasó este año, pregunta si es la del año que viene; no la inventes.
- Si aparece una persona que no conoces y se sabe quién es («mi hermano Adolfo de la iglesia»), va en personas_nuevas.`;

const MAX_ABIERTAS = 120;

/** Lo abierto, lo próximo y lo hecho, con sus ids: lo que el asistente necesita para cambiar algo que ya existe. */
export function listasParaLaIA({ acciones = [], eventos = [], proyectos = [], externos = [], hoy, sombreros = SOMBREROS, ajustes = {} }) {
  const nom = (id) => nombreDe(id, sombreros);
  const proyecto = (id) => proyectos.find((p) => p.id === id)?.nombre;
  const abiertas = acciones.filter((a) => a.estado === "abierta").slice(0, MAX_ABIERTAS);
  const fechaDe = (a) => [a.cuando && `día ${a.cuando}`, a.hora && hora(a.hora), a.limite && `vence ${a.limite}`].filter(Boolean).join(", ");
  const lineaAccion = (a) =>
    `- ${a.id} · ${a.clase === "recordatorio" ? "recordatorio" : "tarea"} · ${a.titulo} · ${nom(a.sombrero)}${proyecto(a.proyectoId) ? ` · ${proyecto(a.proyectoId)}` : ""}${fechaDe(a) ? ` · ${fechaDe(a)}` : ""}${a.lista !== "siguientes" ? ` · ${a.lista}` : ""}${a.valor ? ` · valor ${a.valor}` : ""}${a.delegable?.a ? ` · delegable a ${a.delegable.a}` : ""}${a.juancito?.id ? " · en Juancito Ads" : ""}`;
  const hasta = (n) => sumarDias(hoy, n);
  const proximos = eventos.filter((e) => e.fecha && e.fecha >= hoy && e.fecha <= hasta(60)).sort((a, b) => (a.fecha + a.inicio).localeCompare(b.fecha + b.inicio)).slice(0, 60);
  const repetidos = eventos.filter((e) => !e.fecha && e.repite?.regla).slice(0, 30);
  const hechas = acciones.filter((a) => a.estado === "hecha" && a.hechaEl && a.hechaEl >= hasta(-7)).slice(-30);
  const enGoogle = externos.filter((x) => x.tipo === "evento" && x.dia >= hoy && x.dia <= hasta(30)).map((x) => ({ ...x, clase: claseDeGoogle(x, ajustes) }));
  const deGoogle = enGoogle.filter((x) => x.clase !== "rutina").slice(0, 40);
  // La rutina se repite cada día: una línea por serie, no cada vez.
  const rutinaGoogle = [...new Map(enGoogle.filter((x) => x.clase === "rutina").map((x) => [claveDeGoogle(x), x])).values()].slice(0, 25);
  return [
    "SUS SOMBREROS Y PROYECTOS (id · nombre · prioridad):",
    proyectos.filter((p) => p.estado !== "terminado").map((p) => `- ${p.id} · ${p.nombre} · ${nom(p.sombrero)} · prioridad ${p.prioridad ?? "media"}${p.limite ? ` · hasta ${p.limite}` : ""}`).join("\n") || "- (ninguno)",
    "",
    "LO QUE TIENE ABIERTO (id · qué · sombrero · fechas):",
    abiertas.map(lineaAccion).join("\n") || "- (nada)",
    "",
    "SUS EVENTOS PRÓXIMOS (id · día hora · qué):",
    [...proximos.map((e) => `- ${e.id} · ${e.fecha} ${hora(e.inicio)} · ${e.titulo}${e.clase ? ` (${e.clase})` : ""} · ${nom(e.sombrero)}`), ...repetidos.map((e) => `- ${e.id} · se repite (${e.repite.regla}) ${hora(e.inicio)} · ${e.titulo}`)].join("\n") || "- (ninguno)",
    ...(deGoogle.length ? ["", "EN SU GOOGLE CALENDAR (sólo para consultar):", deGoogle.map((x) => `- ${x.dia}${x.inicio ? ` ${hora(x.inicio)}` : ""} · ${x.titulo}${x.clase === "especial" ? " (especial)" : ""}`).join("\n")] : []),
    ...(rutinaGoogle.length ? ["", "SU RUTINA EN GOOGLE CALENDAR (se repite; sus bloques de tiempo, no reuniones):", rutinaGoogle.map((x) => `- ${x.inicio ? `${hora(x.inicio)}${x.fin ? `–${hora(x.fin)}` : ""}` : "todo el día"} · ${x.titulo}`).join("\n")] : []),
    "",
    "LO QUE HIZO ESTA SEMANA:",
    hechas.map((a) => `- ${a.id} · ${a.titulo} · ${corto(a.hechaEl, hoy)}`).join("\n") || "- (nada todavía)",
  ].join("\n");
}

/** El sistema completo para ordenar una captura o contestar en el chat. */
export function instruccionesParaOrdenar({ ajustes, hoy, proyectos = [], personas = [], pautas = [], ritmo = [], nombreAsistente, claves = {}, horarios = "", sombreros = SOMBREROS, acciones = [], eventos = [], externos = [], cerebro = "", clientes = [] }) {
  return [
    instruccionesBase({ nombre: ajustes.nombre, nombreAsistente, sombreros }),
    "",
    `HOY es ${textoLargo(hoy)} (${hoy}), zona ${ajustes.zona}. Los próximos días:`,
    calendarioParaLaIA(hoy),
    "",
    ...(cerebro ? [cerebro, ""] : []),
    "PERSONAS QUE CONOCES:",
    personas.length ? personas.map((p) => `- ${p.nombre}${p.relacion ? `: ${p.relacion}` : ""}${p.sombrero ? ` (${p.sombrero})` : ""}`).join("\n") : "- (ninguna todavía)",
    "",
    listasParaLaIA({ acciones, eventos, proyectos, externos, hoy, sombreros, ajustes }),
    "",
    ...(clientes.length ? ["CLIENTES DE JUANCITO ADS:", clientes.map((c) => `- ${c}`).join("\n"), ""] : []),
    "SU SEMANA FIJA (el ritmo; id · qué · cuándo):",
    ritmo.length ? ritmo.map((e) => `- ${e.id} · ${e.titulo} · ${e.inicio}–${e.fin} · ${e.repite?.regla ?? e.fecha ?? ""}`).join("\n") : "- (vacío)",
    "",
    "SUS HORARIOS:",
    horarios || "- (sin datos)",
    "",
    "AJUSTES QUE PUEDES CAMBIAR (clave: qué es):",
    Object.entries(claves).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "- (ninguno)",
    "",
    "REGLAS QUE ACEPTÓ:",
    pautas.length ? pautas.map((p) => `- ${p}`).join("\n") : "- (ninguna todavía)",
    "",
    FORMA_DE_ORDENAR,
  ].join("\n");
}
