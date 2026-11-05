// ============================================================
// Los ajustes de la persona, con los valores de partida
//
// Salen de lo que Juan contó de su semana. Lo que es una suposición mía
// (la hora exacta a la que madruga, cuándo termina la jornada) va marcado
// en `porConfirmar` para que la pantalla lo pregunte en vez de darlo por
// hecho. Todo se puede mover.
// ============================================================

import { ZONA } from "./fechas.js";

// 0 = domingo … 6 = sábado.
export const AJUSTES_BASE = Object.freeze({
  nombre: "Juan",
  zona: ZONA,

  // Despertar y dormir: el día que se puede planear. Miércoles y sábado se madruga menos.
  dias: {
    0: { despierta: "06:30", duerme: "22:00" },
    1: { despierta: "04:45", duerme: "22:00" },
    2: { despierta: "04:45", duerme: "22:00" },
    3: { despierta: "06:00", duerme: "22:30" },
    4: { despierta: "04:45", duerme: "22:00" },
    5: { despierta: "04:45", duerme: "22:00" },
    6: { despierta: "06:15", duerme: "22:30" },
  },

  // Cuándo se trabaja en Juancito Ads. Lo del sombrero Trabajo se propone dentro; lo demás, fuera.
  jornadas: {
    trabajo: { dias: [1, 2, 3, 4, 5], desde: "09:00", hasta: "18:00" },
  },

  avisos: {
    // El resumen de la mañana sale DESPUÉS de la oración, nunca durante.
    resumen: { 0: "08:00", 1: "06:15", 2: "06:15", 3: "07:30", 4: "06:15", 5: "06:15", 6: "07:30" },
    // El cierre del día. Si cae dentro de algo protegido (la célula, un servicio), sale al terminar.
    cierre: "21:00",
    silencio: { desde: "22:00", hasta: "04:45" },
    // Ningún aviso suelto sale antes del resumen de ese día: lo que caiga antes, va dentro del resumen.
    // Avisos sueltos al día, como mucho. Lo que pase de ahí va al resumen.
    tope: 8,
    // Avisos a menos de estos minutos se juntan en un mensaje.
    agrupar: 10,
    // Domingo: sólo Iglesia y Personal (opcional).
    domingoSoloIglesiaYPersonal: false,
  },

  // La revisión semanal (GTD). El sábado, que no se madruga tanto.
  revision: { dia: 6, hora: "08:30", minutos: 30 },

  versiculos: {
    version: "RVR1960",
    // «normal»: en el resumen, el cierre, la revisión y al cumplir algo grande. «poco»: sólo resumen y revisión.
    frecuencia: "normal",
  },

  porConfirmar: [
    "La hora a la que madrugas (puse 4:45 los lunes, martes, jueves y viernes; 6:00 los miércoles y 6:15 los sábados).",
    "Cuánto dura tu oración de la mañana (puse una hora).",
    "A qué hora termina tu jornada (puse 6:00 p. m.).",
    "La hora de la planificación de la célula de los lunes (puse 8:00 p. m.).",
    "Cuánto duran los servicios y la célula (puse entre hora y media y dos horas y media).",
    "La hora de la grabación de los jueves (puse de 3:00 a 6:30 p. m.).",
  ],
});
