import { useMemo, useState } from "react";
import Icon from "../componentes/Icon.jsx";
import Fila from "../componentes/Fila.jsx";
import { textoLargo, textoCorto, textoHora, sumarDias } from "../lib/fechas.js";
import { sombrerosDe, estiloDe, nombreDe } from "../lib/sombreros.js";
import { elegirVersiculo, ATRIBUCION } from "../lib/versiculos.js";
import { variante } from "../lib/mensajes.js";
import { PERIODOS, ORDENES, rango, mover, tituloDe, accionesDelPeriodo, sinFecha, reunionesDelPeriodo, especialesDelMes, rutinaDelPeriodo, ordenarPor } from "../lib/agenda.js";

const SALUDO = ["Buenos días", "Buen día", "Arrancamos"];
const saludo = (hora, dia) => (hora < "12:00" ? variante(SALUDO, dia) : hora < "19:00" ? "Buenas tardes" : "Buenas noches");

const COLUMNAS = [
  { id: "tareas", nombre: "Tareas", icono: "checkSquare" },
  { id: "reuniones", nombre: "Reuniones", icono: "users" },
  { id: "recordatorios", nombre: "Recordatorios", icono: "bell" },
  { id: "especiales", nombre: "Eventos especiales", icono: "star" },
];

const recordar = (k, v) => {
  try {
    localStorage.setItem(`hoy-${k}`, v);
  } catch {
    /* sin almacenamiento: sólo no se recuerda */
  }
};
const recordado = (k, base, validos) => {
  try {
    const v = localStorage.getItem(`hoy-${k}`);
    return validos.includes(v) ? v : base;
  } catch {
    return base;
  }
};

/**
 * Hoy: lo que hay que hacer, por prioridad, y lo que viene. Sin la rutina fija de cada día (la oración, los servicios:
 * ya los sabes); con las reuniones, los recordatorios y los eventos especiales del mes, de todos los sombreros, en el
 * día, la semana o el mes.
 */
export default function Hoy({ estado, hoy, hora, onHecha, onAbrir, onDecidir, onAsistente }) {
  const { acciones, eventos, proyectos, ajustes, bandeja = [], externos = [] } = estado;
  const sombreros = sombrerosDe(ajustes);
  const [periodo, setPeriodo] = useState(() => recordado("periodo", "dia", Object.keys(PERIODOS)));
  const [orden, setOrden] = useState(() => recordado("orden", "prioridad", Object.keys(ORDENES)));
  const [dia, setDia] = useState(hoy);
  const [filtro, setFiltro] = useState(null);
  const [columna, setColumna] = useState("tareas");
  const [verHechas, setVerHechas] = useState(false);
  const [verSinFecha, setVerSinFecha] = useState(false);
  const [verRutina, setVerRutina] = useState(false);

  const r = rango(periodo, dia);
  const ctx = { hoy, proyectos, sombreros };
  const deFiltro = (x) => !filtro || x.sombrero === filtro;
  const datos = useMemo(() => {
    const t = accionesDelPeriodo(acciones, { ...r, hoy, clase: "tarea" });
    const rc = accionesDelPeriodo(acciones, { ...r, hoy, clase: "recordatorio" });
    return {
      tareas: ordenarPor(t.abiertas.filter(deFiltro), orden, ctx),
      hechas: t.hechas.filter(deFiltro),
      recordatorios: ordenarPor(rc.abiertas.filter(deFiltro), "limite", ctx),
      recordatoriosHechos: rc.hechas.filter(deFiltro),
      libres: ordenarPor(sinFecha(acciones).filter(deFiltro), orden, ctx),
      reuniones: reunionesDelPeriodo(eventos, externos, r, ajustes).filter((e) => !filtro || e.sombrero === filtro || e.fuente === "google"),
      rutina: rutinaDelPeriodo(externos, r, ajustes, eventos),
      especiales: especialesDelMes(acciones, eventos, dia, externos, ajustes).filter((e) => !filtro || e.sombrero === filtro || e.fuente === "google"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acciones, eventos, externos, periodo, dia, orden, filtro, hoy, proyectos, ajustes]);

  const v = elegirVersiculo({ momento: "manana", hoy, frecuencia: ajustes.frecuenciaVersiculos });
  const hechasHoy = acciones.filter((a) => a.estado === "hecha" && a.hechaEl === hoy).length;
  const cuenta = { tareas: datos.tareas.length, reuniones: datos.reuniones.length, recordatorios: datos.recordatorios.length, especiales: datos.especiales.length };
  const variosDias = periodo !== "dia";

  const ponerPeriodo = (p) => {
    setPeriodo(p);
    recordar("periodo", p);
  };
  const ponerOrden = (o) => {
    setOrden(o);
    recordar("orden", o);
  };

  const filas = (lista, { conDecidir = false } = {}) => (
    <ul className="lista">
      {lista.map((a) => (
        <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={proyectos} onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)} mostrarDia={variosDias || a.cuando !== hoy}>
          {conDecidir && a.estado === "abierta" && a.cuando && a.cuando < hoy && (
            <div className="botones">
              <button type="button" className="boton" onClick={() => onDecidir(a.id, "hoy")}>Hoy</button>
              <button type="button" className="boton" onClick={() => onDecidir(a.id, "manana")}>Mañana</button>
              <button type="button" className="boton fantasma" onClick={() => onDecidir(a.id, "algun-dia")}>Algún día</button>
              <button type="button" className="boton fantasma" onClick={() => onDecidir(a.id, "soltar")}>Ya no aplica</button>
            </div>
          )}
        </Fila>
      ))}
    </ul>
  );

  const porDia = (lista, pintar) => {
    if (!variosDias) return pintar(lista);
    const grupos = new Map();
    for (const x of lista) grupos.set(x.dia, [...(grupos.get(x.dia) ?? []), x]);
    return [...grupos.entries()].map(([d, xs]) => (
      <div key={d} className="grupo-dia">
        <h4 className={d === hoy ? "es-hoy" : undefined}>{d === hoy ? "Hoy" : textoCorto(d, hoy)}</h4>
        {pintar(xs)}
      </div>
    ));
  };

  const vacio = (texto) => <p className="vacio">{texto}</p>;

  const contenido = {
    tareas: (
      <>
        {datos.tareas.length ? filas(datos.tareas, { conDecidir: true }) : vacio(periodo === "dia" ? "Nada planeado para este día. Mira «Sin fecha» o pídele algo al asistente." : "Nada planeado en este periodo.")}
        {datos.libres.length > 0 && (
          <div className="plegable">
            <button type="button" className="boton fantasma" aria-expanded={verSinFecha} onClick={() => setVerSinFecha((x) => !x)}>
              <Icon name={verSinFecha ? "chevronUp" : "chevronDown"} size={16} /> Sin fecha ({datos.libres.length})
            </button>
            {verSinFecha && filas(datos.libres)}
          </div>
        )}
        {datos.hechas.length > 0 && (
          <div className="plegable">
            <button type="button" className="boton fantasma" aria-expanded={verHechas} onClick={() => setVerHechas((x) => !x)}>
              <Icon name={verHechas ? "chevronUp" : "chevronDown"} size={16} /> Hechas ({datos.hechas.length})
            </button>
            {verHechas && filas(datos.hechas)}
          </div>
        )}
      </>
    ),
    reuniones: datos.reuniones.length
      ? porDia(datos.reuniones, (xs) => (
          <ul className="lista">
            {xs.map((e) => (
              <li key={e.clave ?? `${e.fuente ?? "aqui"}:${e.id}:${e.dia}`} className="evento" style={e.fuente === "google" && e.color ? { "--s": e.color } : estiloDe(e.sombrero, sombreros)}>
                <span className="evento-hora">{e.inicio ? textoHora(e.inicio) : "Todo el día"}</span>
                <div>
                  {e.fuente === "google" ? (
                    <button type="button" className="evento-titulo enlace" onClick={() => onAbrir("google", e)}>{e.titulo}</button>
                  ) : (
                    <button type="button" className="evento-titulo enlace" onClick={() => onAbrir("evento", eventos.find((x) => x.id === e.id) ?? e)}>{e.titulo}</button>
                  )}
                  <div className="accion-meta">
                    {e.fuente === "google" ? <span className="chip">{e.calendarioNombre ?? `Google · ${e.cuenta}`}</span> : <span>{nombreDe(e.sombrero, sombreros)}</span>}
                    {e.fin && e.inicio && <span>hasta {textoHora(e.fin)}</span>}
                    {e.lugar && <span>{e.lugar}</span>}
                    {e.notas && <span title={e.notas}><Icon name="file" size={11} style={{ display: "inline", verticalAlign: "-1px" }} /> Notas</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ))
      : vacio("Sin reuniones ni citas."),
    rutina: datos.rutina.length > 0 && (
      <div className="plegable">
        {variosDias ? (
          <p className="vacio">Y {datos.rutina.length} bloque{datos.rutina.length === 1 ? "" : "s"} de tu rutina: están en <a href="#plan">Plan</a>.</p>
        ) : (
          <>
            <button type="button" className="boton fantasma" aria-expanded={verRutina} onClick={() => setVerRutina((x) => !x)}>
              <Icon name={verRutina ? "chevronUp" : "chevronDown"} size={16} /> Tu rutina de hoy ({datos.rutina.length})
            </button>
            {verRutina && (
              <ul className="rutina-lista">
                {datos.rutina.map((e) => (
                  <li key={`${e.id}:${e.dia}`} style={e.color ? { "--s": e.color } : undefined}>
                    <span className="punto" />
                    <time>{e.inicio ? textoHora(e.inicio) : ""}</time>
                    <button type="button" className="enlace" onClick={() => onAbrir("google", e)}>{e.titulo}</button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    ),
    recordatorios: (
      <>
        {datos.recordatorios.length ? filas(datos.recordatorios) : vacio("Sin recordatorios.")}
        {datos.recordatoriosHechos.length > 0 && <p className="vacio">{datos.recordatoriosHechos.length} ya tenido{datos.recordatoriosHechos.length === 1 ? "" : "s"} en cuenta.</p>}
      </>
    ),
    especiales: datos.especiales.length ? (
      <ul className="lista">
        {datos.especiales.map((e) => (
          <li key={`${e.tipo}:${e.id}:${e.dia}`} className="evento" style={e.tipo === "google" && e.color ? { "--s": e.color } : estiloDe(e.sombrero, sombreros)}>
            <span className="evento-hora">{textoCorto(e.dia, hoy)}</span>
            <div>
              {e.tipo === "google" ? (
                <button type="button" className="evento-titulo enlace" onClick={() => onAbrir("google", e)}>{e.titulo}</button>
              ) : (
                <button type="button" className="evento-titulo enlace" onClick={() => onAbrir(e.tipo, (e.tipo === "accion" ? acciones : eventos).find((x) => x.id === e.id) ?? e)}>{e.titulo}</button>
              )}
              <div className="accion-meta">
                <span>{e.tipo === "google" ? e.calendarioNombre ?? "Google Calendar" : nombreDe(e.sombrero, sombreros)}</span>
                {e.dia === hoy && <span className="chip acento">Hoy</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    ) : vacio("Ningún cumpleaños ni evento especial este mes."),
  };

  return (
    <>
      <h1 className="titulo-pantalla">{saludo(hora, hoy)}, {ajustes.nombre}.</h1>
      <p className="subtitulo">
        Hoy es {textoLargo(hoy)}.{hechasHoy > 0 && ` Llevas ${hechasHoy} hecha${hechasHoy === 1 ? "" : "s"}.`}
      </p>
      {v && (
        <blockquote className="versiculo">
          «{v.texto}»<cite>{v.ref} <span className="solo-lector">({ATRIBUCION})</span></cite>
        </blockquote>
      )}

      {bandeja.length > 0 && (
        <button type="button" className="aviso" style={{ width: "100%", marginTop: "var(--sp-4)", textAlign: "left" }} onClick={onAsistente}>
          <Icon name="inbox" size={18} />
          <span>{bandeja.length} cosa{bandeja.length === 1 ? "" : "s"} que el asistente no pudo ordenar. Ábrelo para volver a intentarlo o aclararla{bandeja.length === 1 ? "" : "s"}.</span>
        </button>
      )}

      <div className="controles-agenda">
        <div className="segmentado" role="group" aria-label="Periodo">
          {Object.entries(PERIODOS).map(([p, t]) => (
            <button key={p} type="button" aria-pressed={periodo === p} onClick={() => ponerPeriodo(p)}>{t}</button>
          ))}
        </div>
        <div className="navegar-periodo">
          <button type="button" className="boton fantasma" aria-label="Anterior" onClick={() => setDia((d) => mover(periodo, d, -1))}><Icon name="chevronLeft" size={18} /></button>
          <strong aria-live="polite">{tituloDe(periodo, dia, hoy)}</strong>
          <button type="button" className="boton fantasma" aria-label="Siguiente" onClick={() => setDia((d) => mover(periodo, d, 1))}><Icon name="chevronRight" size={18} /></button>
          {(dia < r.desde || dia > r.hasta || hoy < r.desde || hoy > r.hasta) && <button type="button" className="boton" onClick={() => setDia(hoy)}>Hoy</button>}
        </div>
        <label className="orden">
          <span>Ordenar por</span>
          <select className="campo" value={orden} onChange={(e) => ponerOrden(e.target.value)}>
            {Object.entries(ORDENES).map(([o, t]) => <option key={o} value={o}>{t}</option>)}
          </select>
        </label>
      </div>

      <div className="filtro-sombreros" role="group" aria-label="Sombreros">
        <button type="button" className="chip-boton" aria-pressed={!filtro} onClick={() => setFiltro(null)}>Todos</button>
        {sombreros.map((s) => (
          <button key={s.id} type="button" className="chip-boton" aria-pressed={filtro === s.id} style={estiloDe(s.id, sombreros)} onClick={() => setFiltro(filtro === s.id ? null : s.id)}>
            <span className="punto" /> {s.nombre}
          </button>
        ))}
      </div>

      <div className="pestanas-columnas" role="tablist" aria-label="Qué ver">
        {COLUMNAS.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={columna === c.id} onClick={() => setColumna(c.id)}>
            <Icon name={c.icono} size={16} /> {c.nombre} <span className="cuenta">{cuenta[c.id]}</span>
          </button>
        ))}
      </div>

      <div className="columnas">
        {COLUMNAS.map((c) => (
          <section key={c.id} className={`columna${columna === c.id ? " activa" : ""}`} aria-labelledby={`col-${c.id}`}>
            <div className="seccion-cabeza">
              <h2 id={`col-${c.id}`}><Icon name={c.icono} size={14} /> {c.nombre}</h2>
              <span className="nota">{c.id === "especiales" ? "del mes" : cuenta[c.id] || ""}</span>
            </div>
            {contenido[c.id]}
            {c.id === "reuniones" && contenido.rutina}
          </section>
        ))}
      </div>
      <p className="vacio" style={{ marginTop: "var(--sp-5)" }}>
        Tu rutina (la oración, la lectura, el trabajo, los servicios) no ocupa Hoy: está en <a href="#plan">Plan</a>. ¿Mañana? <button type="button" className="enlace" onClick={() => { ponerPeriodo("dia"); setDia(sumarDias(hoy, 1)); }}>Ver mañana</button>.
      </p>
    </>
  );
}
