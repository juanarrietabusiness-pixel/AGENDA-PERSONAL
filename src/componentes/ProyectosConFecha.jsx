import { useId, useState } from "react";
import Icon from "./Icon.jsx";
import Fila from "./Fila.jsx";
import { estiloDe, nombreDe } from "../lib/sombreros.js";
import { proyectosConFecha, textoFalta } from "../lib/proyectos.js";
import { nuevaAccion } from "../lib/metodo.js";
import { textoCorto, horaCorta } from "../lib/fechas.js";

/**
 * Tus proyectos con fecha (un evento que pide preparación): cuánto falta, cuántos pasos llevas, el siguiente paso y el
 * próximo ensayo. Se abre para ver y añadir pasos. Con el evento ya pasado, se ofrece darlo por terminado.
 */
export default function ProyectosConFecha({ estado, hoy, sombreros, cambiar, onHecha, onAbrir, avisar }) {
  const id = useId();
  const [abierto, setAbierto] = useState(null);
  const [nuevo, setNuevo] = useState({});
  const lista = proyectosConFecha({ proyectos: estado.proyectos, acciones: estado.acciones, eventos: estado.eventos, hoy, sombreros });
  if (!lista.length) return null;

  const anadir = (p) => {
    const titulo = String(nuevo[p.id] ?? "").trim();
    if (!titulo) return;
    cambiar((e) => ({ ...e, acciones: [...e.acciones, nuevaAccion({ titulo, sombrero: p.sombrero, proyectoId: p.id, lista: "siguientes", origen: "app" }, hoy)] }));
    setNuevo((x) => ({ ...x, [p.id]: "" }));
  };
  const terminar = (p) => {
    cambiar((e) => ({ ...e, proyectos: e.proyectos.map((x) => (x.id === p.id ? { ...x, estado: "terminado" } : x)) }));
    avisar(`«${p.nombre}» terminado. ¡Bien hecho!`);
  };

  return (
    <section className="seccion" aria-labelledby={`${id}-t`}>
      <div className="seccion-cabeza">
        <h2 id={`${id}-t`}>Tus proyectos con fecha</h2>
        <span className="nota">Un evento y lo que hay que preparar antes</span>
      </div>
      <div className="proyectos-fecha">
        {lista.map(({ proyecto: p, dias, pasos, siguiente, pendientes, ensayos }) => {
          const esteAbierto = abierto === p.id;
          const avance = pasos.total ? Math.round((pasos.hechos / pasos.total) * 100) : 0;
          return (
            <article key={p.id} className="tarjeta proyecto-fecha" style={estiloDe(p.sombrero, sombreros)} aria-labelledby={`${id}-p-${p.id}`}>
              <div className="proyecto-fecha-cabeza">
                <div>
                  <h3 id={`${id}-p-${p.id}`}>{p.nombre}</h3>
                  <p className="nota">{nombreDe(p.sombrero, sombreros)} · {textoCorto(p.limite, hoy)}</p>
                </div>
                <span className={`chip${dias < 0 ? "" : dias <= 7 ? " ambar" : " acento"}`}>{textoFalta(dias)}</span>
              </div>
              <div className="carga" role="img" aria-label={`${pasos.hechos} de ${pasos.total} pasos hechos`}>
                <span style={{ width: `${avance}%` }} />
              </div>
              <p className="nota">{pasos.total ? `${pasos.hechos} de ${pasos.total} pasos hechos` : "Todavía sin pasos"}{ensayos.length ? ` · quedan ${ensayos.length} ensayo${ensayos.length === 1 ? "" : "s"}` : ""}</p>
              {siguiente ? (
                <p className="proyecto-siguiente-paso">
                  <span className="ley-tarea" aria-hidden="true" /> <strong>Siguiente:</strong>{" "}
                  <button type="button" className="enlace" onClick={() => onAbrir("accion", siguiente)}>{siguiente.titulo}</button>
                  {siguiente.cuando ? <small> · {textoCorto(siguiente.cuando, hoy)}</small> : null}
                </p>
              ) : (
                dias >= 0 && <p className="proyecto-siguiente" style={{ color: "var(--ambar)" }}>Sin siguiente paso. ¿Cuál es el próximo?</p>
              )}
              {ensayos[0] && (
                <p className="nota"><Icon name="calendar" size={12} style={{ display: "inline", verticalAlign: "-2px" }} /> Próximo: {ensayos[0].titulo}, {textoCorto(ensayos[0].dia, hoy)}{ensayos[0].inicio && ensayos[0].inicio !== "00:00" ? `, ${horaCorta(ensayos[0].inicio)}` : ""}</p>
              )}
              <div className="botones">
                <button type="button" className="boton fantasma" aria-expanded={esteAbierto} onClick={() => setAbierto(esteAbierto ? null : p.id)}>
                  <Icon name={esteAbierto ? "chevronUp" : "chevronDown"} size={16} /> {esteAbierto ? "Plegar" : `Ver los pasos (${pendientes.length})`}
                </button>
                {dias < 0 && <button type="button" className="boton" onClick={() => terminar(p)}><Icon name="check" size={16} /> Darlo por terminado</button>}
              </div>
              {esteAbierto && (
                <>
                  {pendientes.length > 0 && (
                    <ul className="lista lista-compacta">
                      {pendientes.map((a) => <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={[]} compacta onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)} />)}
                    </ul>
                  )}
                  <form className="anadir-rapido" onSubmit={(e) => { e.preventDefault(); anadir(p); }}>
                    <label className="solo-lector" htmlFor={`${id}-n-${p.id}`}>Un paso más para {p.nombre}</label>
                    <input id={`${id}-n-${p.id}`} className="campo" placeholder="Un paso más (con un verbo)…" value={nuevo[p.id] ?? ""} onChange={(e) => setNuevo((x) => ({ ...x, [p.id]: e.target.value }))} />
                    <button type="submit" className="boton" aria-label={`Añadir el paso a ${p.nombre}`} disabled={!String(nuevo[p.id] ?? "").trim()}><Icon name="plus" size={16} /></button>
                  </form>
                </>
              )}
            </article>
          );
        })}
      </div>
      <p className="nota" style={{ marginTop: "var(--sp-2)" }}>Para crear uno, díselo al asistente: «el 14 de febrero tengo el evento, necesito ensayos los jueves y preparar el repertorio».</p>
    </section>
  );
}
