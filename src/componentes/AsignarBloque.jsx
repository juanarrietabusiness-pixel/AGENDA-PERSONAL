import { useId, useState } from "react";
import Icon from "./Icon.jsx";
import { useDialogo } from "../hooks/useDialogo.js";
import { tareasDelBloque, carga, textoHoras as horas } from "../lib/semana.js";
import { ordenarPor } from "../lib/agenda.js";
import { nuevaAccion } from "../lib/metodo.js";
import { estiloDe, nombreDe } from "../lib/sombreros.js";
import { textoLargo, textoHora } from "../lib/fechas.js";

/**
 * Un bloque de un día (Trabajo, martes de 8 a 12): qué tareas van ahí, cuánto ocupan frente a lo que dura, y añadir
 * más. Asignar es poner la tarea ese día y en ese bloque; las del mismo sombrero planeadas ese día ya caen aquí solas.
 */
export default function AsignarBloque({ bloque, dia, hoy, acciones, proyectos = [], sombreros, todos = [], cambiar, avisar, onCerrar, onEditar = null }) {
  const ref = useDialogo(onCerrar);
  const id = useId();
  const [nueva, setNueva] = useState("");
  const ctx = { hoy, proyectos, sombreros };
  const en = ordenarPor(tareasDelBloque(acciones, bloque, dia, { todos }), "prioridad", ctx);
  const c = carga(en, bloque);
  const candidatas = ordenarPor(
    acciones.filter((a) => a.estado === "abierta" && a.lista === "siguientes" && (a.clase ?? "tarea") === "tarea" && !en.some((x) => x.id === a.id) && (!bloque.sombrero || a.sombrero === bloque.sombrero)),
    "prioridad",
    ctx,
  ).slice(0, 25);

  const poner = (aid, cambios) => cambiar((e) => ({ ...e, acciones: e.acciones.map((x) => (x.id === aid ? { ...x, ...cambios } : x)) }));
  const anadir = (e) => {
    e.preventDefault();
    const t = nueva.trim();
    if (!t) return;
    cambiar((x) => ({ ...x, acciones: [...x.acciones, nuevaAccion({ titulo: t, sombrero: bloque.sombrero ?? null, lista: "siguientes", cuando: dia, bloque: bloque.id, origen: "app" }, hoy)] }));
    setNueva("");
  };

  return (
    <div className="capa" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div ref={ref} className="dialogo" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} style={estiloDe(bloque.sombrero, sombreros)}>
        <h2 id={`${id}-t`}>{bloque.titulo}</h2>
        <p className="nota-fuente">
          {textoLargo(dia)}, de {textoHora(bloque.inicio)} a {textoHora(bloque.fin)}
          {bloque.sombrero ? ` · ${nombreDe(bloque.sombrero, sombreros)}` : ""}
        </p>
        <div className="carga" role="img" aria-label={`${horas(c.ocupado)} de tareas en ${horas(c.cabe)} de bloque`}>
          <span style={{ width: `${Math.min(100, c.cabe ? Math.round((c.ocupado / c.cabe) * 100) : 0)}%` }} className={c.sobra > 0 ? "lleno" : undefined} />
        </div>
        <p className={`nota${c.sobra > 0 ? " rojo-texto" : ""}`}>
          {horas(c.ocupado)} de tareas en {horas(c.cabe)} de bloque{c.sobra > 0 ? `: te pasaste ${horas(c.sobra)}. Mueve, delega o suelta algo.` : "."}
        </p>

        <h3 className="sub-semana">En este bloque</h3>
        {en.length ? (
          <ul className="lista-asignar">
            {en.map((a) => (
              <li key={a.id}>
                <span>{a.titulo} <small>{horas(Number(a.minutos) || 30)}</small></span>
                {a.bloque === bloque.id ? (
                  <button type="button" className="boton fantasma" onClick={() => poner(a.id, { bloque: null })}>Quitar</button>
                ) : (
                  <button type="button" className="boton fantasma" onClick={() => poner(a.id, { cuando: null, bloque: null })} title="Sale de este día y vuelve a «Sin fecha»">Otro día</button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="vacio">Nada todavía.</p>
        )}

        <form className="anadir-rapido" onSubmit={anadir}>
          <label className="solo-lector" htmlFor={`${id}-n`}>Tarea nueva para este bloque</label>
          <input id={`${id}-n`} className="campo" placeholder="Una tarea nueva para este bloque…" value={nueva} onChange={(e) => setNueva(e.target.value)} />
          <button type="submit" className="boton" aria-label="Añadir" disabled={!nueva.trim()}><Icon name="plus" size={16} /></button>
        </form>

        {candidatas.length > 0 && (
          <>
            <h3 className="sub-semana">Añadir{bloque.sombrero ? ` de ${nombreDe(bloque.sombrero, sombreros)}` : ""}</h3>
            <ul className="lista-asignar">
              {candidatas.map((a) => (
                <li key={a.id}>
                  <span>
                    {a.titulo} <small>{horas(Number(a.minutos) || 30)}{a.cuando ? ` · ${a.cuando === dia ? "este día" : a.cuando}` : ""}</small>
                  </span>
                  <button
                    type="button"
                    className="boton"
                    onClick={() => {
                      poner(a.id, { cuando: dia, bloque: bloque.id });
                      avisar?.(`«${a.titulo}» va en ${bloque.titulo}.`);
                    }}
                  >
                    <Icon name="plus" size={14} /> Aquí
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="botones" style={{ marginTop: "var(--sp-5)", justifyContent: onEditar ? "space-between" : "flex-end" }}>
          {onEditar && <button type="button" className="boton fantasma" onClick={onEditar}><Icon name="pencil" size={15} /> Editar el bloque</button>}
          <button type="button" className="boton primario" onClick={onCerrar}>Listo</button>
        </div>
      </div>
    </div>
  );
}
