// ============================================================
// Fechas y horas, siempre en la zona de la persona
//
// Las fechas viajan como texto «AAAA-MM-DD» y las horas como «HH:MM».
// Se opera sobre ellas en UTC, donde no hay horario de verano ni
// medianoches que se corran; el «ahora» se lee en la zona de la persona.
//
// Nunca `toISOString()` para sacar una fecha: convierte a UTC y, en
// Panamá, a partir de las siete de la noche ya da el día siguiente.
// ============================================================

export const ZONA = "America/Panama";
const DIA_MS = 86_400_000;

export const DIAS = Object.freeze(["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]);
export const DIAS_CORTOS = Object.freeze(["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]);
export const MESES = Object.freeze([
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]);
export const MESES_CORTOS = Object.freeze(["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"]);

const dos = (n) => String(n).padStart(2, "0");

export const esFecha = (f) => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f);
export const esHora = (h) => typeof h === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);

/** «Hoy» en la zona, como AAAA-MM-DD. */
export function hoyEn(zona = ZONA, momento = new Date()) {
  // en-CA escribe justo AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(momento);
}

/** La hora en la zona, como HH:MM (de 00:00 a 23:59). */
export function horaEn(zona = ZONA, momento = new Date()) {
  const partes = new Intl.DateTimeFormat("en-GB", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(momento);
  const h = partes.find((p) => p.type === "hour")?.value ?? "00";
  const m = partes.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

export function partes(f) {
  return { anio: +f.slice(0, 4), mes: +f.slice(5, 7), dia: +f.slice(8, 10) };
}

const aMs = (f) => {
  const { anio, mes, dia } = partes(f);
  return Date.UTC(anio, mes - 1, dia);
};

/** Una fecha a partir de año, mes (1–12) y día; null si no existe (el 31 de abril). */
export function fecha(anio, mes, dia) {
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${anio}-${dos(mes)}-${dos(dia)}`;
}

export function deMs(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
}

export const sumarDias = (f, n) => deMs(aMs(f) + n * DIA_MS);

/** Días de `a` a `b`: positivo si `b` es posterior. */
export const diasEntre = (a, b) => Math.round((aMs(b) - aMs(a)) / DIA_MS);

/** 0 = domingo … 6 = sábado. */
export const diaSemana = (f) => new Date(aMs(f)).getUTCDay();

/** El lunes de la semana de `f` (las semanas empiezan en lunes). */
export const lunesDe = (f) => sumarDias(f, -((diaSemana(f) + 6) % 7));

export const diasDelMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

/** Suma meses sin desbordar: el 31 de enero + 1 mes es el 28 (o 29) de febrero. */
export function sumarMeses(f, n) {
  const { anio, mes, dia } = partes(f);
  const total = anio * 12 + (mes - 1) + n;
  const a = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return fecha(a, m, Math.min(dia, diasDelMes(a, m)));
}

export function minutos(h) {
  if (!esHora(h)) return NaN;
  return +h.slice(0, 2) * 60 + +h.slice(3, 5);
}

/** Minutos desde medianoche → «HH:MM» (se queda dentro del día). */
export function aHora(min) {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)));
  return `${dos(Math.floor(m / 60))}:${dos(m % 60)}`;
}

/** «19:00» → «7:00 p. m.» */
export function textoHora(h) {
  if (!esHora(h)) return "";
  const hh = +h.slice(0, 2);
  const sufijo = hh < 12 ? "a. m." : "p. m.";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${h.slice(3, 5)} ${sufijo}`;
}

/** «jue 5 nov», con el año si no es el de `hoy`. */
export function textoCorto(f, hoy = null) {
  const { anio, mes, dia } = partes(f);
  const base = `${DIAS_CORTOS[diaSemana(f)]} ${dia} ${MESES_CORTOS[mes - 1]}`;
  return hoy && partes(hoy).anio !== anio ? `${base} ${anio}` : base;
}

/** «hoy», «mañana», «ayer», «el jueves» (dentro de la semana que viene) o «jue 5 nov». */
export function textoFecha(f, hoy) {
  const d = diasEntre(hoy, f);
  if (d === 0) return "hoy";
  if (d === 1) return "mañana";
  if (d === -1) return "ayer";
  if (d > 1 && d < 7) return `el ${DIAS[diaSemana(f)]}`;
  return textoCorto(f, hoy);
}

/** «miércoles 4 de noviembre» */
export function textoLargo(f) {
  const { mes, dia } = partes(f);
  return `${DIAS[diaSemana(f)]} ${dia} de ${MESES[mes - 1]}`;
}
