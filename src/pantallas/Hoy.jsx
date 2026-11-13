import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../componentes/Icon.jsx";
import Fila from "../componentes/Fila.jsx";
import AnadirRapido from "../componentes/AnadirRapido.jsx";
import ModoEnfoque from "../componentes/ModoEnfoque.jsx";
import { useDeslizar } from "../hooks/useDeslizar.js";
import { textoCorto, textoHora, sumarDias, rangoCorto, horaCorta, minutos, aHora } from "../lib/fechas.js";
import { sombrerosDe, estiloDe, nombreDe } from "../lib/sombreros.js";
import { variante } from "../lib/mensajes.js";
import { nuevaAccion } from "../lib/metodo.js";
import { ahoraYDespues, tareasDelBloque, carga, semanaDelDia, seriesTraidas, claseDeRitmo, textoHoras } from "../lib/semana.js";
import { ORDENES, rango, mover, tituloDe, accionesDelPeriodo, sinFecha, reunionesDelPeriodo, especialesDelMes, rutinaDelPeriodo, ordenarPor, enfoqueDelDia, TRES, eventosPorAgendar, textoHoraEvento } from "../lib/agenda.js";

const SALUDO = ["Buenos días", "Buen día", "Arrancamos"];
const saludo = (hora, dia) => (hora < "12:00" ? variante(SALUDO, dia) : hora < "19:00" ? "Buenas tardes" : "Buenas noches");

const SECCIONES = [
  { id: "tareas", nombre: "Tareas", icono: "checkSquare" },
  { id: "reuniones", nombre: "Reuniones", icono: "users" },
  { id: "recordatorios", nombre: "Recordatorios", icono: "bell" },
  { id: "especiales", nombre: "Especiales", icono: "star" },
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
 * Hoy. En el teléfono, lo primero es lo que se hace: añadir, el bloque de ahora y tus 3; debajo, tus listas por
 * pestañas. En la computadora, un tablero que cabe en la pantalla sin desplazarla: tu foco, tus tareas y tu agenda
 * (reuniones, recordatorios y especiales) en columnas, cada una se desplaza por dentro. El versículo va en el resumen de
 * la mañana por Telegram (y, en la computadora, en la barra lateral): no ocupa lo primero que ves.
 */
export default function Hoy({ estado, hoy, hora, onHecha, onAbrir, onDecidir, onAsistente, cambiar, onEnfoque, onNoHoy }) {
  const { acciones, eventos, proyectos, ajustes, bandeja = [], externos = [] } = estado;
  const sombreros = sombrerosDe(ajustes);
  // Hoy mira un día (hoy, mañana…): la semana se mira en Plan.
  const [periodo, setPeriodo] = useState("dia");
  const [orden, setOrden] = useState(() => recordado("orden", "prioridad", Object.keys(ORDENES)));
  const [dia, setDia] = useState(hoy);
  const [filtro, setFiltro] = useState(null);
  const [verFiltros, setVerFiltros] = useState(false);
  const [seccion, setSeccion] = useState("tareas");
  // En el teléfono las pestañas (Tareas, Reuniones, Recordatorios, Especiales) también se pasan deslizando con el dedo.
  const [entra, setEntra] = useState(0);
  const pestanas = useRef(null);
  const elegir = (id, paso = 0) => {
    setSeccion(id);
    setEntra(paso);
    const lista = pestanas.current;
    const boton = lista?.querySelector(`#pestana-${id}`);
    if (lista && boton) {
      const r = boton.getBoundingClientRect();
      const l = lista.getBoundingClientRect();
      if (r.left < l.left) lista.scrollLeft -= l.left - r.left + 8;
      else if (r.right > l.right) lista.scrollLeft += r.right - l.right + 8;
    }
  };
  const deslizar = useDeslizar(
    (paso) => {
      const j = SECCIONES.findIndex((s) => s.id === seccion) + paso;
      if (j >= 0 && j < SECCIONES.length) elegir(SECCIONES[j].id, paso);
    },
    () => Boolean(pestanas.current?.offsetParent),
  );
  const [verHechas, setVerHechas] = useState(false);
  const [verSinFecha, setVerSinFecha] = useState(false);
  const [verRutina, setVerRutina] = useState(false);
  const [verReserva, setVerReserva] = useState(false);
  const [enfocado, setEnfocado] = useState(false);

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
      porAgendar: eventosPorAgendar(eventos).filter(deFiltro),
      // Tu semana de hoy (los bloques y recordatorios de Kairos) y la rutina de Google que todavía no trajiste.
      rutina: [
        ...(periodo === "dia" ? (() => { const sd = semanaDelDia(ritmo, dia); return [...sd.bloques, ...sd.compromisos, ...sd.recordatorios].map((e) => ({ ...e, dia, fuente: "kairos" })); })() : []),
        ...rutinaDelPeriodo(externosVis, r, ajustes, eventos),
      ].sort((a, b) => (a.dia + (a.inicio ?? "")).localeCompare(b.dia + (b.inicio ?? ""))),
      especiales: especialesDelMes(acciones, eventos, dia, externosVis, ajustes).filter((e) => !filtro || e.sombrero === filtro || e.fuente === "google"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acciones, eventos, externos, periodo, dia, orden, filtro, hoy, proyectos, ajustes, ritmo]);

  const enfoque = useMemo(() => enfoqueDelDia(acciones, { hoy, proyectos, sombreros }), [acciones, hoy, proyectos, sombreros]);
  // Ahora: el bloque de tu semana en el que estás, sus tareas y lo que sigue (sólo mirando hoy).
  const bloquesHoy = semanaDelDia(ritmo, hoy).bloques;
  const { ahora, despues } = ahoraYDespues(ritmo, hoy, hora ?? "00:00");
  const tareasAhora = ahora ? ordenarPor(tareasDelBloque(acciones, ahora, hoy, { todos: bloquesHoy }), "prioridad", ctx) : [];
  const cargaAhora = ahora ? carga(tareasAhora, ahora) : null;
  const empresasHoy = estado.empresasDeHoy ?? [];
  const hayBloques = ritmo.some((e) => claseDeRitmo(e) === "bloque");
  const hechasHoy = acciones.filter((a) => a.estado === "hecha" && a.hechaEl === hoy).length;
  const pendientesHoy = useMemo(() => accionesDelPeriodo(acciones, { ...rango("dia", hoy), hoy, clase: "tarea" }).abiertas.length, [acciones, hoy]);
  const cuenta = { tareas: datos.tareas.length, reuniones: datos.reuniones.length + datos.porAgendar.length, recordatorios: datos.recordatorios.length, especiales: datos.especiales.length };
  const variosDias = periodo !== "dia";
  const conFoco = hayBloques || enfoque.tres.length > 0 || enfoque.reserva.length > 0;

  const ponerPeriodo = (p) => setPeriodo(p);
  // Modo enfoque: Tus 3 y las tareas del bloque, una a una; los avisos callan hasta el final del bloque (o una hora).
  const paraEnfocar = [...enfoque.tres, ...tareasAhora.filter((a) => !enfoque.tres.some((x) => x.id === a.id))].filter((a) => a.estado === "abierta");
  const hastaEnfoque = ahora?.fin ?? aHora(Math.min(minutos(hora ?? "00:00") + 60, 23 * 60 + 59));
  const enfocarme = () => {
    setEnfocado(true);
    cambiar?.((e) => ({ ...e, ajustes: { ...e.ajustes, enfoque: { dia: hoy, hasta: hastaEnfoque } } }));
  };
  const salirDelEnfoque = () => {
    setEnfocado(false);
    cambiar?.((e) => ({ ...e, ajustes: { ...e.ajustes, enfoque: null } }));
  };

  // Abrir desde el atajo del ícono «Añadir tarea» (/?anadir=1): el campo de añadir, listo para escribir.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.has("anadir")) return;
    setTimeout(() => [...document.querySelectorAll(".anadir-campo")].find((x) => x.offsetParent)?.focus(), 50);
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  }, []);

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

  const compactas = (lista, extra) => (
    <ul className="lista lista-compacta">
      {lista.map((a) => <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={proyectos} compacta onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)} onEnfoque={onEnfoque} mostrarDia={a.cuando !== hoy} {...extra(a)} />)}
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
  const anadirTarea = (donde) => cambiar && <div className={donde}><AnadirRapido sombreros={sombreros} inicial={sombreroPropuesto} paraCuando={paraCuando} onAnadir={anadir} /></div>;

  // «Ver sus tareas» del bloque de ahora: filtra la lista por su sombrero y la enseña.
  const verSusTareas = () => {
    ponerPeriodo("dia");
    setDia(hoy);
    setFiltro(ahora?.sombrero ?? null);
    elegir("tareas");
    requestAnimationFrame(() => document.querySelector(".hoy-pestanas, .hoy-tareas")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  const evento = (e) => {
    const google = e.fuente === "google";
    return (
      <li key={e.clave ?? `${e.fuente ?? "aqui"}:${e.id}:${e.dia ?? "sin-dia"}`} className="evento" style={google && e.color ? { "--s": e.color } : estiloDe(e.sombrero, sombreros)}>
        <span className="evento-hora">{google ? (e.inicio ? textoHora(e.inicio) : "Todo el día") : textoHoraEvento(e)}</span>
        <div>
          <button type="button" className="evento-titulo enlace" onClick={() => (google ? onAbrir("google", e) : onAbrir("evento", eventos.find((x) => x.id === e.id) ?? e))}>{e.titulo}</button>
          <div className="accion-meta">
            {google ? <span>{e.calendarioNombre ?? (e.cuenta ? `Google · ${e.cuenta}` : "Google Calendar")}</span> : <span>{nombreDe(e.sombrero, sombreros)}</span>}
            {e.fin && e.inicio && !e.horaPorDefinir && e.fin !== "23:59" && <span>hasta {textoHora(e.fin)}</span>}
            {e.lugar && <span>{e.lugar}</span>}
            {e.notas && <span title={e.notas}><Icon name="file" size={11} style={{ display: "inline", verticalAlign: "-1px" }} /> Notas</span>}
          </div>
        </div>
      </li>
    );
  };

  const contenido = {
    tareas: (
      <>
        {datos.tareas.length ? filas(datos.tareas, { conDecidir: true, conEstrella: Boolean(onEnfoque) }) : vacio(periodo === "dia" ? "Nada planeado para este día. Mira «Sin fecha» o díselo al asistente." : "Nada planeado en este periodo.")}
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
    reuniones: (
      <>
        {datos.reuniones.length ? porDia(datos.reuniones, (xs) => <ul className="lista">{xs.map(evento)}</ul>) : vacio("Sin reuniones ni citas.")}
        {datos.porAgendar.length > 0 && (
          <div className="por-agendar">
            <h3 className="sub-seccion">Por agendar ({datos.porAgendar.length})</h3>
            <ul className="lista">{datos.porAgendar.map(evento)}</ul>
          </div>
        )}
        {datos.rutina.length > 0 && (
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
                        <time>{e.fuente === "kairos" && claseDeRitmo(e) === "bloque" ? rangoCorto(e.inicio, e.fin) : e.inicio ? horaCorta(e.inicio) : ""}</time>
                        {e.fuente === "kairos" ? <a className="enlace" href="#plan">{e.titulo}</a> : <button type="button" className="enlace" onClick={() => onAbrir("google", e)}>{e.titulo}</button>}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </>
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

  const cabezaSeccion = (s, nota) => (
    <div className="seccion-cabeza hoy-seccion-cabeza">
      <h2 id={`hoy-${s.id}`}><Icon name={s.icono} size={14} /> {s.nombre}</h2>
      <span className="nota">{nota ?? (cuenta[s.id] || "")}</span>
    </div>
  );

  const sombreroFiltrado = filtro && sombreros.find((s) => s.id === filtro);
  const filtrosActivos = Boolean(filtro) || orden !== "prioridad";

  return (
    <div className="hoy" data-entra={entra || undefined}>
      {enfocado && <ModoEnfoque tareas={paraEnfocar} bloque={ahora} hasta={hastaEnfoque} hora={hora} sombreros={sombreros} onHecha={(id) => onHecha(id, { fijar: true })} onSalir={salirDelEnfoque} />}
      <div className="hoy-saludo">
        <h1 className="titulo-pantalla">{saludo(hora, hoy)}, {ajustes.nombre}.</h1>
        <p className="subtitulo">
          {pendientesHoy ? `${pendientesHoy} por hacer hoy` : "Nada pendiente para hoy"}{hechasHoy > 0 && ` · llevas ${hechasHoy} hecha${hechasHoy === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="hoy-controles">
        <div className="navegar-periodo">
          <button type="button" className="boton fantasma" aria-label="Anterior" onClick={() => setDia((d) => mover(periodo, d, -1))}><Icon name="chevronLeft" size={18} /></button>
          <strong aria-live="polite">{tituloDe(periodo, dia, hoy)}</strong>
          <button type="button" className="boton fantasma" aria-label="Siguiente" onClick={() => setDia((d) => mover(periodo, d, 1))}><Icon name="chevronRight" size={18} /></button>
          {(dia < r.desde || dia > r.hasta || hoy < r.desde || hoy > r.hasta) && <button type="button" className="boton" onClick={() => setDia(hoy)}>Hoy</button>}
        </div>
        <button type="button" className={`boton fantasma boton-filtrar${filtrosActivos ? " activo" : ""}`} aria-expanded={verFiltros} aria-controls="hoy-filtros" onClick={() => setVerFiltros((x) => !x)}>
          <Icon name="filter" size={16} /> Filtrar
        </button>
        {sombreroFiltrado && !verFiltros && (
          <button type="button" className="chip-boton" aria-pressed="true" style={estiloDe(filtro, sombreros)} onClick={() => setFiltro(null)} aria-label={`Quitar el filtro de ${sombreroFiltrado.nombre}`}>
            <span className="punto" /> {sombreroFiltrado.nombre} <Icon name="close" size={12} />
          </button>
        )}
      </div>

      {verFiltros && (
        <div className="hoy-filtros" id="hoy-filtros">
          <div className="filtro-sombreros" role="group" aria-label="Sombreros">
            <button type="button" className="chip-boton" aria-pressed={!filtro} onClick={() => setFiltro(null)}>Todos</button>
            {sombreros.map((s) => (
              <button key={s.id} type="button" className="chip-boton" aria-pressed={filtro === s.id} style={estiloDe(s.id, sombreros)} onClick={() => setFiltro(filtro === s.id ? null : s.id)}>
                <span className="punto" /> {s.nombre}
              </button>
            ))}
          </div>
          <label className="orden">
            <span className="solo-lector">Ordenar</span>
            <select className="campo" value={orden} onChange={(e) => ponerOrden(e.target.value)}>
              {Object.entries(ORDENES).map(([o, t]) => <option key={o} value={o}>Por {t.toLowerCase()}</option>)}
            </select>
          </label>
        </div>
      )}

      {bandeja.length > 0 && (
        <button type="button" className="aviso hoy-aviso" onClick={onAsistente}>
          <Icon name="inbox" size={16} />
          <span>{bandeja.length} cosa{bandeja.length === 1 ? "" : "s"} sin ordenar. Toca para aclararla{bandeja.length === 1 ? "" : "s"}.</span>
        </button>
      )}

      <section className="hoy-foco" aria-label="Tu foco de hoy">
        {anadirTarea("solo-movil")}
        {conFoco && (
          <div className="tarjeta foco">
            {hayBloques && (
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
                  {paraEnfocar.length > 0 && cambiar && (
                    <button type="button" className="boton primario boton-enfocarme" onClick={enfocarme}><Icon name="target" size={15} /> Enfocarme</button>
                  )}
                </div>
                {compactas(enfoque.tres, (a) => ({ onHecha: (id) => onHecha(id, { fijar: true }), onHoyNo: a.enfoque !== hoy ? onNoHoy : undefined }))}
                {enfoque.tres.some((a) => a.estado === "abierta" && a.enfoque !== hoy) && (
                  <p className="foco-ayuda">
                    Las de <Icon name="star" size={12} style={{ display: "inline", verticalAlign: "-2px" }} /> vacía te las propongo yo: tócala para fijarla, o <Icon name="close" size={12} style={{ display: "inline", verticalAlign: "-2px" }} /> si hoy no.
                  </p>
                )}
                {enfoque.reserva.length > 0 &&
                  (enfoque.todasHechas ? (
                    <>
                      <p className="enfoque-logro" role="status">¡Hiciste tus {enfoque.tres.length}! Si te queda tiempo, lo siguiente:</p>
                      {compactas(enfoque.reserva, () => ({}))}
                    </>
                  ) : (
                    <div className="plegable">
                      <button type="button" className="boton fantasma" aria-expanded={verReserva} onClick={() => setVerReserva((x) => !x)}>
                        <Icon name={verReserva ? "chevronUp" : "chevronDown"} size={16} /> Si te sobra tiempo ({enfoque.reserva.length})
                      </button>
                      {verReserva && compactas(enfoque.reserva, () => ({}))}
                    </div>
                  ))}
                {enfoque.todasHechas && !enfoque.reserva.length && <p className="enfoque-logro" role="status">¡Hiciste tus {enfoque.tres.length}! No queda nada urgente ni de valor alto.</p>}
              </div>
            )}
          </div>
        )}
      </section>

      <div ref={pestanas} className="hoy-pestanas pestanas-columnas" role="tablist" aria-label="Qué ver (también deslizando con el dedo)">
        {SECCIONES.map((s) => (
          <button key={s.id} type="button" role="tab" id={`pestana-${s.id}`} aria-controls={`panel-${s.id}`} aria-selected={seccion === s.id} onClick={() => elegir(s.id)}>
            <Icon name={s.icono} size={16} /> {s.nombre} <span className="cuenta">{cuenta[s.id]}</span>
          </button>
        ))}
      </div>

      <section className="hoy-tareas hoy-col" id="panel-tareas" role="tabpanel" aria-labelledby="hoy-tareas" data-activa={seccion === "tareas"} {...deslizar}>
        {cabezaSeccion(SECCIONES[0])}
        {anadirTarea("solo-escritorio")}
        {contenido.tareas}
      </section>

      <div className="hoy-agenda hoy-col" {...deslizar}>
        {SECCIONES.slice(1).map((s) => (
          <section key={s.id} className="hoy-agenda-seccion" id={`panel-${s.id}`} role="tabpanel" aria-labelledby={`hoy-${s.id}`} data-activa={seccion === s.id}>
            {cabezaSeccion(s, s.id === "especiales" ? "del mes" : undefined)}
            {contenido[s.id]}
          </section>
        ))}
        <p className="vacio hoy-pie">
          ¿Mañana? <button type="button" className="enlace" onClick={() => { ponerPeriodo("dia"); setDia(sumarDias(hoy, 1)); }}>Ver mañana</button>. Tu rutina está en <a href="#plan">Plan</a>.
        </p>
      </div>
    </div>
  );
}
