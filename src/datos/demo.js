// ============================================================
// Datos de ejemplo del prototipo
//
// Sacados de lo que Juan contó (sus cuatro sombreros, su semana) y
// colocados alrededor de HOY, para que el prototipo se vea vivo el día que
// se abra. Nada de esto va a producción: allí se lee de Juancito Ads, de
// Google Calendar y de lo que se capture.
// ============================================================

import { sumarDias, diaSemana } from "../lib/fechas.js";
import { nuevaAccion } from "../lib/metodo.js";

/** El próximo día de la semana `dia` (0 = domingo) desde `hoy`, hoy incluido. */
const proximo = (hoy, dia) => sumarDias(hoy, (dia - diaSemana(hoy) + 7) % 7);

export function datosDemo(hoy) {
  const d = (n) => sumarDias(hoy, n);
  const jueves = proximo(hoy, 4);
  const viernes = proximo(hoy, 5);
  const sabado = proximo(hoy, 6);

  const proyectos = [
    { id: "ja", nombre: "Clientes de Juancito Ads", sombrero: "trabajo", tipo: "responsabilidad", fuente: "juancito-ads" },
    { id: "sencillo", nombre: "Sencillo nuevo", sombrero: "artistico", tipo: "proyecto", resultado: "El sencillo grabado y publicado", limite: d(45) },
    { id: "marca", nombre: "Marca personal", sombrero: "artistico", tipo: "responsabilidad" },
    { id: "celula", nombre: "La célula", sombrero: "iglesia", tipo: "responsabilidad" },
    { id: "discipulados", nombre: "Discipulados", sombrero: "iglesia", tipo: "responsabilidad", confidencial: true },
    { id: "retiro", nombre: "Retiro de jóvenes", sombrero: "iglesia", tipo: "proyecto", resultado: "Un retiro de jóvenes en enero", limite: d(75) },
    { id: "matrimonio", nombre: "Mi matrimonio", sombrero: "personal", tipo: "responsabilidad" },
    { id: "app", nombre: "Esta aplicación", sombrero: "personal", tipo: "proyecto", resultado: "La agenda personal funcionando", limite: d(30) },
  ];

  const a = (datos) => nuevaAccion({ lista: "siguientes", creada: d(-3), ...datos }, hoy);

  const acciones = [
    // Trabajo: viven en Juancito Ads y aquí se leen.
    a({ id: "t1", titulo: "Enviar la propuesta de pauta a Dcasa", sombrero: "trabajo", proyectoId: "ja", cuando: hoy, limite: d(1), minutos: 60, importante: true, origen: "juancito-ads", cliente: "Dcasa" }),
    a({ id: "t2", titulo: "Revisar el calendario de noviembre de Baby Caleb", sombrero: "trabajo", proyectoId: "ja", cuando: hoy, minutos: 30, origen: "juancito-ads", cliente: "Baby Caleb" }),
    a({ id: "t3", titulo: "Llamar a Rofer por el informe del mes", sombrero: "trabajo", proyectoId: "ja", cuando: d(1), minutos: 15, origen: "juancito-ads", cliente: "Rofer", delegable: { a: "alguien del equipo", porque: "Es leer cifras ya calculadas; tu voz no es necesaria." }, valor: "medio" }),

    // Artístico
    a({ id: "m1", titulo: "Terminar la letra del segundo verso", sombrero: "artistico", proyectoId: "sencillo", cuando: hoy, minutos: 60, importante: true, energia: "alta" }),
    a({ id: "m2", titulo: "Confirmar el ensayo con la banda", sombrero: "artistico", cuando: hoy, minutos: 5 }),
    a({ id: "m3", titulo: "Grabar un reel para la marca personal", sombrero: "artistico", proyectoId: "marca", cuando: d(2), minutos: 30 }),
    a({ id: "m4", titulo: "Ordenar el cuarto de grabación", sombrero: "artistico", cuando: d(-2), minutos: 60, pospuesta: 1 }),

    // Iglesia
    a({ id: "i1", titulo: "Preparar el tema de la célula", sombrero: "iglesia", proyectoId: "celula", cuando: hoy, minutos: 60, importante: true, repite: { regla: "FREQ=WEEKLY;BYDAY=WE", modo: "calendario", inicio: "2026-01-07" } }),
    a({ id: "i2", titulo: "Llamar a Adolfo para cuadrar la reunión", sombrero: "iglesia", cuando: hoy, minutos: 15, personas: ["Adolfo"] }),
    a({ id: "i3", titulo: "Seguimiento del discipulado de Marcos", sombrero: "iglesia", proyectoId: "discipulados", cuando: d(2), minutos: 30, confidencial: true, importante: true }),
    a({ id: "i4", titulo: "Lista de jóvenes que van al retiro", sombrero: "iglesia", proyectoId: "retiro", lista: "espera", espera: { persona: "Pastor Luis", desde: d(-4), preguntar: hoy } }),

    // Personal
    a({ id: "p1", titulo: "Pagar la luz", sombrero: "personal", limite: d(-1), minutos: 15, importante: true }),
    a({ id: "p2", titulo: "Reservar la cena del sábado con mi esposa", sombrero: "personal", proyectoId: "matrimonio", cuando: hoy, minutos: 15, importante: true }),
    a({ id: "p3", titulo: "Comprar el perfume para mi esposa", sombrero: "personal", proyectoId: "matrimonio", limite: d(3), minutos: 30, importante: true }),
    a({ id: "p4", titulo: "Escoger el nombre y el color de la agenda", sombrero: "personal", proyectoId: "app", cuando: d(1), minutos: 15 }),
    a({ id: "p5", titulo: "Aprender a producir en Ableton", sombrero: "artistico", lista: "algun-dia" }),
  ];

  // Lo que llegó por Telegram o por la aplicación y todavía nadie aclaró.
  const bandeja = [
    { id: "c1", texto: "Idea: retiro de jóvenes en enero, ver lugares cerca de la playa", canal: "telegram", creada: d(0) },
    { id: "c2", texto: "El de Dcasa me pidió cambiar el logo del perfil de Instagram", canal: "voz", creada: d(0) },
    { id: "c3", texto: "El cumpleaños de mi mamá es el 12 de marzo", canal: "app", creada: d(-1) },
  ];

  // Eventos sueltos (los recurrentes están en el ritmo): de Google Calendar.
  const eventos = [
    { id: "e1", titulo: "Reunión con Dcasa", sombrero: "trabajo", fecha: jueves, inicio: "10:00", fin: "11:00", fuente: "google" },
    { id: "e2", titulo: "Ensayo con la banda", sombrero: "artistico", fecha: viernes, inicio: "19:00", fin: "21:00", fuente: "google", protegido: true },
    { id: "e3", titulo: "Reunión con Adolfo", sombrero: "iglesia", fecha: sabado, inicio: "10:00", fin: "11:00", fuente: "google" },
    { id: "e4", titulo: "Cena con mi esposa", sombrero: "personal", fecha: sabado, inicio: "19:30", fin: "21:30", fuente: "google", protegido: true },
  ];

  const personas = [
    { nombre: "Adolfo", relacion: "hermano de la iglesia", sombrero: "iglesia" },
    { nombre: "Pastor Luis", relacion: "pastor", sombrero: "iglesia" },
    { nombre: "Marcos", relacion: "lo discipulas", sombrero: "iglesia", confidencial: true },
    { nombre: "Tu esposa", relacion: "esposa", sombrero: "personal" },
  ];

  return { proyectos, acciones, bandeja, eventos, personas };
}
