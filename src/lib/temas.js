// ============================================================
// Nombre y color: candidatos para probar
//
// Juan aún no decide. El prototipo deja cambiar entre estos para verlos de
// verdad. El acento es el color de la aplicación (botones, lo activo) y no
// choca con los de los sombreros. Juancito Ads es azul (#1E90FF): ninguno
// de estos lo es, para saber al instante en qué aplicación se está.
// ============================================================

export const TEMAS = Object.freeze([
  {
    id: "atalaya",
    nombre: "Atalaya",
    acento: "#E8A93A",
    sobreAcento: "#1A1206",
    idea: "El vigía que vela desde temprano. «Sobre mi guarda estaré… Escribe la visión» (Habacuc 2:1-2): la visión y la vigilancia en un nombre.",
  },
  {
    id: "kairos",
    nombre: "Kairós",
    acento: "#22B8B0",
    sobreAcento: "#04201E",
    idea: "El tiempo oportuno. Es la palabra griega detrás de «aprovechando bien el tiempo» (Efesios 5:16).",
  },
  {
    id: "mayordomo",
    nombre: "Mayordomo",
    acento: "#E0703F",
    sobreAcento: "#200C04",
    idea: "El administrador fiel de lo que Dios confía, también del tiempo (Lucas 12:42; 1 Pedro 4:10). Ojo: en el habla diaria también es el sirviente de una casa.",
  },
  {
    id: "senda",
    nombre: "Senda",
    acento: "#E6DCC3",
    sobreAcento: "#1D1A12",
    idea: "«Lámpara es a mis pies tu palabra, y lumbrera a mi camino» (Salmo 119:105). Un camino claro, paso a paso.",
  },
]);

export const TEMA_BASE = "atalaya";
export const tema = (id) => TEMAS.find((t) => t.id === id) ?? TEMAS[0];

/** Otros nombres que se pueden considerar. */
export const OTROS_NOMBRES = Object.freeze(["Norte", "Talentos", "Diligente", "Redime", "Faro", "Primero lo primero"]);
