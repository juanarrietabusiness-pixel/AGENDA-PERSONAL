import { useId, useState } from "react";
import Icon from "../componentes/Icon.jsx";
import Fila from "../componentes/Fila.jsx";
import { sombrerosDe, estiloDe } from "../lib/sombreros.js";
import { nuevaAccion } from "../lib/metodo.js";
import { FILTROS, tablero, soltarEnTablero, moverUnPuesto } from "../lib/tablero.js";
import { zonaDeSoltar } from "../lib/arrastre.js";

/**
 * Tareas: el panorama completo. Una columna por sombrero (en tu orden de prioridad), con las sueltas arriba, luego
 * cada empresa y cada proyecto. Se añade arriba de cada columna; se arrastra para ordenar (el orden lo pones tú) o a
 * otra columna para cambiar de sombrero; con el teclado, Alt + ↑ / ↓. En el teléfono, una columna a la vez.
 */
export default function Tareas({ estado, hoy, cambiar, onHecha, onAbrir, onEnfoque, avisar }) {
  const id = useId();
  const sombreros = sombrerosDe(estado.ajustes);
  const [filtro, setFiltro] = useState("todo");
  const [buscar, setBuscar] = useState("");
  const [visto, setVisto] = useState(null);
  const columnas = tablero(estado.acciones, { sombreros, proyectos: estado.proyectos, filtro, buscar, hoy });
  const vista = columnas.some((c) => c.id === visto) ? visto : (columnas.find((c) => c.total) ?? columnas[0])?.id ?? null;
  const total = columnas.reduce((t, c) => t + c.total, 0);

  const soltar = (destino) => (d) => {
    if (d.tipo !== "accion") return;
    const a = estado.acciones.find((x) => x.id === d.id);
    cambiar((e) => ({ ...e, acciones: soltarEnTablero(e.acciones, { ...destino, id: d.id, proyectos: e.proyectos }) }));
    if (a && destino.columna.id && a.sombrero !== destino.columna.id) avisar(`«${a.titulo}» ahora es de ${destino.columna.nombre}.`);
  };

  const anadir = (col, titulo) => {
    const lista = filtro === "algun" ? "algun-dia" : "siguientes";
    const cuando = filtro === "hoy" ? hoy : null;
    cambiar((e) => ({ ...e, acciones: [nuevaAccion({ titulo, sombrero: col.id, lista, cuando, origen: "app" }, hoy), ...e.acciones] }));
  };

  return (
    <div className="tareas">
      <div className="tareas-cabeza">
        <div>
          <h1 className="titulo-pantalla">Tareas</h1>
          <p className="subtitulo">{total} abierta{total === 1 ? "" : "s"} en tus sombreros. Arrastra para ordenar o para cambiarla de sombrero.</p>
        </div>
        <div className="tareas-controles">
          <label className="buscar">
            <Icon name="search" size={16} />
            <span className="solo-lector">Buscar una tarea</span>
            <input className="campo" type="search" placeholder="Buscar…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          </label>
          <div className="filtro-sombreros" role="group" aria-label="Qué tareas ver">
            {Object.entries(FILTROS).map(([k, t]) => (
              <button key={k} type="button" className="chip-boton" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="tareas-sombreros" role="group" aria-label="Sombrero que ves">
        {columnas.map((c) => (
          <button key={c.id ?? "sin"} type="button" className="chip-boton" style={estiloDe(c.id, sombreros)} aria-pressed={vista === c.id} onClick={() => setVisto(c.id)}>
            <span className="punto" /> {c.nombre} <small>{c.total}</small>
          </button>
        ))}
      </div>

      <div className="tablero" aria-labelledby={`${id}-t`}>
        <h2 id={`${id}-t`} className="solo-lector">Tus tareas por sombrero</h2>
        {columnas.map((c) => (
          <Columna
            key={c.id ?? "sin"}
            col={c}
            visto={vista === c.id}
            hoy={hoy}
            estado={estado}
            sombreros={sombreros}
            filtro={filtro}
            onAnadir={(t) => anadir(c, t)}
            onSoltar={soltar}
            cambiar={cambiar}
            onHecha={onHecha}
            onAbrir={onAbrir}
            onEnfoque={onEnfoque}
          />
        ))}
      </div>
    </div>
  );
}

function Columna({ col, visto, hoy, estado, sombreros, filtro, onAnadir, onSoltar, cambiar, onHecha, onAbrir, onEnfoque }) {
  const id = useId();
  const [nueva, setNueva] = useState("");
  const [encima, setEncima] = useState(false);
  const [verHechas, setVerHechas] = useState(false);
  const sueltas = col.grupos.find((g) => g.tipo === "sueltas");
  const fila = (a, g) => (
    <Fila
      key={a.id}
      accion={a}
      hoy={hoy}
      sombreros={sombreros}
      proyectos={estado.proyectos}
      onHecha={onHecha}
      onAbrir={(x) => onAbrir("accion", x)}
      onEnfoque={onEnfoque}
      compacta
      arrastrable
      zona={zonaDeSoltar(onSoltar({ columna: col, grupo: g, antesDe: a.id }))}
      onTecla={(e) => {
        if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
        e.preventDefault();
        cambiar((s) => ({ ...s, acciones: moverUnPuesto(s.acciones, g, a.id, e.key === "ArrowUp" ? -1 : 1) }));
      }}
    />
  );

  return (
    <section className={`columna-tareas${visto ? " visto" : ""}${encima ? " soltando" : ""}`} style={estiloDe(col.id, sombreros)} aria-labelledby={`${id}-n`} {...zonaDeSoltar(onSoltar({ columna: col, grupo: sueltas }), setEncima)}>
      <div className="columna-cabeza">
        <h2 id={`${id}-n`}><span className="punto" /> {col.nombre}</h2>
        <span className="somb-cuenta">{col.total}</span>
      </div>
      <form
        className="columna-anadir"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nueva.trim()) return;
          onAnadir(nueva.trim());
          setNueva("");
        }}
      >
        <Icon name="plus" size={16} />
        <label className="solo-lector" htmlFor={`${id}-a`}>Agregar una tarea a {col.nombre}</label>
        <input id={`${id}-a`} className="anadir-campo" placeholder={filtro === "hoy" ? "Agregar una tarea para hoy" : "Agregar una tarea"} value={nueva} onChange={(e) => setNueva(e.target.value)} />
      </form>
      <div className="columna-cuerpo">
        {col.grupos.map((g) =>
          g.tipo === "sueltas" ? (
            g.tareas.length > 0 && <ul key={g.clave} className="lista lista-compacta">{g.tareas.map((a) => fila(a, g))}</ul>
          ) : (
            <div key={g.clave} className="grupo-tareas" {...zonaDeSoltar(onSoltar({ columna: col, grupo: g }))}>
              <h3><Icon name={g.tipo === "proyecto" ? "folder" : "building"} size={13} /> {g.titulo} <small>{g.tareas.length || ""}</small></h3>
              {g.tareas.length ? (
                <ul className="lista lista-compacta">{g.tareas.map((a) => fila(a, g))}</ul>
              ) : (
                <p className="grupo-vacio">Sin siguiente paso. ¿Cuál es el próximo?</p>
              )}
            </div>
          ),
        )}
        {!col.total && !col.grupos.some((g) => g.tipo === "proyecto") && <p className="grupo-vacio">{filtro === "todo" ? "Nada abierto aquí." : "Nada con este filtro."}</p>}
        {col.hechas.length > 0 && (
          <div className="columna-hechas">
            <button type="button" className="enlace" aria-expanded={verHechas} onClick={() => setVerHechas(!verHechas)}>
              <Icon name={verHechas ? "chevronDown" : "chevronRight"} size={14} /> Completadas ({col.hechas.length})
            </button>
            {verHechas && <ul className="lista lista-compacta">{col.hechas.slice(0, 40).map((a) => <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)} compacta mostrarDia={false} />)}</ul>}
          </div>
        )}
      </div>
    </section>
  );
}
