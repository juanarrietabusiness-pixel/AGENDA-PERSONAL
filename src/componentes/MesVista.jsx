import { useState } from "react";
import Icon from "./Icon.jsx";
import { estiloDe } from "../lib/sombreros.js";
import { DIAS, partes, diaSemana, horaCorta, textoLargo } from "../lib/fechas.js";
import { semanasDelMes } from "../lib/rejilla.js";
import { esTodoElDia } from "../lib/agenda.js";
import { zonaDeSoltar, empezarArrastre } from "../lib/arrastre.js";

const CABE = 3; // cosas que se ven en un día del mes (en la computadora)
const INICIALES = ["L", "M", "X", "J", "V", "S", "D"];

/**
 * El mes: en cada día, lo especial, las reuniones y los compromisos que no son tu rutina, y las tareas que tienen ese
 * día. Se suelta una tarea (o una reunión) en un día para pasarla ahí; «+» añade algo ese día; el número lleva a su
 * semana. En el teléfono, cada día es un punto por cosa y abajo se ve el día que tocas.
 */
export default function MesVista({ primero, hoy, cosasDe, sombreros, onSemana, onCrear, onAbrir, onSoltar }) {
  const { mes } = partes(primero);
  const semanas = semanasDelMes(primero);
  const [visto, setVisto] = useState(partes(hoy).mes === mes ? hoy : primero);
  const delVisto = cosasDe(visto);

  return (
    <div className="mes">
      <div className="mes-rejilla" role="grid" aria-label="El mes">
        <div className="mes-cabeza" role="row">
          {INICIALES.map((d, i) => <span key={d} role="columnheader" aria-label={DIAS[(i + 1) % 7]}>{d}</span>)}
        </div>
        {semanas.map((semana) => (
          <div key={semana[0]} className="mes-semana" role="row">
            {semana.map((d) => (
              <Dia key={d} dia={d} hoy={hoy} fuera={partes(d).mes !== mes} visto={visto === d} cosas={cosasDe(d)} sombreros={sombreros} onVer={() => setVisto(d)} onSemana={onSemana} onCrear={onCrear} onAbrir={onAbrir} onSoltar={onSoltar} />
            ))}
          </div>
        ))}
      </div>

      <section className="mes-del-dia" aria-label={`Lo del ${textoLargo(visto)}`}>
        <div className="mes-del-dia-cabeza">
          <h2>{textoLargo(visto)}</h2>
          <button type="button" className="boton fantasma" onClick={() => onCrear({ dia: visto })}><Icon name="plus" size={16} /> Añadir</button>
          <button type="button" className="boton fantasma" onClick={() => onSemana(visto)}>Ver la semana</button>
        </div>
        {delVisto.length ? (
          <ul className="mes-lista">{delVisto.map((c) => <Cosa key={c.clave} c={c} sombreros={sombreros} onAbrir={onAbrir} />)}</ul>
        ) : (
          <p className="vacio">Nada ese día.</p>
        )}
      </section>
    </div>
  );
}

function Dia({ dia, hoy, fuera, visto, cosas, sombreros, onVer, onSemana, onCrear, onAbrir, onSoltar }) {
  const [encima, setEncima] = useState(false);
  const n = partes(dia).dia;
  return (
    <div
      role="gridcell"
      className={`mes-dia${dia === hoy ? " es-hoy" : ""}${fuera ? " fuera" : ""}${visto ? " visto" : ""}${encima ? " soltando" : ""}${diaSemana(dia) % 6 === 0 ? " finde" : ""}`}
      {...zonaDeSoltar((d) => onSoltar(d, dia), setEncima)}
    >
      <div className="mes-dia-cabeza">
        <button type="button" className="mes-num" onClick={() => (window.matchMedia("(min-width: 900px)").matches ? onSemana(dia) : onVer())} aria-label={`${textoLargo(dia)}: ${cosas.length ? `${cosas.length} cosa${cosas.length === 1 ? "" : "s"}` : "nada"}`}>
          {n}
        </button>
        <button type="button" className="mes-mas" onClick={() => onCrear({ dia })} aria-label={`Añadir algo el ${textoLargo(dia)}`}><Icon name="plus" size={14} /></button>
      </div>
      <ul className="mes-cosas">
        {cosas.slice(0, CABE).map((c) => <Cosa key={c.clave} c={c} sombreros={sombreros} onAbrir={onAbrir} />)}
        {cosas.length > CABE && (
          <li><button type="button" className="mes-mas-cosas" onClick={() => onSemana(dia)}>y {cosas.length - CABE} más</button></li>
        )}
      </ul>
      <span className="mes-puntos" aria-hidden="true">
        {cosas.slice(0, 4).map((c) => <span key={c.clave} className={`mes-punto mc-${c.tipo}`} style={c.color ? { "--s": c.color } : estiloDe(c.sombrero, sombreros)} />)}
      </span>
    </div>
  );
}

function Cosa({ c, sombreros, onAbrir }) {
  const arrastrable = c.tipo === "tarea" || (c.tipo === "evento" && c.obj.fuente === "agenda" && !c.obj.repite?.regla);
  const icono = c.tipo === "especial" ? "star" : c.obj?.clase === "reunion" ? "users" : "calendar";
  return (
    <li
      className={`mes-cosa mc-${c.tipo}`}
      style={c.color ? { "--s": c.color } : estiloDe(c.sombrero, sombreros)}
      draggable={arrastrable || undefined}
      onDragStart={arrastrable ? (e) => empezarArrastre(e, { tipo: c.tipo === "tarea" ? "accion" : "evento", id: c.obj.id, titulo: c.titulo }) : undefined}
    >
      <button type="button" onClick={() => onAbrir(c)} title={c.titulo}>
        {c.tipo === "tarea" ? <span className="ley-tarea" aria-hidden="true" /> : <Icon name={icono} size={11} />}
        {c.obj?.inicio && !esTodoElDia(c.obj) && c.tipo !== "tarea" && <time>{horaCorta(c.obj.inicio)}</time>}
        {c.tipo === "tarea" && c.obj.hora && <time>{horaCorta(c.obj.hora)}</time>}
        <span>{c.titulo}</span>
      </button>
    </li>
  );
}
