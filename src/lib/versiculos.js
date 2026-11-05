// ============================================================
// Los versículos del asistente: un banco cerrado, con su contexto
//
// La IA NUNCA cita la Biblia de memoria: escoge el `id` de un versículo de
// este banco y el código pone el texto exacto. Un modelo puede cambiar una
// palabra de un versículo sin que se note, y aquí eso no se permite.
//
// Cada versículo dice de dónde sale (su contexto), para qué SÍ se usa y
// para qué NO: un versículo fuera de contexto es justo lo que no se quiere.
// Los textos son de la Reina-Valera 1960 y están por revisar una vez contra
// la Biblia de Juan (`revisado`).
//
// Y se usa con medida: en el resumen de la mañana, en el cierre, en la
// revisión semanal y al cumplir algo grande. Nunca en un recordatorio, ni
// para reprochar lo que no se hizo: después de un mal día va la gracia
// (Lamentaciones 3:22-23), no el «perezoso» de Proverbios.
// ============================================================

import { sumarDias } from "./fechas.js";

export const ATRIBUCION =
  "Reina-Valera 1960 © Sociedades Bíblicas en América Latina, 1960. Renovado © Sociedades Bíblicas Unidas, 1988.";

/** Los momentos en que el asistente puede usar un versículo. */
export const MOMENTOS = Object.freeze({
  manana: "El resumen de la mañana",
  palabra: "La pausa del mediodía para leer la Palabra",
  planear: "Planear el día o la semana",
  empezar: "Empezar con tiempo un proyecto",
  constancia: "Seguir con algo que se repite (la célula, el discipulado, el ensayo)",
  delegar: "Sugerir delegar",
  vision: "Escribir la visión y las metas",
  revision: "La revisión semanal",
  logro: "Cumplir algo grande",
  gracia: "Después de un día que no salió como se planeó",
  descanso: "Cuando se trabaja de más, o el día de descanso",
});

export const VERSICULOS = Object.freeze([
  {
    id: "col-3-23",
    ref: "Colosenses 3:23",
    texto: "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres;",
    momentos: ["manana", "logro"],
    contexto: "Pablo escribe a los siervos de las casas cristianas: el trabajo de cada día se hace para Cristo, que es quien recompensa (v. 24).",
    usarPara: "Dar sentido y excelencia al trabajo ordinario, también al de la agencia.",
    noUsarPara: "Exigir más horas o justificar trabajar de más.",
  },
  {
    id: "pro-21-5",
    ref: "Proverbios 21:5",
    texto: "Los pensamientos del diligente ciertamente tienden a la abundancia; Mas todo el que se apresura alocadamente, de cierto va a la pobreza.",
    momentos: ["planear", "revision"],
    contexto: "Un proverbio: planear con cuidado frente a actuar con prisa. Es un principio de sabiduría, no una promesa garantizada.",
    usarPara: "Animar a planear la semana y no ir apagando fuegos.",
    noUsarPara: "Prometer resultados económicos.",
  },
  {
    id: "pro-16-3",
    ref: "Proverbios 16:3",
    texto: "Encomienda a Jehová tus obras, Y tus pensamientos serán afirmados.",
    momentos: ["manana", "planear"],
    contexto: "Proverbios 16:1-9 habla de los planes del hombre bajo la soberanía de Dios.",
    usarPara: "Entregar a Dios el plan del día o de la semana.",
    noUsarPara: "Dar por bendecido cualquier plan sin examinarlo.",
  },
  {
    id: "pro-16-9",
    ref: "Proverbios 16:9",
    texto: "El corazón del hombre piensa su camino; Mas Jehová endereza sus pasos.",
    momentos: ["planear", "gracia"],
    contexto: "Planear es bueno; quien dirige los pasos es Dios.",
    usarPara: "Cuando el plan cambia y hay que reprogramar, sin frustración.",
    noUsarPara: "Excusar no planear.",
  },
  {
    id: "hab-2-2",
    ref: "Habacuc 2:2",
    texto: "Y Jehová me respondió, y dijo: Escribe la visión, y declárala en tablas, para que corra el que leyere en ella.",
    momentos: ["vision", "revision"],
    contexto: "Dios responde al profeta y le manda escribir la revelación con claridad, para que se proclame y se espere con fe (v. 3).",
    usarPara: "Aplicado con prudencia: el valor de escribir con claridad lo que Dios ha puesto en el corazón para cada área.",
    noUsarPara: "Presentar cualquier meta personal como una revelación de Dios.",
  },
  {
    id: "gal-6-9",
    ref: "Gálatas 6:9",
    texto: "No nos cansemos, pues, de hacer bien; porque a su tiempo segaremos, si no desmayamos.",
    momentos: ["constancia", "revision"],
    contexto: "Sembrar para el Espíritu y hacer bien a todos, en especial a la familia de la fe (v. 10).",
    usarPara: "La constancia en la célula, el discipulado y el servicio.",
    noUsarPara: "Prometer que todo esfuerzo dará fruto pronto.",
  },
  {
    id: "sal-90-12",
    ref: "Salmo 90:12",
    texto: "Enséñanos de tal modo a contar nuestros días, Que traigamos al corazón sabiduría.",
    momentos: ["revision", "manana"],
    contexto: "Oración de Moisés sobre lo breve de la vida frente a la eternidad de Dios.",
    usarPara: "Valorar el tiempo y escoger lo que importa.",
    noUsarPara: "Generar angustia por el tiempo.",
  },
  {
    id: "efe-5-15-16",
    ref: "Efesios 5:15-16",
    texto: "Mirad, pues, con diligencia cómo andéis, no como necios sino como sabios, aprovechando bien el tiempo, porque los días son malos.",
    momentos: ["planear", "manana", "revision"],
    contexto: "Andar como hijos de luz; «aprovechar el tiempo» es aprovechar la oportunidad (kairós) entendiendo la voluntad del Señor (v. 17).",
    usarPara: "Escoger prioridades y decir que no a lo de poco valor.",
    noUsarPara: "Presionar con productividad sin pensar en la voluntad de Dios.",
  },
  {
    id: "mar-1-35",
    ref: "Marcos 1:35",
    texto: "Levantándose muy de mañana, siendo aún muy oscuro, salió y se fue a un lugar desierto, y allí oraba.",
    momentos: ["manana"],
    contexto: "Tras un día lleno de sanidades en Capernaúm, Jesús ora antes de seguir; después decide ir a otros lugares (v. 38): la oración ordena las prioridades.",
    usarPara: "Los días en que se madruga a orar.",
    noUsarPara: "Hacer sentir mal los días en que no se madruga.",
  },
  {
    id: "lam-3-22-23",
    ref: "Lamentaciones 3:22-23",
    texto: "Por la misericordia de Jehová no hemos sido consumidos, porque nunca decayeron sus misericordias. Nuevas son cada mañana; grande es tu fidelidad.",
    momentos: ["gracia", "manana"],
    contexto: "Un lamento por la caída de Jerusalén que, en medio del dolor, se aferra a la fidelidad de Dios.",
    usarPara: "Empezar de nuevo después de un día que no salió, sin culpa.",
    noUsarPara: "Minimizar algo serio que la persona está viviendo.",
  },
  {
    id: "sal-127-2",
    ref: "Salmo 127:2",
    texto: "Por demás es que os levantéis de madrugada, y vayáis tarde a reposar, Y que comáis pan de dolores; Pues que a su amado dará Dios el sueño.",
    momentos: ["descanso"],
    contexto: "Si Jehová no edifica la casa, en vano trabajan los que la edifican (v. 1): el afán ansioso no reemplaza la provisión de Dios.",
    usarPara: "Cuando se trabaja de más o se duerme poco por afán.",
    noUsarPara: "Desanimar la oración de madrugada: el salmo habla del afán, no de buscar a Dios temprano.",
  },
  {
    id: "mat-6-33",
    ref: "Mateo 6:33",
    texto: "Mas buscad primeramente el reino de Dios y su justicia, y todas estas cosas os serán añadidas.",
    momentos: ["manana", "planear"],
    contexto: "En el Sermón del Monte, contra la ansiedad por la comida y el vestido (6:25-34).",
    usarPara: "Poner primero lo de Dios en el día y en la semana.",
    noUsarPara: "Prometer prosperidad material.",
  },
  {
    id: "1co-15-58",
    ref: "1 Corintios 15:58",
    texto: "Así que, hermanos míos amados, estad firmes y constantes, creciendo en la obra del Señor siempre, sabiendo que vuestro trabajo en el Señor no es en vano.",
    momentos: ["constancia", "logro"],
    contexto: "La conclusión del capítulo de la resurrección: porque Cristo resucitó, el trabajo para el Señor tiene sentido eterno.",
    usarPara: "La constancia en el ministerio: la célula, los discipulados, el servicio.",
    noUsarPara: "Sacralizar cualquier tarea de negocio.",
  },
  {
    id: "exo-18-18",
    ref: "Éxodo 18:18",
    texto: "Desfallecerás del todo, tú, y también este pueblo que está contigo; porque el trabajo es demasiado pesado para ti; no podrás hacerlo tú solo.",
    momentos: ["delegar", "descanso"],
    contexto: "Jetró aconseja a Moisés repartir el trabajo entre hombres capaces (vv. 21-22).",
    usarPara: "Sugerir delegar cuando la carga es demasiada.",
    noUsarPara: "Insinuar que la persona es incapaz.",
  },
  {
    id: "hch-6-3-4",
    ref: "Hechos 6:3-4",
    texto: "Buscad, pues, hermanos, de entre vosotros a siete varones de buen testimonio, llenos del Espíritu Santo y de sabiduría, a quienes encarguemos de este trabajo. Y nosotros persistiremos en la oración y en el ministerio de la palabra.",
    momentos: ["delegar"],
    contexto: "Los apóstoles delegan la atención de las viudas en personas capaces para no descuidar su llamado.",
    usarPara: "Delegar para proteger lo que sólo uno puede hacer.",
    noUsarPara: "Menospreciar las tareas que se delegan.",
  },
  {
    id: "luc-16-10",
    ref: "Lucas 16:10",
    texto: "El que es fiel en lo muy poco, también en lo más es fiel; y el que en lo muy poco es injusto, también en lo más es injusto.",
    momentos: ["logro", "constancia"],
    contexto: "Tras la parábola del mayordomo infiel: la fidelidad en lo pequeño muestra la fidelidad en lo grande.",
    usarPara: "Valorar las tareas pequeñas hechas bien, día tras día.",
    noUsarPara: "Juzgar a la persona por una tarea olvidada.",
  },
  {
    id: "ecl-9-10",
    ref: "Eclesiastés 9:10",
    texto: "Todo lo que te viniere a la mano para hacer, hazlo según tus fuerzas; porque en el Seol, adonde vas, no hay obra, ni trabajo, ni ciencia, ni sabiduría.",
    momentos: ["manana"],
    contexto: "El Predicador invita a vivir y trabajar con entrega la vida presente, que es breve.",
    usarPara: "Hacer con empeño lo de hoy.",
    noUsarPara: "Generar miedo a la muerte.",
  },
  {
    id: "rom-12-11",
    ref: "Romanos 12:11",
    texto: "En lo que requiere diligencia, no perezosos; fervientes en espíritu, sirviendo al Señor;",
    momentos: ["manana", "constancia"],
    contexto: "Parte de las exhortaciones al amor sincero y la vida en el cuerpo de Cristo (12:9-13).",
    usarPara: "El servicio en la iglesia hecho con diligencia y fervor.",
    noUsarPara: "Llamar perezosa a la persona.",
  },
  {
    id: "fil-3-13-14",
    ref: "Filipenses 3:13-14",
    texto: "Hermanos, yo mismo no pretendo haberlo ya alcanzado; pero una cosa hago: olvidando ciertamente lo que queda atrás, y extendiéndome a lo que está delante, prosigo a la meta, al premio del supremo llamamiento de Dios en Cristo Jesús.",
    momentos: ["gracia", "revision"],
    contexto: "Pablo habla de conocer a Cristo y de la resurrección: su meta es Cristo, no un logro personal.",
    usarPara: "Dejar atrás una semana difícil y seguir.",
    noUsarPara: "Presentar una meta de negocio como «el premio».",
  },
  {
    id: "mar-6-31",
    ref: "Marcos 6:31",
    texto: "Él les dijo: Venid vosotros aparte a un lugar desierto, y descansad un poco. Porque eran muchos los que iban y venían, de manera que ni aun tenían tiempo para comer.",
    momentos: ["descanso"],
    contexto: "Los discípulos vuelven de la misión y Jesús los invita a descansar con Él.",
    usarPara: "Un día cargado de ministerio, o el día de descanso.",
    noUsarPara: "Justificar dejar compromisos sin avisar.",
  },
  {
    id: "stg-4-15",
    ref: "Santiago 4:15",
    texto: "En lugar de lo cual deberíais decir: Si el Señor quiere, viviremos y haremos esto o aquello.",
    momentos: ["planear"],
    contexto: "Contra la jactancia de quien planea negocios como si el mañana le perteneciera (4:13-17).",
    usarPara: "Planear con humildad.",
    noUsarPara: "Desanimar la planificación.",
  },
  {
    id: "luc-14-28",
    ref: "Lucas 14:28",
    texto: "Porque ¿quién de vosotros, queriendo edificar una torre, no se sienta primero y calcula los gastos, a ver si tiene lo que necesita para acabarla?",
    momentos: ["planear"],
    contexto: "Jesús habla del costo de seguirle; la ilustración usa el sentido común de calcular antes de construir.",
    usarPara: "Antes de aceptar un compromiso nuevo, o cuando el día está sobrecargado: calcular si cabe.",
    noUsarPara: "Reducir el discipulado a una cuestión de agenda.",
  },
  {
    id: "1co-14-40",
    ref: "1 Corintios 14:40",
    texto: "pero hágase todo decentemente y con orden.",
    momentos: ["planear"],
    contexto: "Pablo pide orden en las reuniones de la iglesia.",
    usarPara: "Preparar con orden la célula o un servicio.",
    noUsarPara: "Imponer rigidez en cualquier área.",
  },
  {
    id: "pro-13-4",
    ref: "Proverbios 13:4",
    texto: "El alma del perezoso desea, y nada alcanza; Mas el alma de los diligentes será prosperada.",
    momentos: ["empezar"],
    contexto: "Un proverbio: desear sin actuar frente a la diligencia que da el primer paso.",
    usarPara: "Animar a dar el primer paso de un proyecto con fecha.",
    noUsarPara: "Reprochar lo que no se hizo ni llamar perezosa a la persona.",
  },
  {
    id: "pro-6-6",
    ref: "Proverbios 6:6",
    texto: "Ve a la hormiga, oh perezoso, Mira sus caminos, y sé sabio;",
    momentos: ["empezar"],
    contexto: "La hormiga prepara en el verano sin que nadie la mande (vv. 7-8).",
    usarPara: "Preparar con tiempo, sin que nadie lo exija (hablando de la hormiga, no de la persona).",
    noUsarPara: "Dirigirle a la persona la palabra «perezoso».",
  },
  {
    id: "pro-27-23",
    ref: "Proverbios 27:23",
    texto: "Sé diligente en conocer el estado de tus ovejas, Y mira con cuidado por tus rebaños;",
    momentos: ["revision"],
    contexto: "Consejo al pastor o ganadero: cuidar el sustento, porque la riqueza no dura para siempre (v. 24).",
    usarPara: "La revisión semanal, y con prudencia, el cuidado de las personas de la célula.",
    noUsarPara: "Tratar a las personas como recursos.",
  },
  {
    id: "mat-25-21",
    ref: "Mateo 25:21",
    texto: "Y su señor le dijo: Bien, buen siervo y fiel; sobre poco has sido fiel, sobre mucho te pondré; entra en el gozo de tu señor.",
    momentos: ["logro"],
    contexto: "La parábola de los talentos: la mayordomía fiel mientras el Señor vuelve.",
    usarPara: "Celebrar la fidelidad en lo que se terminó.",
    noUsarPara: "Hablar como si el asistente fuera quien aprueba a la persona.",
  },
  {
    id: "mat-11-28",
    ref: "Mateo 11:28",
    texto: "Venid a mí todos los que estáis trabajados y cargados, y yo os haré descansar.",
    momentos: ["descanso", "gracia"],
    contexto: "La invitación de Jesús a los cansados y cargados a encontrar descanso en Él.",
    usarPara: "Una semana pesada.",
    noUsarPara: "Evitar una conversación necesaria sobre la carga de trabajo.",
  },
  {
    id: "sal-119-105",
    ref: "Salmo 119:105",
    texto: "Lámpara es a mis pies tu palabra, Y lumbrera a mi camino.",
    momentos: ["palabra"],
    contexto: "El salmo de la Palabra: la ley de Dios guía la vida diaria.",
    usarPara: "La pausa del mediodía para leer la Palabra.",
    noUsarPara: "—",
  },
  {
    id: "1pe-4-10",
    ref: "1 Pedro 4:10",
    texto: "Cada uno según el don que ha recibido, minístrelo a los otros, como buenos administradores de la multiforme gracia de Dios.",
    momentos: ["manana", "logro"],
    contexto: "Servir con los dones en la iglesia, como administradores de la gracia (4:7-11).",
    usarPara: "La vida artística y el servicio: los dones son para servir.",
    noUsarPara: "Medir el valor de la persona por su talento.",
  },
].map((v) => Object.freeze({ ...v, version: "RVR1960", revisado: false })));

/** Versículos que se citan mucho fuera de contexto. El asistente no los usa para motivar. */
export const FUERA_DE_CONTEXTO = Object.freeze([
  {
    ref: "Jeremías 29:11",
    porQue: "Es una carta a los exiliados en Babilonia y una promesa al pueblo, después de setenta años (v. 10). No es una garantía de que un plan personal salga bien.",
  },
  {
    ref: "Filipenses 4:13",
    porQue: "Pablo habla de estar contento en la abundancia y en la escasez (vv. 11-12). No dice que se pueda lograr cualquier meta.",
  },
  {
    ref: "Proverbios 29:18",
    porQue: "«Sin profecía el pueblo se desenfrena»: habla de la revelación de Dios y de su ley, no de la «visión» de metas personales.",
  },
]);

export const versiculo = (id) => VERSICULOS.find((v) => v.id === id) ?? null;

/** ¿Va un versículo en este momento? Según la frecuencia escogida. Nunca en recordatorios ni en «¿la completaste?». */
export function tocaVersiculo(momento, frecuencia = "normal") {
  if (frecuencia === "nunca") return false;
  if (frecuencia === "poco") return ["manana", "revision"].includes(momento);
  return ["manana", "palabra", "revision", "logro", "gracia", "descanso", "vision", "empezar", "delegar", "constancia", "planear"].includes(momento);
}

/** Días sin repetir el mismo versículo. */
export const SIN_REPETIR_DIAS = 30;

function hash(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Un versículo para ese momento: de los que encajan, uno que no haya salido en los últimos 30 días (si todos salieron,
 * el que lleva más tiempo sin salir). Determinista con el día y el momento: el mismo resumen dice lo mismo si se
 * vuelve a pedir.
 *   historial: [{ id, dia }]
 */
export function elegirVersiculo({ momento, hoy, historial = [], frecuencia = "normal" }) {
  if (!tocaVersiculo(momento, frecuencia)) return null;
  const candidatos = VERSICULOS.filter((v) => v.momentos.includes(momento));
  if (!candidatos.length) return null;
  const ultimo = new Map();
  for (const h of historial) if (!ultimo.has(h.id) || ultimo.get(h.id) < h.dia) ultimo.set(h.id, h.dia);
  const limite = sumarDias(hoy, -SIN_REPETIR_DIAS);
  const libres = candidatos.filter((v) => !ultimo.has(v.id) || ultimo.get(v.id) < limite);
  if (libres.length) return libres[hash(`${hoy}|${momento}`) % libres.length];
  return [...candidatos].sort((a, b) => String(ultimo.get(a.id)).localeCompare(String(ultimo.get(b.id))))[0];
}

/** Lo que el agente lee del banco: sólo ids, referencias, momentos y cuándo usarlos (el texto lo pone el código). */
export function bancoParaElAgente() {
  return VERSICULOS.map((v) => `${v.id} · ${v.ref} · momentos: ${v.momentos.join(", ")} · úsalo para: ${v.usarPara} · NO para: ${v.noUsarPara}`).join("\n");
}
