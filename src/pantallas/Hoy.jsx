import { useId, useMemo, useState } from "react";
import Icon from "../componentes/Icon.jsx";
import Fila from "../componentes/Fila.jsx";
import { textoLargo, textoCorto, textoHora, sumarDias, rangoCorto, horaCorta } from "../lib/fechas.js";
import { sombrerosDe, estiloDe, nombreDe } from "../lib/sombreros.js";
import { elegirVersiculo, ATRIBUCION } from "../lib/versiculos.js";
import { variante } from "../lib/mensajes.js";
import { nuevaAccion } from "../lib/metodo.js";
import { ahoraYDespues, tareasDelBloque, carga, semanaDelDia, seriesTraidas, claseDeRitmo, textoHoras } from "../lib/semana.js";
import { PERIODOS, ORDENES, rango, mover, tituloDe, accionesDelPeriodo, sinFecha, reunionesDelPeriodo, especialesDelMes, rutinaDelPeriodo, ordenarPor, enfoqueDelDia, TRES } from "../lib/agenda.js";

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
export default function Hoy({ estado, hoy, hora, onHecha, onAbrir, onDecidir, onAsistente, cambiar, onEnfoque, onNoHoy }) {
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
  const [verReserva, setVerReserva] = useState(false);

  const r = rango(periodo, dia);
  const ctx = { hoy, proyectos, sombreros };
  const ritmo = estado.ritmo ?? [];
  // Lo de Google que ya vive en tu semana de Kairos no sale dos veces.
  const traidas = seriesTraidas(ritmo);
  const externosVis = externos.filter((x) => !traidas.has(x.serie));
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
      reuniones: reunionesDelPeriodo(eventos, externosVis, r, ajustes).filter((e) => !filtro || e.sombrero === filtro || e.fuente === "google"),
      // Tu semana de hoy (los bloques y recordatorios de Kairos) y la rutina de Google que todavía no trajiste.
      rutina: [
        ...(periodo === "dia" ? (() => { const sd = semanaDelDia(ritmo, dia); return [...sd.bloques, ...sd.recordatorios].map((e) => ({ ...e, dia, fuente: "kairos" })); })() : []),
        ...rutinaDelPeriodo(externosVis, r, ajustes, eventos),
      ].sort((a, b) => (a.dia + (a.inicio ?? "")).localeCompare(b.dia + (b.inicio ?? ""))),
      especiales: especialesDelMes(acciones, eventos, dia, externosVis, ajustes).filter((e) => !filtro || e.sombrero === filtro || e.fuente === "google"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acciones, eventos, externos, periodo, dia, orden, filtro, hoy, proyectos, ajustes, ritmo]);

  const enfoque = useMemo(() => enfoqueDelDia(acciones, { hoy, proyectos, sombreros }), [acciones, hoy, proyectos, sombreros]);
  const v = elegirVersiculo({ momento: "manana", hoy, frecuencia: ajustes.frecuenciaVersiculos });
  // Ahora: el bloque de tu semana en el que estás, sus tareas y lo que sigue (sólo mirando hoy).
  const bloquesHoy = semanaDelDia(ritmo, hoy).bloques;
  const { ahora, despues } = ahoraYDespues(ritmo, hoy, hora ?? "00:00");
  const tareasAhora = ahora ? ordenarPor(tareasDelBloque(acciones, ahora, hoy, { todos: bloquesHoy }), "prioridad", ctx) : [];
  const cargaAhora = ahora ? carga(tareasAhora, ahora) : null;
  const empresasHoy = estado.empresasDeHoy ?? [];
  const verAhora = periodo === "dia" && dia === hoy && ritmo.some((e) => claseDeRitmo(e) === "bloque");
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

  const filas = (lista, { conDecidir = false, conEstrella = false } = {}) => (
    <ul className="lista">
      {lista.map((a) => (
        <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={proyectos} onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)} onEnfoque={conEstrella ? onEnfoque : undefined} mostrarDia={variosDias || a.cuando !== hoy}>
          {conDecidir && a.estado === "abierta" && a.cuando && a.cuando < hoy && (
            <div className="botones decidir" role="group" aria-label={`¿Cuándo la haces? ${a.titulo}`}>
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

  // Añadir a mano, sin pasar por el asistente: el día que estás mirando (o hoy, si miras la semana o el mes).
  const cuandoAnadir = periodo === "dia" ? dia : hoy;
  const paraCuando = cuandoAnadir === hoy ? "para hoy" : `para el ${textoCorto(cuandoAnadir, hoy)}`;
  // El sombrero que se propone: el filtrado, o el del bloque en que estás (si miras hoy).
  const sombreroPropuesto = filtro ?? (cuandoAnadir === hoy ? ahora?.sombrero ?? null : null);
  const anadir = ({ titulo, sombrero: s, clase, hora: h }) => {
    cambiar?.((e) => ({ ...e, acciones: [...e.acciones, nuevaAccion({ titulo, sombrero: s, clase, hora: h, lista: "siguientes", cuando: cuandoAnadir, origen: "app" }, hoy)] }));
  };
  // «Ver sus tareas» del bloque de ahora: filtra la lista por su sombrero y baja a ella.
  const verSusTareas = () => {
    ponerPeriodo("dia");
    setDia(hoy);
    setFiltro(ahora?.sombrero ?? null);
    setColumna("tareas");
    requestAnimationFrame(() => document.querySelector(".pestanas-columnas")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const contenido = {
    tareas: (
      <>
        {cambiar && <AnadirRapido sombreros={sombreros} inicial={sombreroPropuesto} paraCuando={paraCuando} onAnadir={anadir} />}
        {datos.tareas.length ? filas(datos.tareas, { conDecidir: true, conEstrella: Boolean(onEnfoque) }) : vacio(periodo === "dia" ? "Nada planeado para este día. Mira «Sin fecha» o pídele algo al asistente." : "Nada planeado en este periodo.")}
        {datos.libres.length > 0 && (
          <div className="plegable">
            <button type="button" className="boton fantasma" aria-expanded={verSinFecha} onClick={() => setVerSinFecha((x) => !x)}>
              <Icon name={verSinFecha ? "chevronUp" : "chevronDown"} size={16} /> Sin fecha ({datos.libres.length})
            </button>
            {verSinFecha && filas(datos.libres, { conEstrella: Boolean(onEnfoque) })}
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
                    {e.fuente === "google" ? <span className="chip">{e.calendarioNombre ?? (e.cuenta ? `Google · ${e.cuenta}` : "Google Calendar")}</span> : <span>{nombreDe(e.sombrero, sombreros)}</span>}
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
              <Icon name={verRutina ? "chevronUp" : "chevronDown"} size={16} /> Tu semana hoy ({datos.rutina.length})
            </button>
            {verRutina && (
              <ul className="rutina-lista">
                {datos.rutina.map((e) => (
                  <li key={`${e.fuente}:${e.id}:${e.dia}`} style={e.fuente === "kairos" ? estiloDe(e.sombrero, sombreros) : e.color ? { "--s": e.color } : undefined}>
                    <span className="punto" />
                    <time>{e.inicio ? textoHora(e.inicio) : ""}{e.fuente === "kairos" && claseDeRitmo(e) === "bloque" ? `–${textoHora(e.fin)}` : ""}</time>
                    {e.fuente === "kairos" ? <a className="enlace" href="#plan">{e.titulo}</a> : <button type="button" className="enlace" onClick={() => onAbrir("google", e)}>{e.titulo}</button>}
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
        {cambiar && <AnadirRapido sombreros={sombreros} inicial={sombreroPropuesto} paraCuando={paraCuando} clase="recordatorio" onAnadir={anadir} />}
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

      {(verAhora || enfoque.tres.length > 0 || enfoque.reserva.length > 0) && (
        <section className="tarjeta foco" aria-label="Tu foco de hoy">
          {verAhora && (
            <div className="ahora-tira" style={estiloDe(ahora?.sombrero, sombreros)}>
              <p className="ahora-linea">
                <span className="ahora-etiqueta"><Icon name="clock" size={13} /> Ahora</span>
                {ahora ? (
                  <>
                    <strong>{ahora.titulo}</strong>
                    <span className="nota">{rangoCorto(ahora.inicio, ahora.fin)}</span>
                  </>
                ) : (
                  <strong>Fuera de tus bloques</strong>
                )}
              </p>
              {ahora && ahora.sombrero && sombreros.find((x) => x.id === ahora.sombrero)?.fuente === "juancito-ads" && empresasHoy.length > 0 && (
                <p className="ahora-nota"><Icon name="building" size={13} /> Hoy toca: <strong>{empresasHoy.join(", ")}</strong></p>
              )}
              {ahora?.sombrero === "reino" ? (
                <p className="ahora-nota">Tu tiempo con Dios. Lo demás espera.</p>
              ) : ahora && tareasAhora.length > 0 ? (
                <p className="ahora-nota">
                  {cargaAhora?.sobra > 0 && <span className="rojo-texto">No cabe todo ({textoHoras(cargaAhora.ocupado)} en {textoHoras(cargaAhora.cabe)}). </span>}
                  <button type="button" className="enlace" onClick={verSusTareas}>Ver sus {tareasAhora.length} tarea{tareasAhora.length === 1 ? "" : "s"}</button>
                </p>
              ) : ahora ? (
                <p className="ahora-nota">Nada planeado para este bloque.</p>
              ) : null}
              {despues.length > 0 && <p className="ahora-despues">Después: {despues.map((e) => `${horaCorta(e.inicio)} ${e.titulo}`).join(" · ")}</p>}
            </div>
          )}

          {(enfoque.tres.length > 0 || enfoque.reserva.length > 0) && (
            <div className="foco-tres" aria-labelledby="enfoque-t">
              <div className="foco-cabeza">
                <h2 id="enfoque-t"><Icon name="target" size={14} /> Tus {TRES} de hoy</h2>
                <span className="nota">{enfoque.tres.filter((a) => a.estado === "hecha").length} de {enfoque.tres.length}</span>
              </div>
              <ul className="lista lista-compacta">
                {enfoque.tres.map((a) => (
                  <Fila
                    key={a.id}
                    accion={a}
                    hoy={hoy}
                    sombreros={sombreros}
                    proyectos={proyectos}
                    compacta
                    onHecha={(id) => onHecha(id, { fijar: true })}
                    onAbrir={(x) => onAbrir("accion", x)}
                    onEnfoque={onEnfoque}
                    onHoyNo={a.enfoque !== hoy ? onNoHoy : undefined}
                    mostrarDia={a.cuando !== hoy}
                  />
                ))}
              </ul>
              {enfoque.tres.some((a) => a.estado === "abierta" && a.enfoque !== hoy) && (
                <p className="foco-ayuda">
                  Las de <Icon name="star" size={12} style={{ display: "inline", verticalAlign: "-2px" }} /> vacía te las propongo yo: tócala para fijarla, o <Icon name="close" size={12} style={{ display: "inline", verticalAlign: "-2px" }} /> si hoy no.
                </p>
              )}
              {enfoque.reserva.length > 0 &&
                (enfoque.todasHechas ? (
                  <>
                    <p className="enfoque-logro" role="status">¡Hiciste tus {enfoque.tres.length}! Si te queda tiempo, lo siguiente:</p>
                    <ul className="lista lista-compacta">
                      {enfoque.reserva.map((a) => <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={proyectos} compacta onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)} onEnfoque={onEnfoque} mostrarDia={a.cuando !== hoy} />)}
                    </ul>
                  </>
                ) : (
                  <div className="plegable">
                    <button type="button" className="boton fantasma" aria-expanded={verReserva} onClick={() => setVerReserva((x) => !x)}>
                      <Icon name={verReserva ? "chevronUp" : "chevronDown"} size={16} /> Si te sobra tiempo ({enfoque.reserva.length})
                    </button>
                    {verReserva && (
                      <ul className="lista lista-compacta">
                        {enfoque.reserva.map((a) => <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={proyectos} compacta onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)} onEnfoque={onEnfoque} mostrarDia={a.cuando !== hoy} />)}
                      </ul>
                    )}
                  </div>
                ))}
              {enfoque.todasHechas && !enfoque.reserva.length && <p className="enfoque-logro" role="status">¡Hiciste tus {enfoque.tres.length}! No queda nada urgente ni de valor alto.</p>}
            </div>
          )}
        </section>
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
          <span className="solo-lector">Ordenar</span>
          <select className="campo" value={orden} onChange={(e) => ponerOrden(e.target.value)}>
            {Object.entries(ORDENES).map(([o, t]) => <option key={o} value={o}>Por {t.toLowerCase()}</option>)}
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

/**
 * Añadir a mano: se escribe y Enter. El sombrero se escoge (o se cambia) con los chips que salen al escribir; se propone
 * el filtrado o el del bloque en que estás, y si no, el último que usaste. Un recordatorio puede llevar su hora.
 */
function AnadirRapido({ sombreros, inicial, clase = "tarea", paraCuando = "para hoy", onAnadir }) {
  const id = useId();
  const [titulo, setTitulo] = useState("");
  const [hora, setHora] = useState("");
  const [tocado, setTocado] = useState(null);
  const ultimo = (() => {
    try {
      const v = localStorage.getItem("hoy-sombrero");
      return sombreros.some((x) => x.id === v) ? v : "";
    } catch {
      return "";
    }
  })();
  const elegido = tocado ?? (inicial && sombreros.some((x) => x.id === inicial) ? inicial : ultimo);
  const escoger = (v) => {
    setTocado(v);
    try {
      localStorage.setItem("hoy-sombrero", v);
    } catch {
      /* sin almacenamiento: sólo no se recuerda */
    }
  };
  const enviar = (e) => {
    e.preventDefault();
    const t = titulo.trim();
    if (!t) return;
    onAnadir({ titulo: t, sombrero: elegido || null, clase, hora: clase === "recordatorio" && hora ? hora : null });
    setTitulo("");
    setHora("");
    setTocado(null);
  };
  const esRec = clase === "recordatorio";
  return (
    <form className="anadir" onSubmit={enviar}>
      <div className="anadir-linea" style={estiloDe(elegido, sombreros)}>
        <Icon name={esRec ? "bell" : "plus"} size={18} />
        <label className="solo-lector" htmlFor={`${id}-t`}>{esRec ? "Añadir un recordatorio" : "Añadir una tarea"}</label>
        <input id={`${id}-t`} className="anadir-campo" placeholder={esRec ? `Añadir un recordatorio ${paraCuando}…` : `Añadir una tarea ${paraCuando}…`} value={titulo} onChange={(e) => setTitulo(e.target.value)} autoComplete="off" />
        {esRec && (
          <>
            <label className="solo-lector" htmlFor={`${id}-h`}>Hora (opcional)</label>
            <input id={`${id}-h`} type="time" className="anadir-hora" value={hora} onChange={(e) => setHora(e.target.value)} />
          </>
        )}
        <button type="submit" className="boton primario" disabled={!titulo.trim()}>Añadir</button>
      </div>
      {titulo.trim() && (
        <div className="anadir-sombrero" role="group" aria-label="Sombrero">
          <span>Sombrero:</span>
          {sombreros.map((x) => (
            <button key={x.id} type="button" className="chip-boton" aria-pressed={elegido === x.id} style={estiloDe(x.id, sombreros)} onClick={() => escoger(x.id)}>
              <span className="punto" /> {x.nombre}
            </button>
          ))}
          <button type="button" className="chip-boton" aria-pressed={!elegido} onClick={() => escoger("")}>Ninguno</button>
        </div>
      )}
    </form>
  );
}
