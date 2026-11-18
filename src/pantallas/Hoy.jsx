import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Icon from "../componentes/Icon.jsx";
import Fila from "../componentes/Fila.jsx";
import AnadirRapido from "../componentes/AnadirRapido.jsx";
import PrepararDia from "../componentes/PrepararDia.jsx";
import LoQueViene from "../componentes/LoQueViene.jsx";
import { useDeslizar } from "../hooks/useDeslizar.js";
import { textoCorto, textoLargo, sumarDias, rangoCorto, horaCorta, minutos, aHora } from "../lib/fechas.js";
import { sombrerosDe, estiloDe } from "../lib/sombreros.js";
import { variante } from "../lib/mensajes.js";
import { nuevaAccion } from "../lib/metodo.js";
import { ahoraYDespues, tareasDelBloque, carga, semanaDelDia, seriesTraidas, claseDeRitmo, textoHoras } from "../lib/semana.js";
import { ORDENES, rango, mover, tituloDe, accionesDelPeriodo, sinFecha, ordenarPor, enfoqueDelDia, TRES, eventosPorAgendar, marcasDeDias } from "../lib/agenda.js";
import { agendaDelDia, indiceAhora, gruposDeTareas, avanceDelBloque } from "../lib/vistaHoy.js";

const SALUDO = ["Buenos días", "Buen día", "Arrancamos"];
const saludo = (hora, dia) => (hora < "12:00" ? variante(SALUDO, dia) : hora < "19:00" ? "Buenas tardes" : "Buenas noches");

// En el teléfono, dos pestañas debajo del foco (y se pasan deslizando): las tareas y la agenda del día.
const SECCIONES = [
  { id: "tareas", nombre: "Tareas", icono: "checkSquare" },
  { id: "agenda", nombre: "Agenda", icono: "calendar" },
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
 * Hoy (decisión de Juan: «que se priorice el bloque de hoy, el enfoque y las tareas del día»). En el CENTRO, y más
 * arriba que lo demás, el bloque de ahora con su lista y su tiempo, y tus 3; a la IZQUIERDA, la agenda del día SIN tu
 * rutina (reuniones, eventos y recordatorios, con una raya en «ahora»), lo que está por agendar y lo que viene; a la
 * DERECHA, las demás tareas del día por el bloque en que caen. En el teléfono, el foco arriba y debajo dos pestañas
 * (Tareas y Agenda). El modo enfoque no cambia de pantalla: resalta la tarjeta del centro y deja lo demás borroso.
 */
export default function Hoy({ estado, hoy, hora, onHecha, onAbrir, onDecidir, onAsistente, cambiar, onEnfoque, onNoHoy, avisar = () => {} }) {
  const { acciones, eventos, proyectos, ajustes, bandeja = [], externos = [] } = estado;
  const sombreros = sombrerosDe(ajustes);
  const ahoraH = hora ?? "00:00";
  const [orden, setOrden] = useState(() => recordado("orden", "prioridad", Object.keys(ORDENES)));
  const [dia, setDia] = useState(hoy);
  const [filtro, setFiltro] = useState(null);
  const [verFiltros, setVerFiltros] = useState(false);
  const [seccion, setSeccion] = useState("tareas");
  const [entra, setEntra] = useState(0);
  const pestanas = useRef(null);
  const elegir = (id, paso = 0) => {
    setSeccion(id);
    setEntra(paso);
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
  const [verReserva, setVerReserva] = useState(false);
  const [preparando, setPreparando] = useState(null);
  const [nuevaEnBloque, setNuevaEnBloque] = useState("");

  const r = rango("dia", dia);
  const ctx = { hoy, proyectos, sombreros };
  const ritmo = estado.ritmo ?? [];
  // Lo de Google que ya vive en tu semana de Kairos no sale dos veces.
  const traidas = seriesTraidas(ritmo);
  const externosVis = externos.filter((x) => !traidas.has(x.serie));
  const deFiltro = (x) => !filtro || x.sombrero === filtro;
  const esHoy = dia === hoy;

  // Tus 3 y el bloque de ahora (sólo de hoy).
  const enfoque = useMemo(() => enfoqueDelDia(acciones, { hoy, proyectos, sombreros }), [acciones, hoy, proyectos, sombreros]);
  const tresAbiertas = enfoque.tres.filter((a) => a.estado === "abierta");
  const tresHechas = enfoque.tres.length - tresAbiertas.length;
  const bloquesHoy = semanaDelDia(ritmo, hoy).bloques;
  const { ahora, despues } = ahoraYDespues(ritmo, hoy, ahoraH);
  const tareasAhora = useMemo(
    () => (ahora ? tareasDelBloque(ordenarPor(acciones, "prioridad", ctx), ahora, hoy, { todos: bloquesHoy, ritmo, hoy, proyectos, sombreros }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [acciones, ahora?.id, ahora?.inicio, hoy, ritmo, proyectos, ajustes],
  );
  const cargaAhora = ahora ? carga(tareasAhora, ahora) : null;
  const empresasHoy = estado.empresasDeHoy ?? [];
  const hayBloques = ritmo.some((e) => claseDeRitmo(e) === "bloque");

  // Lo que no se repite: tus 3 van en el centro, y las del bloque de ahora también (mirando hoy).
  const fueraDeLaLista = useMemo(() => new Set(esHoy ? [...enfoque.tres.map((a) => a.id), ...tareasAhora.map((a) => a.id)] : []), [esHoy, enfoque, tareasAhora]);
  const enPlan = (a) => (a.planDia?.dia === dia ? a.planDia.n : Infinity);
  const datos = useMemo(() => {
    const t = accionesDelPeriodo(acciones, { ...r, hoy, clase: "tarea" });
    // En el orden que preparaste para ese día (`planDia`), y lo demás detrás, como lo ordenes.
    const tareas = ordenarPor(t.abiertas.filter(deFiltro), orden, ctx).sort((a, b) => enPlan(a) - enPlan(b));
    return {
      tareas,
      grupos: gruposDeTareas(tareas, ritmo, dia, { hoy, fuera: fueraDeLaLista, proyectos, sombreros }),
      hechas: t.hechas.filter(deFiltro),
      libres: ordenarPor(sinFecha(acciones).filter((a) => deFiltro(a) && !fueraDeLaLista.has(a.id)), orden, ctx),
      agenda: agendaDelDia({ dia, hoy, hora: ahoraH, ritmo, eventos, externos: externosVis, acciones, ajustes }),
      porAgendar: eventosPorAgendar(eventos).filter(deFiltro),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acciones, eventos, externos, dia, orden, filtro, hoy, ahoraH, proyectos, ajustes, ritmo, fueraDeLaLista]);
  const enLista = datos.grupos.reduce((n, g) => n + g.tareas.length, 0);
  const deAgenda = datos.agenda.linea.length + datos.agenda.sinHora.length + datos.agenda.especiales.length;
  const cuenta = { tareas: enLista, agenda: deAgenda };
  const hechasHoy = acciones.filter((a) => a.estado === "hecha" && a.hechaEl === hoy).length;
  const pendientesHoy = useMemo(() => accionesDelPeriodo(acciones, { ...rango("dia", hoy), hoy, clase: "tarea" }).abiertas.length, [acciones, hoy]);

  // ¿Toca preparar? Por la mañana, el día si no lo preparaste; desde las 6 de la tarde, el de mañana.
  const manana = sumarDias(hoy, 1);
  const tocaPreparar = ahoraH >= "18:00" ? (ajustes.preparado !== manana ? manana : null) : ahoraH < "12:00" && ajustes.preparado !== hoy ? hoy : null;

  // Modo enfoque: la tarjeta del centro se queda (tus 3 y lo del bloque); lo demás, borroso hasta salir o acabar el
  // bloque. Se guarda en los ajustes (también calla los avisos de Telegram).
  const paraEnfocar = [...enfoque.tres, ...tareasAhora.filter((a) => !enfoque.tres.some((x) => x.id === a.id))].filter((a) => a.estado === "abierta");
  const hastaEnfoque = ahora?.fin ?? aHora(Math.min(minutos(ahoraH) + 60, 23 * 60 + 59));
  const enfoqueActivo = ajustes.enfoque?.dia === hoy && Boolean(ajustes.enfoque.hasta) && ahoraH < ajustes.enfoque.hasta;
  const enfocarme = () => {
    setDia(hoy);
    cambiar?.((e) => ({ ...e, ajustes: { ...e.ajustes, enfoque: { dia: hoy, hasta: hastaEnfoque, bloque: ahora?.id ?? null, ids: paraEnfocar.map((a) => a.id) } } }));
  };
  const salirDelEnfoque = () => cambiar?.((e) => ({ ...e, ajustes: { ...e.ajustes, enfoque: null } }));

  // Al enfocarse, la tarjeta a la vista (en el teléfono puede quedar a media pantalla).
  useEffect(() => {
    if (enfoqueActivo) document.querySelector(".foco-activo")?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [enfoqueActivo]);

  // Escape sale del enfoque (si no hay un diálogo abierto encima).
  useEffect(() => {
    if (!enfoqueActivo) return undefined;
    const tecla = (e) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"]')) salirDelEnfoque();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enfoqueActivo]);

  // Abrir desde el atajo del ícono «Añadir tarea» (/?anadir=1): el campo de añadir, listo para escribir.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.has("anadir")) return;
    setTimeout(() => [...document.querySelectorAll(".anadir-campo")].find((x) => x.offsetParent)?.focus(), 50);
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  }, []);

  // «#preparar» (el enlace del cierre de Telegram) abre «Prepara mañana» (o tu día, por la mañana).
  useEffect(() => {
    const mirar = () => {
      if (window.location.hash !== "#preparar") return;
      setPreparando({ dia: null });
      window.history.replaceState(null, "", "#hoy");
    };
    mirar();
    window.addEventListener("hashchange", mirar);
    return () => window.removeEventListener("hashchange", mirar);
  }, []);

  const ponerOrden = (o) => {
    setOrden(o);
    recordar("orden", o);
  };

  const filas = (lista, { conDecidir = false } = {}) => (
    <ul className="lista">
      {lista.map((a) => (
        <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={proyectos} onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)} onEnfoque={onEnfoque} mostrarDia={a.cuando !== dia}>
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

  const compactas = (lista, extra = () => ({}), clase = "") => (
    <ul className={`lista lista-compacta ${clase}`}>
      {lista.map((a) => <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={proyectos} compacta onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)} onEnfoque={onEnfoque} mostrarDia={a.cuando !== hoy} {...extra(a)} />)}
    </ul>
  );

  const vacio = (texto) => <p className="vacio">{texto}</p>;

  // Añadir a mano, sin pasar por el asistente: el día que estás mirando.
  const paraCuando = esHoy ? "para hoy" : `para el ${textoCorto(dia, hoy)}`;
  // El sombrero que se propone: el filtrado, o el del bloque en que estás (si miras hoy).
  const sombreroPropuesto = filtro ?? (esHoy ? ahora?.sombrero ?? null : null);
  const anadir = ({ titulo, sombrero: s, clase, hora: h }) => {
    cambiar?.((e) => ({ ...e, acciones: [...e.acciones, nuevaAccion({ titulo, sombrero: s, clase, hora: h, lista: "siguientes", cuando: dia, origen: "app" }, hoy)] }));
  };
  const anadirTarea = (donde) => cambiar && <div className={donde}><AnadirRapido sombreros={sombreros} inicial={sombreroPropuesto} paraCuando={paraCuando} onAnadir={anadir} /></div>;

  // ------------------------------------------------------------
  // El centro: el bloque de ahora y tus 3
  // ------------------------------------------------------------
  const bloqueVista = enfoqueActivo ? bloquesHoy.find((b) => b.id === ajustes.enfoque.bloque) ?? ahora : ahora;
  const avance = bloqueVista ? avanceDelBloque(bloqueVista, ahoraH) : null;
  const idsEntrada = enfoqueActivo ? ajustes.enfoque.ids ?? [] : [];
  const listaEnfoque = enfoqueActivo
    ? [...idsEntrada.map((x) => acciones.find((a) => a.id === x)).filter((a) => a && (a.estado === "abierta" || (a.estado === "hecha" && a.hechaEl === hoy))), ...paraEnfocar.filter((a) => !idsEntrada.includes(a.id))]
    : [];
  const enCentro = enfoqueActivo ? listaEnfoque.filter((a) => a.estado === "abierta") : tareasAhora;
  const tresFuera = tresAbiertas.filter((a) => !tareasAhora.some((t) => t.id === a.id));
  const siguienteBloque = !ahora ? bloquesHoy.find((b) => b.inicio > ahoraH) : null;
  const proximos = [
    ...despues.map((e) => ({ clave: `r:${e.id}`, hora: e.inicio, titulo: e.titulo })),
    ...(esHoy ? datos.agenda.linea : agendaDelDia({ dia: hoy, hoy, hora: ahoraH, ritmo, eventos, externos: externosVis, acciones, ajustes }).linea)
      .filter((x) => ["reunion", "evento", "recordatorio"].includes(x.tipo) && x.inicio > ahoraH)
      .map((x) => ({ clave: x.clave, hora: x.inicio, titulo: x.titulo })),
  ]
    .sort((a, b) => a.hora.localeCompare(b.hora))
    .slice(0, 3);
  const anadirAlBloque = (e) => {
    e.preventDefault();
    const t = nuevaEnBloque.trim();
    if (!t || !bloqueVista) return;
    cambiar?.((x) => ({ ...x, acciones: [...x.acciones, nuevaAccion({ titulo: t, sombrero: bloqueVista.sombrero ?? null, lista: "siguientes", cuando: hoy, bloque: bloqueVista.id, origen: "app" }, hoy)] }));
    setNuevaEnBloque("");
  };
  const tresDelDia = !esHoy ? acciones.filter((a) => a.estado === "abierta" && a.enfoque === dia).sort((a, b) => enPlan(a) - enPlan(b)) : [];

  const tarjetaHoy = (
    <div className={`tarjeta foco${enfoqueActivo ? " foco-activo" : ""}`} style={estiloDe(bloqueVista?.sombrero ?? (enfoqueActivo ? enCentro[0]?.sombrero : null), sombreros)}>
      <div className="foco-ahora">
        <div className="foco-ahora-cabeza">
          <p className="ahora-etiqueta">{enfoqueActivo ? <><Icon name="target" size={13} /> Enfocado</> : <><Icon name="clock" size={13} /> Ahora</>}</p>
          {enfoqueActivo ? (
            <button type="button" className="boton fantasma boton-salir" onClick={salirDelEnfoque}><Icon name="close" size={14} /> Salir del enfoque</button>
          ) : (
            paraEnfocar.length > 0 && cambiar && <button type="button" className="boton boton-enfocarme" onClick={enfocarme} title="Lo demás se aparta hasta que termine el bloque"><Icon name="target" size={14} /> Enfocarme</button>
          )}
        </div>
        {bloqueVista ? (
          <>
            <h2 className="foco-bloque">{bloqueVista.titulo.trim()}</h2>
            <p className="foco-meta">
              {rangoCorto(bloqueVista.inicio, bloqueVista.fin)}
              {avance.quedan > 0 && ` · quedan ${textoHoras(avance.quedan)}`}
              {enfoqueActivo && listaEnfoque.length > 0 && ` · ${listaEnfoque.length - enCentro.length} de ${listaEnfoque.length} hechas`}
            </p>
            <div className="foco-tiempo" role="progressbar" aria-label="Tiempo del bloque" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(avance.parte * 100)}>
              <span style={{ width: `${Math.round(avance.parte * 100)}%` }} />
            </div>
            {bloqueVista.sombrero && sombreros.find((x) => x.id === bloqueVista.sombrero)?.fuente === "juancito-ads" && empresasHoy.length > 0 && (
              <p className="foco-nota"><Icon name="building" size={13} /> Hoy toca: <strong>{empresasHoy.join(", ")}</strong></p>
            )}
          </>
        ) : (
          <>
            <h2 className="foco-bloque">{enfoqueActivo ? "Una cosa a la vez" : hayBloques ? "Fuera de tus bloques" : "Tu día"}</h2>
            <p className="foco-meta">
              {enfoqueActivo ? `hasta las ${horaCorta(ajustes.enfoque.hasta)}` : siguienteBloque ? `Lo próximo: ${horaCorta(siguienteBloque.inicio)} ${siguienteBloque.titulo.trim()}` : "Lo importante de hoy, abajo."}
            </p>
          </>
        )}
      </div>

      {bloqueVista?.sombrero === "reino" && !enfoqueActivo ? (
        <p className="foco-nota foco-reino">Tu tiempo con Dios. Lo demás espera.</p>
      ) : (
        (bloqueVista || enfoqueActivo) && (
          <div className="foco-lista">
            {enCentro.length ? compactas(enCentro, () => ({}), "con-siguiente") : vacio(enfoqueActivo ? "¡Terminaste lo de este rato! Añade lo siguiente o sal del enfoque." : "Nada planeado para este bloque.")}
            {!enfoqueActivo && cargaAhora?.sobra > 0 && <p className="foco-nota rojo-texto">No cabe todo: {textoHoras(cargaAhora.ocupado)} de tareas en {textoHoras(cargaAhora.cabe)}.</p>}
            {cambiar && bloqueVista && (
              <form className="foco-anadir" onSubmit={anadirAlBloque}>
                <Icon name="plus" size={15} />
                <label className="solo-lector" htmlFor="hoy-anadir-bloque">Añadir a {bloqueVista.titulo.trim()}</label>
                <input id="hoy-anadir-bloque" className="anadir-campo" placeholder={`Añadir a ${bloqueVista.titulo.trim()}…`} value={nuevaEnBloque} onChange={(e) => setNuevaEnBloque(e.target.value)} />
              </form>
            )}
          </div>
        )
      )}

      {!enfoqueActivo && (enfoque.tres.length > 0 || enfoque.reserva.length > 0) && (
        <div className="foco-tres" aria-labelledby="enfoque-t">
          <div className="foco-cabeza">
            <h3 id="enfoque-t"><Icon name="star" size={13} /> Tus {TRES} de hoy</h3>
            {enfoque.tres.length > 0 && (
              <span className="foco-avance" aria-label={`${tresHechas} de ${enfoque.tres.length} hechas`}>
                {enfoque.tres.map((a) => <span key={a.id} className={a.estado === "hecha" ? "lleno" : undefined} />)}
              </span>
            )}
          </div>
          {tresFuera.length > 0 && compactas(tresFuera, (a) => ({ onHecha: (id) => onHecha(id, { fijar: true }), onHoyNo: a.enfoque !== hoy ? onNoHoy : undefined }))}
          {tresFuera.length === 0 && tresAbiertas.length > 0 && <p className="foco-ayuda">Las que te quedan van en este bloque, arriba.</p>}
          {tresFuera.some((a) => a.enfoque !== hoy) && (
            <p className="foco-ayuda">
              Las de <Icon name="star" size={12} style={{ display: "inline", verticalAlign: "-2px" }} /> vacía te las propongo yo: tócala para fijarla, o <Icon name="close" size={12} style={{ display: "inline", verticalAlign: "-2px" }} /> si hoy no.
            </p>
          )}
          {enfoque.reserva.length > 0 &&
            (enfoque.todasHechas ? (
              <>
                <p className="enfoque-logro" role="status">¡Hiciste tus {enfoque.tres.length}! Si te queda tiempo, lo siguiente:</p>
                {compactas(enfoque.reserva)}
              </>
            ) : (
              <div className="plegable">
                <button type="button" className="boton fantasma" aria-expanded={verReserva} onClick={() => setVerReserva((x) => !x)}>
                  <Icon name={verReserva ? "chevronUp" : "chevronDown"} size={16} /> Si te sobra tiempo ({enfoque.reserva.length})
                </button>
                {verReserva && compactas(enfoque.reserva)}
              </div>
            ))}
          {enfoque.todasHechas && !enfoque.reserva.length && <p className="enfoque-logro" role="status">¡Hiciste tus {enfoque.tres.length}! No queda nada urgente ni de valor alto.</p>}
        </div>
      )}

      {enfoqueActivo ? (
        <p className="foco-pie"><Icon name="bell" size={12} /> Avisos en silencio hasta las {horaCorta(ajustes.enfoque.hasta)}, menos tus recordatorios fijos y las reuniones.</p>
      ) : (
        proximos.length > 0 && <p className="foco-pie solo-movil">Después: {proximos.map((e) => `${horaCorta(e.hora)} ${e.titulo}`).join(" · ")}</p>
      )}
    </div>
  );

  // Mirando otro día: lo que preparaste para él.
  const tarjetaOtroDia = (
    <div className="tarjeta foco">
      <div className="foco-ahora">
        <p className="ahora-etiqueta"><Icon name="calendar" size={13} /> {dia > hoy ? "Lo que viene" : "Ese día"}</p>
        <h2 className="foco-bloque">{textoLargo(dia).replace(/^./, (c) => c.toUpperCase())}</h2>
      </div>
      <div className="foco-tres">
        <div className="foco-cabeza"><h3><Icon name="star" size={13} /> Tus {TRES}</h3></div>
        {tresDelDia.length ? compactas(tresDelDia) : vacio(dia > hoy ? "Aún no lo preparaste." : "No escogiste tus 3 ese día.")}
        {cambiar && dia > hoy && (
          <button type="button" className="boton fantasma foco-preparar" onClick={() => setPreparando({ dia })}><Icon name="list" size={15} /> Preparar este día</button>
        )}
      </div>
    </div>
  );

  // ------------------------------------------------------------
  // La agenda del día, en orden de hora
  // ------------------------------------------------------------
  const ag = datos.agenda;
  // Lo que viene después del día que miras (como en el panel de Plan): lo especial, lo que no se repite y los recordatorios.
  const viene = useMemo(() => marcasDeDias(estado, sumarDias(dia, 1), sumarDias(hoy, 45), { recordatorios: true }), [estado, dia, hoy]);
  const abrirMarca = (m) => (m.de === "accion" ? onAbrir("accion", acciones.find((a) => a.id === m.obj.id) ?? m.obj) : m.de === "google" ? onAbrir("google", m.obj) : onAbrir("evento", eventos.find((e) => e.id === m.obj.id) ?? m.obj));
  const iAhora = indiceAhora(ag.linea, { dia, hoy, hora: ahoraH });
  const abrirItem = (x) => {
    if (x.fuente === "google") return onAbrir("google", x.obj);
    if (x.tipo === "recordatorio") return onAbrir("accion", x.obj);
    if (x.tipo === "reunion" || x.tipo === "evento") return onAbrir("evento", eventos.find((e) => e.id === x.obj.id) ?? x.obj);
    window.location.hash = "plan";
    return undefined;
  };
  const estiloItem = (x) => (x.fuente === "google" && x.color ? { "--s": x.color } : estiloDe(x.sombrero, sombreros));
  const marcaAhora = (
    <li className="linea-ahora" aria-label={`Ahora, ${horaCorta(ahoraH)}`}>
      <span>{horaCorta(ahoraH)}</span>
    </li>
  );
  const itemAgenda = (x) => (
    <li className={`linea-item t-${x.tipo}${x.pasado ? " pasado" : ""}${x.tipo === "bloque" && ahora?.id === x.obj.id && esHoy ? " es-ahora" : ""}`} style={estiloItem(x)}>
      <time>{horaCorta(x.inicio)}</time>
      <span className="linea-punto" aria-hidden="true" />
      <div className="linea-texto">
        <button type="button" className="enlace" onClick={() => abrirItem(x)}>
          {x.tipo === "reunion" && <Icon name="users" size={12} />}
          {(x.tipo === "recordatorio" || x.tipo === "fijo") && <Icon name="bell" size={12} />}
          {x.titulo.trim()}
        </button>
        {(x.tipo === "bloque" || x.tipo === "reunion" || x.tipo === "evento") && x.fin && x.fin !== "23:59" && <small>hasta {horaCorta(x.fin)}</small>}
        {x.fuente === "google" && x.obj.calendarioNombre && x.tipo !== "rutina" && <small>{x.obj.calendarioNombre}</small>}
      </div>
      {x.tipo === "recordatorio" && (
        <button type="button" className="marcar linea-marcar" aria-label={`Ya lo tuve en cuenta: ${x.titulo}`} onClick={() => onHecha(x.obj.id)}>
          <Icon name="check" size={12} strokeWidth={3} />
        </button>
      )}
    </li>
  );

  const agenda = (
    <>
      {ag.especiales.length > 0 && (
        <ul className="agenda-especiales">
          {ag.especiales.map((e) => (
            <li key={`${e.tipo}:${e.id}`} style={e.tipo === "google" && e.color ? { "--s": e.color } : estiloDe(e.sombrero, sombreros)}>
              <Icon name="star" size={13} />
              <button type="button" className="enlace" onClick={() => onAbrir(e.tipo === "google" ? "google" : e.tipo, e.tipo === "google" ? e : (e.tipo === "accion" ? acciones : eventos).find((x) => x.id === e.id) ?? e)}>{e.titulo}</button>
            </li>
          ))}
        </ul>
      )}
      {ag.sinHora.length > 0 && (
        <ul className="linea sin-hora">
          {ag.sinHora.map((x) => (
            <li key={x.clave} className={`linea-item t-${x.tipo}`} style={estiloItem(x)}>
              <time>{x.tipo === "recordatorio" ? "Sin hora" : x.obj.horaPorDefinir ? "Por definir" : "Todo el día"}</time>
              <span className="linea-punto" aria-hidden="true" />
              <div className="linea-texto">
                <button type="button" className="enlace" onClick={() => abrirItem(x)}>{x.tipo === "recordatorio" && <Icon name="bell" size={12} />}{x.titulo.trim()}</button>
              </div>
              {x.tipo === "recordatorio" && (
                <button type="button" className="marcar linea-marcar" aria-label={`Ya lo tuve en cuenta: ${x.titulo}`} onClick={() => onHecha(x.obj.id)}>
                  <Icon name="check" size={12} strokeWidth={3} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {ag.linea.length ? (
        <ol className="linea">
          {ag.linea.map((x, i) => (
            <Fragment key={x.clave}>
              {i === iAhora && marcaAhora}
              {itemAgenda(x)}
            </Fragment>
          ))}
          {iAhora === ag.linea.length && marcaAhora}
        </ol>
      ) : (
        !ag.especiales.length && !ag.sinHora.length && vacio(esHoy ? "Hoy no tienes reuniones ni recordatorios." : "Nada en la agenda de este día.")
      )}
      {cambiar && <div className="agenda-anadir"><AnadirRapido sombreros={sombreros} inicial={sombreroPropuesto} paraCuando={paraCuando} clase="recordatorio" onAnadir={anadir} /></div>}
      {datos.porAgendar.length > 0 && (
        <div className="agenda-bloque">
          <h3 className="agenda-sub">Por agendar <small>{datos.porAgendar.length}</small></h3>
          <ul className="linea sin-hora">
            {datos.porAgendar.map((e) => (
              <li key={e.id} className="linea-item t-reunion" style={estiloDe(e.sombrero, sombreros)}>
                <time>{e.clase === "reunion" ? "Reunión" : "Evento"}</time>
                <span className="linea-punto" aria-hidden="true" />
                <div className="linea-texto"><button type="button" className="enlace" onClick={() => onAbrir("evento", e)}>{e.clase === "reunion" && <Icon name="users" size={12} />}{e.titulo}</button></div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="agenda-bloque agenda-viene">
        <LoQueViene marcas={viene} hoy={hoy} sombreros={sombreros} onAbrir={abrirMarca} onDia={(d) => setDia(d)} max={6} vacio="Nada especial en las próximas semanas." />
      </div>
      <p className="vacio hoy-pie">
        {esHoy ? (
          <>¿Mañana? <button type="button" className="enlace" onClick={() => setDia(manana)}>Ver mañana</button>. Tu semana está en <a href="#plan">Plan</a>.</>
        ) : (
          <>Tu semana está en <a href="#plan">Plan</a>.</>
        )}
      </p>
    </>
  );

  // ------------------------------------------------------------
  // Las demás tareas del día, por el bloque en que caen
  // ------------------------------------------------------------
  const tituloGrupo = (g) =>
    g.tipo === "decidir" ? (
      <h4 className="grupo-tareas-h decidir">Quedaron de antes: ¿cuándo?</h4>
    ) : g.tipo === "bloque" ? (
      <h4 className="grupo-tareas-h" style={estiloDe(g.bloque.sombrero, sombreros)}>
        <span className="punto" /> {g.bloque.titulo.trim()} <small>{rangoCorto(g.bloque.inicio, g.bloque.fin)}</small>
      </h4>
    ) : datos.grupos.length > 1 ? (
      <h4 className="grupo-tareas-h">Sin bloque</h4>
    ) : null;

  const tareas = (
    <>
      {datos.grupos.length ? (
        datos.grupos.map((g) => (
          <div key={g.clave} className="grupo-hoy">
            {tituloGrupo(g)}
            {filas(g.tareas, { conDecidir: g.tipo === "decidir" })}
          </div>
        ))
      ) : (
        vacio(esHoy && (tareasAhora.length || tresAbiertas.length) ? "Nada más para hoy fuera de tu foco." : "Nada planeado para este día. Mira «Sin fecha» o díselo al asistente.")
      )}
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
  );

  const cabeza = (s, texto) => (
    <div className="seccion-cabeza hoy-seccion-cabeza">
      <h2 id={`hoy-${s.id}`}><Icon name={s.icono} size={14} /> {texto}</h2>
      <span className="nota">{cuenta[s.id] || ""}</span>
    </div>
  );

  const sombreroFiltrado = filtro && sombreros.find((s) => s.id === filtro);
  const filtrosActivos = Boolean(filtro) || orden !== "prioridad";
  const quieto = enfoqueActivo; // lo que se aparta (borroso, sin responder) mientras dura el enfoque

  return (
    <div className={`hoy${enfoqueActivo ? " enfocado" : ""}`} data-entra={entra || undefined}>
      {preparando && <PrepararDia estado={estado} hoy={hoy} hora={hora} sombreros={sombreros} cambiar={cambiar} avisar={avisar} diaInicial={preparando.dia} onCerrar={() => setPreparando(null)} />}
      <div className="hoy-saludo" inert={quieto}>
        <h1 className="titulo-pantalla">{saludo(ahoraH, hoy)}, {ajustes.nombre}.</h1>
        <p className="subtitulo">
          {pendientesHoy ? `${pendientesHoy} por hacer hoy` : "Nada pendiente para hoy"}{hechasHoy > 0 && ` · llevas ${hechasHoy} hecha${hechasHoy === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="hoy-controles" inert={quieto}>
        <div className="navegar-periodo">
          <button type="button" className="boton fantasma" aria-label="Día anterior" onClick={() => setDia((d) => mover("dia", d, -1))}><Icon name="chevronLeft" size={18} /></button>
          <strong aria-live="polite">{tituloDe("dia", dia, hoy)}</strong>
          <button type="button" className="boton fantasma" aria-label="Día siguiente" onClick={() => setDia((d) => mover("dia", d, 1))}><Icon name="chevronRight" size={18} /></button>
          {!esHoy && <button type="button" className="boton" onClick={() => setDia(hoy)}>Hoy</button>}
        </div>
        {cambiar && (
          <button type="button" className="boton fantasma boton-preparar" onClick={() => setPreparando({ dia: null })} title="Escoge tus 3 y ordena lo demás">
            <Icon name="list" size={16} /> {ahoraH >= "15:00" ? "Preparar mañana" : "Preparar el día"}
          </button>
        )}
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
        <div className="hoy-filtros" id="hoy-filtros" inert={quieto}>
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
        <button type="button" className="aviso hoy-aviso hoy-aviso-bandeja" onClick={onAsistente} inert={quieto}>
          <Icon name="inbox" size={16} />
          <span>{bandeja.length} cosa{bandeja.length === 1 ? "" : "s"} sin ordenar. Toca para aclararla{bandeja.length === 1 ? "" : "s"}.</span>
        </button>
      )}
      {tocaPreparar && cambiar && (
        <button type="button" className="prep-aviso hoy-aviso-prep" onClick={() => setPreparando({ dia: tocaPreparar })} inert={quieto}>
          <Icon name="list" size={16} />
          <span>{tocaPreparar === hoy ? "Prepara tu día: escoge tus 3 y el orden de lo demás." : "¿Preparamos mañana? Escoge tus 3 y el orden."}</span>
          <Icon name="chevronRight" size={16} />
        </button>
      )}

      <section className="hoy-foco" aria-label="Tu foco de hoy">
        <div inert={quieto} className="hoy-foco-anadir">{anadirTarea("solo-movil")}</div>
        {esHoy || enfoqueActivo ? tarjetaHoy : tarjetaOtroDia}
      </section>

      <div ref={pestanas} className="hoy-pestanas pestanas-columnas" role="tablist" aria-label="Qué ver (también deslizando con el dedo)" inert={quieto}>
        {SECCIONES.map((s) => (
          <button key={s.id} type="button" role="tab" id={`pestana-${s.id}`} aria-controls={`panel-${s.id}`} aria-selected={seccion === s.id} onClick={() => elegir(s.id)}>
            <Icon name={s.icono} size={16} /> {s.nombre} <span className="cuenta">{cuenta[s.id]}</span>
          </button>
        ))}
      </div>

      <section className="hoy-tareas hoy-col" id="panel-tareas" role="tabpanel" aria-labelledby="hoy-tareas" data-activa={seccion === "tareas"} inert={quieto} {...deslizar}>
        {cabeza(SECCIONES[0], esHoy ? (tareasAhora.length || enfoque.tres.length ? "Más tareas de hoy" : "Tareas de hoy") : `Tareas del ${textoCorto(dia, hoy)}`)}
        {anadirTarea("solo-escritorio")}
        {tareas}
      </section>

      <section className="hoy-agenda hoy-col" id="panel-agenda" role="tabpanel" aria-labelledby="hoy-agenda" data-activa={seccion === "agenda"} inert={quieto} {...deslizar}>
        {cabeza(SECCIONES[1], esHoy ? "Agenda de hoy" : `Agenda del ${textoCorto(dia, hoy)}`)}
        {agenda}
      </section>
    </div>
  );
}

