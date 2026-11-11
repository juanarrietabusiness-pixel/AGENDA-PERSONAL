import { useState } from "react";
import Icon from "./Icon.jsx";
import { estiloDe } from "../lib/sombreros.js";
import { MESES, partes, sumarMeses, textoLargo } from "../lib/fechas.js";
import { semanasDelMes } from "../lib/rejilla.js";
import { marcasDeDias } from "../lib/agenda.js";

const INICIALES = ["L", "M", "X", "J", "V", "S", "D"];

/**
 * El mes chico del menú (como el de Google Calendar): hoy resaltado y un puntito de color el día que tiene algo especial o
 * una reunión que no se repite. Tocar un día lleva a ese día en Plan.
 */
export default function MiniMes({ estado, hoy, sombreros, onDia }) {
  const [mes, setMes] = useState(() => `${hoy.slice(0, 8)}01`);
  const semanas = semanasDelMes(mes);
  const desde = semanas[0][0];
  const hasta = semanas.at(-1)[6];
  const marcas = marcasDeDias(estado, desde, hasta);
  const { mes: m, anio } = partes(mes);

  return (
    <div className="mini-mes">
      <div className="mini-mes-cabeza">
        <strong>{MESES[m - 1]} {anio}</strong>
        <button type="button" onClick={() => setMes(sumarMeses(mes, -1))} aria-label="Mes anterior"><Icon name="chevronLeft" size={15} /></button>
        <button type="button" onClick={() => setMes(sumarMeses(mes, 1))} aria-label="Mes siguiente"><Icon name="chevronRight" size={15} /></button>
      </div>
      <table className="mini-mes-tabla">
        <thead>
          <tr>{INICIALES.map((d) => <th key={d} scope="col" aria-hidden="true">{d}</th>)}</tr>
        </thead>
        <tbody>
          {semanas.map((semana) => (
            <tr key={semana[0]}>
              {semana.map((d) => {
                const cosas = marcas[d] ?? [];
                const fuera = partes(d).mes !== m;
                return (
                  <td key={d}>
                    <button
                      type="button"
                      className={`${d === hoy ? "es-hoy" : ""}${fuera ? " fuera" : ""}`}
                      onClick={() => onDia(d)}
                      title={cosas.length ? cosas.map((c) => c.titulo).join(" · ") : undefined}
                      aria-label={`${textoLargo(d)}${cosas.length ? `: ${cosas.map((c) => c.titulo).join(", ")}` : ""}`}
                    >
                      {partes(d).dia}
                      {cosas.length > 0 && (
                        <span className="mini-puntos" aria-hidden="true">
                          {cosas.slice(0, 3).map((c, i) => <span key={i} className={`mini-punto mp-${c.tipo}`} style={c.color ? { "--s": c.color } : estiloDe(c.sombrero, sombreros)} />)}
                        </span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
