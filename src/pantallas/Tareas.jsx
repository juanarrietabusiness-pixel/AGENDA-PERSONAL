import { useEffect, useId, useRef, useState } from "react";
import Icon from "../componentes/Icon.jsx";
import Fila from "../componentes/Fila.jsx";
import EditarSombrero from "../componentes/EditarSombrero.jsx";
import { Pasos } from "../componentes/Editar.jsx";
import { sombrerosDe, estiloDe, aplicarSombrero } from "../lib/sombreros.js";
import { nuevaAccion } from "../lib/metodo.js";
import { FILTROS, tablero, soltarEnTablero, moverUnPuesto, leerEtiquetas, etiquetasEnUso } from "../lib/tablero.js";
import { zonaDeSoltar } from "../lib/arrastre.js";

/**
 * Tareas: el panorama completo. Una columna por sombrero (en tu orden de prioridad), con las sueltas arriba, luego
 * cada empresa y cada proyecto (plegables, con su avance). Se añade arriba de cada columna («#llamadas» la etiqueta);
 * se arrastra para ordenar (el orden lo pones tú) o a otra columna para cambiar de sombrero; con el teclado,
 * Alt + ↑ / ↓. Las etiquetas (las tuyas y las empresas) filtran; los pasos de una tarea se marcan sin abrirla; el lápiz
 * de cada columna edita el sombrero. En el teléfono, una columna a la vez.
 */
export default function Tareas({ estado, hoy, cambiar, onHecha, onAbrir, onEnfoque, avisar }) {
  const id = useId();
  const sombreros = sombrerosDe(estado.ajustes);
  const [filtro, setFiltro] = useState("todo");
  const [buscar, setBuscar] = useState("");
  const [etiqueta, setEtiqueta] = useState(null);
  const [visto, setVisto] = useState(undefined); // undefined: aún sin escoger (null es la columna «Sin sombrero»)
  const [creando, setCreando] = useState(false);
  const [nuevoSombrero, setNuevoSombrero] = useState("");
  const etiquetas = etiquetasEnUso(estado.acciones);
  const etiquetaVista = etiqueta && etiquetas.some((t) => t.nombre === etiqueta) ? etiqueta : null;
  const columnas = tablero(estado.acciones, { sombreros, proyectos: estado.proyectos, filtro, buscar, etiqueta: etiquetaVista, hoy });
  const vista = columnas.some((c) => c.id === visto) ? visto : (columnas.find((c) => c.total) ?? columnas[0])?.id ?? null;
  const total = columnas.reduce((t, c) => t + c.total, 0);
  // En el teléfono las columnas se deslizan con el dedo (una por pantalla); los chips de arriba siguen a la que se ve.
  const tablerito = useRef(null);
  const cols = useRef({});
  const chips = useRef({});
  const clave = (cid) => cid ?? "sin";
  const irA = (cid) => {
    setVisto(cid);
    cols.current[clave(cid)]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };
  const alDeslizar = () => {
    const t = tablerito.current;
    if (!t || t.scrollWidth <= t.clientWidth + 4 || t.clientWidth >= 700) return;
    // La columna que se ve: la que empieza más cerca de lo desplazado (las columnas se miden desde el tablero).
    const cerca = columnas.reduce((m, c) => {
      const d = Math.abs((cols.current[clave(c.id)]?.offsetLeft ?? 0) - t.scrollLeft);
      return d < m.d ? { c, d } : m;
    }, { c: null, d: Infinity }).c;
    if (cerca && cerca.id !== vista) setVisto(cerca.id);
  };
  useEffect(() => {
    chips.current[clave(vista)]?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [vista]);
  // Al abrir en el teléfono, se ve la columna escogida (la primera con algo), no la primera de todas.
  useEffect(() => {
    const t = tablerito.current;
    if (t && t.clientWidth < 700) t.scrollLeft = cols.current[clave(vista)]?.offsetLeft ?? 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const soltar = (destino) => (d) => {
    if (d.tipo !== "accion") return;
    const a = estado.acciones.find((x) => x.id === d.id);
    cambiar((e) => ({ ...e, acciones: soltarEnTablero(e.acciones, { ...destino, id: d.id, proyectos: e.proyectos }) }));
    if (a && destino.columna.id && a.sombrero !== destino.columna.id) avisar(`«${a.titulo}» ahora es de ${destino.columna.nombre}.`);
  };

  const anadir = (col, texto) => {
    const { titulo, etiquetas: suyas } = leerEtiquetas(texto);
    if (!titulo) return false;
    const lista = filtro === "algun" ? "algun-dia" : "siguientes";
    const cuando = filtro === "hoy" ? hoy : null;
    // Con una etiqueta tuya filtrada, la nueva la lleva (si no, desaparecería al añadirla).
    const propia = etiquetaVista && etiquetas.some((t) => t.nombre === etiquetaVista && t.tipo === "propia") ? [etiquetaVista] : [];
    cambiar((e) => ({ ...e, acciones: [nuevaAccion({ titulo, sombrero: col.id, lista, cuando, etiquetas: [...suyas, ...propia], origen: "app" }, hoy), ...e.acciones] }));
    return true;
  };

  const cambiarSombreros = (cambio) => {
    try {
      const r = aplicarSombrero(estado.ajustes.sombreros, cambio);
      cambiar((e) => ({ ...e, ajustes: { ...e.ajustes, sombreros: r.lista } }));
      return true;
    } catch (err) {
      avisar(err.message);
      return false;
    }
  };
  const quitarSombrero = (s) => {
    if ([...estado.acciones, ...estado.proyectos].some((x) => x.sombrero === s.id && x.estado !== "hecha" && x.estado !== "soltada" && x.estado !== "terminado")) {
      avisar(`«${s.nombre}» todavía tiene cosas abiertas: muévelas a otro sombrero antes de quitarlo.`);
      return false;
    }
    if (cambiarSombreros({ accion: "quitar", id: s.id })) avisar(`Quité «${s.nombre}».`);
    return true;
  };
  const sombreroDe = (cid) => sombreros.findIndex((s) => s.id === cid);

  return (
    <div className="tareas">
      <div className="tareas-cabeza">
        <div>
          <h1 className="titulo-pantalla">Tareas</h1>
          <p className="subtitulo">{total} abierta{total === 1 ? "" : "s"} en tus sombreros. Arrastra para ordenarlas o pasarlas a otro sombrero; en el teléfono, desliza para cambiar de sombrero.</p>
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
          {creando ? (
            <form className="anadir-rapido sombrero-nuevo" onSubmit={(e) => { e.preventDefault(); if (cambiarSombreros({ accion: "crear", nombre: nuevoSombrero })) { avisar(`Sombrero nuevo: «${nuevoSombrero.trim()}».`); setNuevoSombrero(""); setCreando(false); } }}>
              <label className="solo-lector" htmlFor={`${id}-nuevo`}>Nombre del sombrero nuevo</label>
              <input id={`${id}-nuevo`} className="campo" autoFocus placeholder="Estudios, Familia…" value={nuevoSombrero} onChange={(e) => setNuevoSombrero(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setCreando(false)} />
              <button type="submit" className="boton primario" disabled={!nuevoSombrero.trim()}>Crear</button>
            </form>
          ) : (
            <button type="button" className="boton fantasma" onClick={() => setCreando(true)}><Icon name="plus" size={16} /> Sombrero</button>
          )}
        </div>
      </div>

      {etiquetas.length > 0 && (
        <div className="tareas-etiquetas" role="group" aria-label="Filtrar por etiqueta">
          <span className="nota"><Icon name="tag" size={13} /> Etiquetas</span>
          {etiquetas.map((t) => (
            <button key={`${t.tipo}:${t.nombre}`} type="button" className={`chip-boton etiqueta-chip${t.tipo === "empresa" ? " empresa" : ""}`} aria-pressed={etiquetaVista === t.nombre} onClick={() => setEtiqueta(etiquetaVista === t.nombre ? null : t.nombre)}>
              {t.tipo === "empresa" ? <Icon name="building" size={12} /> : "#"}{t.nombre} <small>{t.n}</small>
            </button>
          ))}
        </div>
      )}

      <div className="tareas-sombreros" role="group" aria-label="Sombrero que ves">
        {columnas.map((c) => (
          <button key={c.id ?? "sin"} ref={(el) => (chips.current[clave(c.id)] = el)} type="button" className="chip-boton" style={estiloDe(c.id, sombreros)} aria-pressed={vista === c.id} onClick={() => irA(c.id)}>
            <span className="punto" /> {c.nombre} <small>{c.total}</small>
          </button>
        ))}
      </div>

      <div className="tablero" ref={tablerito} onScroll={alDeslizar} aria-labelledby={`${id}-t`}>
        <h2 id={`${id}-t`} className="solo-lector">Tus tareas por sombrero</h2>
        {columnas.map((c) => (
          <Columna
            key={c.id ?? "sin"}
            refCol={(el) => (cols.current[clave(c.id)] = el)}
            col={c}
            visto={vista === c.id}
            hoy={hoy}
            estado={estado}
            sombreros={sombreros}
            filtro={filtro}
            etiqueta={etiquetaVista}
            posicion={sombreroDe(c.id)}
            onAnadir={(t) => anadir(c, t)}
            onEtiqueta={setEtiqueta}
            onSombrero={cambiarSombreros}
            onQuitarSombrero={quitarSombrero}
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

function Columna({ col, refCol, visto, hoy, estado, sombreros, filtro, etiqueta, posicion, onAnadir, onEtiqueta, onSombrero, onQuitarSombrero, onSoltar, cambiar, onHecha, onAbrir, onEnfoque }) {
  const id = useId();
  const [nueva, setNueva] = useState("");
  const [encima, setEncima] = useState(false);
  const [verHechas, setVerHechas] = useState(false);
  const [editando, setEditando] = useState(false);
  const [plegados, setPlegados] = useState({});
  const sueltas = col.grupos.find((g) => g.tipo === "sueltas");
  const s = posicion >= 0 ? sombreros[posicion] : null;
  const cambiarAccion = (aid, fn) => cambiar((e) => ({ ...e, acciones: e.acciones.map((x) => (x.id === aid ? fn(x) : x)) }));
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
        cambiar((x) => ({ ...x, acciones: moverUnPuesto(x.acciones, g, a.id, e.key === "ArrowUp" ? -1 : 1) }));
      }}
    >
      {((a.etiquetas ?? []).length > 0 || (a.pasos ?? []).length > 0) && (
        <Detalle accion={a} etiqueta={etiqueta} onEtiqueta={onEtiqueta} onCambiar={(fn) => cambiarAccion(a.id, fn)} />
      )}
    </Fila>
  );

  return (
    <section ref={refCol} className={`columna-tareas${visto ? " visto" : ""}${encima ? " soltando" : ""}`} style={estiloDe(col.id, sombreros)} aria-labelledby={`${id}-n`} {...zonaDeSoltar(onSoltar({ columna: col, grupo: sueltas }), setEncima)}>
      <div className="columna-cabeza">
        <h2 id={`${id}-n`}><span className="punto" /> {col.nombre}</h2>
        <span className="somb-cuenta">{col.total}</span>
        {s && (
          <button type="button" className="editar-fila" aria-expanded={editando} aria-controls={`${id}-ed`} aria-label={`Editar el sombrero ${col.nombre}`} title="Editar el sombrero: nombre, color, prioridad" onClick={() => setEditando(!editando)}>
            <Icon name="pencil" size={14} />
          </button>
        )}
      </div>
      {s && editando && (
        <div id={`${id}-ed`} className="columna-editar">
          <EditarSombrero
            key={s.id}
            s={s}
            primero={posicion === 0}
            ultimo={posicion === sombreros.length - 1}
            posicion={posicion}
            onMover={(a) => onSombrero({ accion: "mover", id: s.id, a })}
            onGuardar={(c) => onSombrero({ accion: "editar", id: s.id, ...c }) && setEditando(false)}
            onQuitar={() => onQuitarSombrero(s) && setEditando(false)}
          />
        </div>
      )}
      <form
        className="columna-anadir"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nueva.trim()) return;
          if (onAnadir(nueva.trim())) setNueva("");
        }}
      >
        <Icon name="plus" size={16} />
        <label className="solo-lector" htmlFor={`${id}-a`}>Agregar una tarea a {col.nombre}</label>
        <input id={`${id}-a`} className="anadir-campo" placeholder={filtro === "hoy" ? "Agregar una tarea para hoy (#etiqueta)" : "Agregar una tarea (#etiqueta)"} value={nueva} onChange={(e) => setNueva(e.target.value)} />
      </form>
      <div className="columna-cuerpo">
        {col.grupos.map((g) =>
          g.tipo === "sueltas" ? (
            g.tareas.length > 0 && <ul key={g.clave} className="lista lista-compacta">{g.tareas.map((a) => fila(a, g))}</ul>
          ) : (
            <div key={g.clave} className={`grupo-tareas${g.tipo === "proyecto" ? " es-proyecto" : ""}`} {...zonaDeSoltar(onSoltar({ columna: col, grupo: g }))}>
              {g.tipo === "proyecto" ? (
                <h3>
                  <button type="button" className="grupo-boton" aria-expanded={!plegados[g.clave]} onClick={() => setPlegados((p) => ({ ...p, [g.clave]: !p[g.clave] }))}>
                    <Icon name={plegados[g.clave] ? "chevronRight" : "chevronDown"} size={13} />
                    <Icon name="folder" size={13} /> <span className="grupo-nombre">{g.titulo}</span>
                    <small>{g.avance.total ? `${g.avance.hechos}/${g.avance.total}` : g.tareas.length || ""}</small>
                  </button>
                </h3>
              ) : (
                <h3><Icon name="building" size={13} /> {g.titulo} <small>{g.tareas.length || ""}</small></h3>
              )}
              {g.tipo === "proyecto" && g.avance.total > 0 && (
                <div className="avance" role="progressbar" aria-label={`Avance de ${g.titulo}`} aria-valuemin={0} aria-valuemax={g.avance.total} aria-valuenow={g.avance.hechos} aria-valuetext={`${g.avance.hechos} de ${g.avance.total} hechas`}>
                  <span style={{ width: `${Math.round((g.avance.hechos / g.avance.total) * 100)}%` }} />
                </div>
              )}
              {plegados[g.clave] ? null : g.tareas.length ? (
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

/**
 * Debajo del título de una tarea, sin abrirla: sus etiquetas (tocarlas filtra) y sus pasos («2/4 pasos»), que se
 * despliegan para marcarlos, quitarlos o añadir otro.
 */
function Detalle({ accion, etiqueta, onEtiqueta, onCambiar }) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const pasos = accion.pasos ?? [];
  const hechos = pasos.filter((p) => p.hecho).length;
  return (
    <div className="tarea-detalle">
      {(accion.etiquetas ?? []).map((t) => (
        <button key={t} type="button" className="etiqueta-mini" aria-pressed={etiqueta === t} onClick={() => onEtiqueta(etiqueta === t ? null : t)}>#{t}</button>
      ))}
      {pasos.length > 0 && (
        <button type="button" className={`pasos-cuenta${hechos === pasos.length ? " completos" : ""}`} aria-expanded={abierto} aria-controls={`${id}-p`} onClick={() => setAbierto(!abierto)}>
          <Icon name="check" size={11} strokeWidth={3} /> {hechos}/{pasos.length} pasos
        </button>
      )}
      {abierto && (
        <div id={`${id}-p`} className="tarea-pasos">
          <Pasos pasos={pasos} compacto onCambiar={onCambiar} />
        </div>
      )}
    </div>
  );
}
