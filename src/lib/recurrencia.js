// ============================================================
// Lo que se repite, con el estándar de los calendarios (RFC 5545)
//
// Una regla es la misma que entiende Google Calendar: «FREQ=WEEKLY;BYDAY=TH»
// es la célula de los jueves, «FREQ=WEEKLY;INTERVAL=2;BYDAY=MO» es cada
// quince días, «FREQ=MONTHLY;BYDAY=-1FR» es el último viernes del mes. Así
// una reunión que se repite viaja a Google y vuelve sin traducirse, y no hay
// un formato propio que se quede corto el día que haga falta otra cosa.
//
// Se entiende el subconjunto que usa una agenda personal: FREQ (DAILY,
// WEEKLY, MONTHLY, YEARLY), INTERVAL, BYDAY (con ordinal en los meses:
// 2TU, -1FR), BYMONTHDAY (también negativo: -1 es el último día), BYMONTH,
// COUNT y UNTIL. Las semanas empiezan en lunes (WKST=MO). Lo que no se
// entiende se rechaza diciendo qué es: mejor eso que repetir mal.
//
// Dos maneras de repetir una TAREA (las de Todoist, Things u OmniFocus):
//   · «calendario»: toca en su fecha aunque la anterior se hiciera tarde
//     (preparar el tema de la célula, cada lunes);
//   · «después»: la siguiente cuenta desde que se HIZO (cambiar el filtro
//     del agua cada 3 meses: si se hizo tarde, la próxima se corre).
// ============================================================

import { partes, fecha, sumarDias, diaSemana, lunesDe, diasDelMes, sumarMeses, esFecha, MESES, DIAS, textoCorto } from "./fechas.js";

export const CODIGOS = Object.freeze(["SU", "MO", "TU", "WE", "TH", "FR", "SA"]);
const FRECUENCIAS = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];
const MAX_OCURRENCIAS = 1000;
const MAX_VUELTAS = 5000;

export class ErrorRegla extends Error {}

/** «FREQ=WEEKLY;BYDAY=TH» → objeto. Lanza ErrorRegla si algo no se entiende. */
export function leerRegla(texto) {
  if (texto && typeof texto === "object") return texto;
  const limpio = String(texto ?? "").trim().replace(/^RRULE:/i, "");
  if (!limpio) throw new ErrorRegla("La regla está vacía.");
  const regla = { freq: null, intervalo: 1, porDia: [], porDiaMes: [], porMes: [], cuenta: null, hasta: null };
  for (const trozo of limpio.split(";")) {
    if (!trozo) continue;
    const [clave, valor = ""] = trozo.split("=");
    const k = clave.toUpperCase();
    const v = valor.toUpperCase();
    if (k === "FREQ") {
      if (!FRECUENCIAS.includes(v)) throw new ErrorRegla(`No sé repetir con FREQ=${valor}.`);
      regla.freq = v;
    } else if (k === "INTERVAL") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 1000) throw new ErrorRegla(`INTERVAL=${valor} no es un número válido.`);
      regla.intervalo = n;
    } else if (k === "BYDAY") {
      regla.porDia = v.split(",").map((d) => {
        const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(d);
        if (!m) throw new ErrorRegla(`BYDAY=${d} no es un día.`);
        const n = m[1] ? Number(m[1]) : null;
        if (n !== null && (n === 0 || Math.abs(n) > 5)) throw new ErrorRegla(`BYDAY=${d}: el ordinal va de -5 a 5.`);
        return { dia: CODIGOS.indexOf(m[2]), n };
      });
    } else if (k === "BYMONTHDAY") {
      regla.porDiaMes = v.split(",").map((d) => {
        const n = Number(d);
        if (!Number.isInteger(n) || n === 0 || Math.abs(n) > 31) throw new ErrorRegla(`BYMONTHDAY=${d} no es un día del mes.`);
        return n;
      });
    } else if (k === "BYMONTH") {
      regla.porMes = v.split(",").map((d) => {
        const n = Number(d);
        if (!Number.isInteger(n) || n < 1 || n > 12) throw new ErrorRegla(`BYMONTH=${d} no es un mes.`);
        return n;
      });
    } else if (k === "COUNT") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1) throw new ErrorRegla(`COUNT=${valor} no es válido.`);
      regla.cuenta = n;
    } else if (k === "UNTIL") {
      const m = /^(\d{4})(\d{2})(\d{2})/.exec(v);
      if (!m) throw new ErrorRegla(`UNTIL=${valor} no es una fecha.`);
      regla.hasta = `${m[1]}-${m[2]}-${m[3]}`;
    } else if (k === "WKST") {
      if (v !== "MO") throw new ErrorRegla("Las semanas empiezan en lunes (WKST=MO).");
    } else {
      throw new ErrorRegla(`No sé qué es ${clave}.`);
    }
  }
  if (!regla.freq) throw new ErrorRegla("Falta FREQ.");
  if (regla.freq === "WEEKLY" || regla.freq === "DAILY") {
    if (regla.porDia.some((d) => d.n !== null)) throw new ErrorRegla("Un ordinal (2TU, -1FR) sólo vale en reglas mensuales o anuales.");
  }
  return regla;
}

/** El objeto otra vez como texto RRULE. */
export function escribirRegla(r) {
  const out = [`FREQ=${r.freq}`];
  if (r.intervalo > 1) out.push(`INTERVAL=${r.intervalo}`);
  if (r.porDia?.length) out.push(`BYDAY=${r.porDia.map((d) => `${d.n ?? ""}${CODIGOS[d.dia]}`).join(",")}`);
  if (r.porDiaMes?.length) out.push(`BYMONTHDAY=${r.porDiaMes.join(",")}`);
  if (r.porMes?.length) out.push(`BYMONTH=${r.porMes.join(",")}`);
  if (r.cuenta) out.push(`COUNT=${r.cuenta}`);
  if (r.hasta) out.push(`UNTIL=${r.hasta.replace(/-/g, "")}`);
  return out.join(";");
}

/** Los días de un mes que cumplen la regla (ordenados). */
function diasDelMesSegun(r, anio, mes, inicio) {
  const total = diasDelMes(anio, mes);
  const salida = new Set();
  if (r.porDiaMes.length) {
    for (const n of r.porDiaMes) {
      const d = n > 0 ? n : total + 1 + n;
      if (d >= 1 && d <= total) salida.add(d);
    }
  } else if (r.porDia.length) {
    for (const { dia, n } of r.porDia) {
      const coinciden = [];
      for (let d = 1; d <= total; d++) if (diaSemana(fecha(anio, mes, d)) === dia) coinciden.push(d);
      if (n === null) coinciden.forEach((d) => salida.add(d));
      else {
        const d = n > 0 ? coinciden[n - 1] : coinciden[coinciden.length + n];
        if (d) salida.add(d);
      }
    }
  } else {
    // Sin BY*: el mismo día del mes que la primera. Un mes sin ese día se salta (RFC 5545).
    const d = partes(inicio).dia;
    if (d <= total) salida.add(d);
  }
  return [...salida].sort((a, b) => a - b).map((d) => fecha(anio, mes, d));
}

/** Los candidatos de un periodo (un día, una semana, un mes o un año), en orden. */
function candidatosDelPeriodo(r, k, inicio) {
  const { anio, mes } = partes(inicio);
  if (r.freq === "DAILY") {
    const d = sumarDias(inicio, k * r.intervalo);
    if (r.porDia.length && !r.porDia.some((x) => x.dia === diaSemana(d))) return [];
    return [d];
  }
  if (r.freq === "WEEKLY") {
    const lunes = sumarDias(lunesDe(inicio), k * 7 * r.intervalo);
    const dias = r.porDia.length ? r.porDia.map((x) => x.dia) : [diaSemana(inicio)];
    return [...new Set(dias)]
      .map((d) => sumarDias(lunes, (d + 6) % 7))
      .sort();
  }
  if (r.freq === "MONTHLY") {
    const primero = sumarMeses(fecha(anio, mes, 1), k * r.intervalo);
    const p = partes(primero);
    return diasDelMesSegun(r, p.anio, p.mes, inicio);
  }
  // YEARLY
  const a = anio + k * r.intervalo;
  const meses = r.porMes.length ? r.porMes : [mes];
  const salida = [];
  for (const m of [...meses].sort((x, y) => x - y)) {
    if (!r.porDiaMes.length && !r.porDia.length) {
      const d = fecha(a, m, partes(inicio).dia);
      if (d) salida.push(d);
    } else {
      salida.push(...diasDelMesSegun(r, a, m, inicio));
    }
  }
  return salida;
}

/**
 * Las fechas en que toca, desde `desde` hasta `hasta` (incluidas). `inicio` es la primera
 * vez: nada sale antes, y COUNT cuenta desde ahí aunque `desde` sea posterior.
 */
export function ocurrencias(regla, inicio, desde, hasta, { max = MAX_OCURRENCIAS } = {}) {
  const r = leerRegla(regla);
  if (!esFecha(inicio) || !esFecha(desde) || !esFecha(hasta)) throw new ErrorRegla("Las fechas van como AAAA-MM-DD.");
  const salida = [];
  let contadas = 0;
  for (let k = 0; k < MAX_VUELTAS; k++) {
    const candidatos = candidatosDelPeriodo(r, k, inicio);
    // Si el periodo entero ya pasó del final, no queda nada que buscar.
    const primeroDelPeriodo = candidatos[0];
    for (const d of candidatos) {
      if (d < inicio) continue;
      if (r.hasta && d > r.hasta) return salida;
      contadas++;
      if (r.cuenta && contadas > r.cuenta) return salida;
      if (d > hasta) return salida;
      if (d >= desde) {
        salida.push(d);
        if (salida.length >= max) return salida;
      }
    }
    if (primeroDelPeriodo && primeroDelPeriodo > hasta) return salida;
    if (!candidatos.length && periodoPasado(r, k, inicio, hasta)) return salida;
  }
  return salida;
}

// Un periodo vacío (el 31 en un mes de 30) no dice si ya se pasó del final: se mira el periodo en sí.
function periodoPasado(r, k, inicio, hasta) {
  const { anio, mes } = partes(inicio);
  if (r.freq === "DAILY") return sumarDias(inicio, k * r.intervalo) > hasta;
  if (r.freq === "WEEKLY") return sumarDias(lunesDe(inicio), k * 7 * r.intervalo) > hasta;
  if (r.freq === "MONTHLY") return sumarMeses(fecha(anio, mes, 1), k * r.intervalo) > hasta;
  return `${anio + k * r.intervalo}-01-01` > hasta;
}

/** ¿Toca en `dia`? */
export const tocaEl = (regla, inicio, dia) => dia >= inicio && ocurrencias(regla, inicio, dia, dia).length === 1;

/** La primera vez que toca DESPUÉS de `despuesDe` (o null si la regla ya terminó). Busca hasta 6 años. */
export function siguiente(regla, inicio, despuesDe) {
  const desde = sumarDias(despuesDe < inicio ? sumarDias(inicio, -1) : despuesDe, 1);
  const [d] = ocurrencias(regla, inicio, desde, sumarDias(desde, 366 * 6), { max: 1 });
  return d ?? null;
}

/** Repetir «después de hacerla»: la próxima cuenta desde el día en que se hizo. */
export function siguienteDespuesDeHecha(regla, hechaEl) {
  const r = leerRegla(regla);
  if (r.freq === "DAILY") return sumarDias(hechaEl, r.intervalo);
  if (r.freq === "WEEKLY") return sumarDias(hechaEl, 7 * r.intervalo);
  if (r.freq === "MONTHLY") return sumarMeses(hechaEl, r.intervalo);
  return sumarMeses(hechaEl, 12 * r.intervalo);
}

// ------------------------------------------------------------
// En palabras, para que se lea sin saber qué es una RRULE
// ------------------------------------------------------------

const ORDINALES = { 1: "primer", 2: "segundo", 3: "tercer", 4: "cuarto", 5: "quinto", "-1": "último", "-2": "penúltimo" };
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

function lista(xs) {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
}

const numero = (n) => ({ 2: "dos", 3: "tres", 4: "cuatro", 6: "seis" }[n] ?? String(n));

function diasDeSemana(porDia) {
  const dias = [...new Set(porDia.map((d) => d.dia))].sort((a, b) => ORDEN_SEMANA.indexOf(a) - ORDEN_SEMANA.indexOf(b));
  if (dias.length === 5 && [1, 2, 3, 4, 5].every((d) => dias.includes(d))) return { laborables: true, texto: "de lunes a viernes" };
  return { laborables: false, texto: lista(dias.map((d) => DIAS[d])) };
}

function diaEnElMes(r) {
  if (r.porDiaMes.length) {
    return lista(r.porDiaMes.map((n) => (n === -1 ? "el último día" : n < 0 ? `el día ${Math.abs(n)} antes del final` : `el día ${n}`)));
  }
  if (r.porDia.length) {
    return lista(r.porDia.map(({ dia, n }) => (n === null ? `cada ${DIAS[dia]}` : `el ${ORDINALES[n] ?? `${n}.º`} ${DIAS[dia]}`)));
  }
  return null;
}

/** «Cada jueves», «Cada dos semanas, el lunes», «Cada mes, el último viernes», «Cada año, el 12 de marzo». */
export function describir(regla, inicio = null) {
  const r = leerRegla(regla);
  let texto;
  if (r.freq === "DAILY") {
    if (r.porDia.length) {
      const { laborables, texto: t } = diasDeSemana(r.porDia);
      texto = laborables ? "De lunes a viernes" : `Cada ${t}`;
    } else texto = r.intervalo === 1 ? "Cada día" : `Cada ${numero(r.intervalo)} días`;
  } else if (r.freq === "WEEKLY") {
    const dias = r.porDia.length ? r.porDia : inicio ? [{ dia: diaSemana(inicio), n: null }] : [];
    const { laborables, texto: t } = diasDeSemana(dias);
    if (r.intervalo === 1) texto = laborables ? "De lunes a viernes" : dias.length ? `Cada ${t}` : "Cada semana";
    else texto = `Cada ${numero(r.intervalo)} semanas${dias.length ? `, el ${t}` : ""}`;
  } else if (r.freq === "MONTHLY") {
    const cuando = diaEnElMes(r) ?? (inicio ? `el día ${partes(inicio).dia}` : null);
    texto = `${r.intervalo === 1 ? "Cada mes" : `Cada ${numero(r.intervalo)} meses`}${cuando ? `, ${cuando}` : ""}`;
  } else {
    const meses = r.porMes.length ? r.porMes : inicio ? [partes(inicio).mes] : [];
    const dia = diaEnElMes(r) ?? (inicio ? `el ${partes(inicio).dia}` : "");
    const deMeses = meses.length ? ` de ${lista(meses.map((m) => MESES[m - 1]))}` : "";
    texto = `${r.intervalo === 1 ? "Cada año" : `Cada ${numero(r.intervalo)} años`}${dia ? `, ${dia}${deMeses}` : deMeses}`;
  }
  if (r.cuenta) texto += `, ${r.cuenta} ${r.cuenta === 1 ? "vez" : "veces"}`;
  if (r.hasta) texto += `, hasta el ${textoCorto(r.hasta)}`;
  return texto;
}
