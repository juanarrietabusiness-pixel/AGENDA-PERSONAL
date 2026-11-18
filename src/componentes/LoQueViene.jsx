import { useState } from "react";
import Icon from "./Icon.jsx";
import { estiloDe } from "../lib/sombreros.js";
import { textoCorto, horaCorta } from "../lib/fechas.js";

/**
 * «Lo que viene»: lo especial, las reuniones y los eventos que no se repiten y los recordatorios de una sola vez de las
 * próximas semanas, por día (`marcasDeDias`). Lo usan el panel de Plan y la agenda de Hoy.
 */
export default function LoQueViene({ marcas, hoy, sombreros, onAbrir, onDia, onMes = null, max = 5, vacio = "Nada especial en las próximas semanas." }) {
  const [todo, setTodo] = useState(false);
  const dias = Object.keys(marcas).filter((d) => d >= hoy).sort();
  const visibles = todo ? dias : dias.slice(0, max);
  return (
    <section className="seccion lo-que-viene" aria-label="Lo que viene">
      <div className="seccion-cabeza">
        <h2>Lo que viene</h2>
        {onMes && <button type="button" className="enlace nota" onClick={onMes}>Ver el mes</button>}
      </div>
      {dias.length ? (
        <ul className="lista-viene">
          {visibles.map((d) => (
            <li key={d}>
              <button type="button" className="viene-dia" onClick={() => onDia(d)}>{d === hoy ? "Hoy" : textoCorto(d, hoy)}</button>
              <ul>
                {marcas[d].map((m, i) => (
                  <li key={i} style={m.color ? { "--s": m.color } : estiloDe(m.sombrero, sombreros)}>
                    <button type="button" onClick={() => onAbrir(m)}>
                      <Icon name={m.tipo === "especial" ? "star" : m.tipo === "reunion" ? "users" : m.tipo === "recordatorio" ? "bell" : "calendar"} size={13} />
                      {m.hora && <time>{horaCorta(m.hora)}</time>}
                      <span>{m.titulo}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="vacio">{vacio}</p>
      )}
      {dias.length > max && (
        <button type="button" className="enlace nota" onClick={() => setTodo(!todo)}>{todo ? "Ver menos" : `Ver ${dias.length - max} días más`}</button>
      )}
    </section>
  );
}

