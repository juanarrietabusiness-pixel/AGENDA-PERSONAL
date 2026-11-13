import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { estiloDe } from "../lib/sombreros.js";
import { DIAS, DIAS_CORTOS, partes, diaSemana, minutos, horaCorta, rangoCorto, aHora } from "../lib/fechas.js";
import { carriles, huecos, rangoDeLaRejilla, ventanaDelDia, aPaso } from "../lib/rejilla.js";
import { textoHoras } from "../lib/semana.js";
import { zonaDeSoltar, empezarArrastre } from "../lib/arrastre.js";

const DENTRO_MAX = 3; // tareas que se ven dentro de un bloque
const UMBRAL = 5; // píxeles que hay que mover para que sea arrastrar y no tocar

/** Lo que se puede mover arrastrando: lo de Kairos (no lo que sigue en Google, que se cambia allá). */
const movible = (p) => p.tipo === "bloque" || p.tipo === "compromiso" || p.tipo === "tarea" || (p.tipo === "evento" && p.obj?.fuente === "agenda");

/**
 * La semana como un calendario con horas (en la computadora), para TRABAJAR en ella:
 *   · arrastra en un espacio vacío (o tócalo) para crear algo ahí: `onCrear({ dia, inicio, fin })`;
 *   · arrastra un bloque, un compromiso, una reunión o una tarea para moverlo; su borde de abajo, para estirarlo:
 *     `onMover(pieza, { dia, inicio, fin })`;
 *   · suelta ahí una tarea que arrastras desde el panel: `onSoltar(d, { dia, hora, bloque })`.
 * Cada cosa del alto de lo que dura; lo que no es un bloque, en gris y sin caja. Con `tipo`, es la semana tipo.
 */
export default function SemanaRejilla({ dias, hoy, hora, ajustes, sombreros, tipo = false, elegido = null, onBloque, onAbrir, onCrear, onMover, onSoltar }) {
  const cuerpo = useRef(null);
  const lienzo = useRef(null);
  const gesto = useRef(null);
  const sinClic = useRef(false);
  const [fantasma, setFantasma] = useState(null);
  const { desde, hasta } = rangoDeLaRejilla(dias, ajustes);
  const total = (hasta - desde) * 60;
  const pos = (h) => `${((minutos(h) - desde * 60) / total) * 100}%`;
  const alto = (a, b) => `${(Math.max(minutos(b) - minutos(a), 15) / total) * 100}%`;
  const horas = Array.from({ length: hasta - desde }, (_, i) => desde + i);

  // Al abrir, se ve desde un poco antes de ahora (o desde que despierta).
  useEffect(() => {
    const c = cuerpo.current;
    if (!c) return;
    const desdeHora = dias.some((d) => d.dia === hoy) && hora ? Math.max(desde, Math.floor(minutos(hora) / 60) - 1) : desde;
    c.scrollTop = ((desdeHora - desde) / (hasta - desde)) * c.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Dónde cae un punto de la pantalla: el día (por la columna) y los minutos (por la altura). */
  const lugar = (x, y) => {
    const r = lienzo.current.getBoundingClientRect();
    const ancho = (r.width - 48) / dias.length;
    const i = Math.max(0, Math.min(dias.length - 1, Math.floor((x - r.left - 48) / ancho)));
    return { dia: dias[i].dia, min: ((y - r.top) / r.height) * total + desde * 60 };
  };

  const abrirPieza = (p, dia) => {
    if (sinClic.current) return;
    if (p.tipo === "bloque") onBloque(p.obj, dia);
    else if (p.tipo === "compromiso") onAbrir("ritmo", p.obj, dia);
    else if (p.tipo === "evento") onAbrir(p.obj.fuente === "google" ? "google" : "evento", p.obj);
    else if (p.tipo === "tarea" || p.obj.tipo === "accion") onAbrir("accion", p.obj);
  };

  // ---- Arrastrar con el puntero: crear (en lo vacío), mover o estirar (una pieza) ----
  const empezar = (e, datos) => {
    if (e.button !== 0) return;
    gesto.current = { ...datos, x0: e.clientX, y0: e.clientY, activo: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const seguir = (e) => {
    const g = gesto.current;
    if (!g) return;
    if (!g.activo && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < UMBRAL) return;
    g.activo = true;
    const { dia, min } = lugar(e.clientX, e.clientY);
    if (g.modo === "crear") {
      const a = Math.min(g.min0, min);
      const b = Math.max(g.min0, min);
      setFantasma({ dia: g.dia, inicio: aPaso(a), fin: aPaso(Math.max(b, a + 15)) });
    } else if (g.modo === "mover") {
      const dur = minutos(g.p.fin) - minutos(g.p.inicio);
      const ini = Math.max(0, Math.min(24 * 60 - dur, minutos(g.p.inicio) + (min - g.min0)));
      setFantasma({ dia, inicio: aPaso(ini), fin: aHora(Math.min(23 * 60 + 59, minutos(aPaso(ini)) + dur)), titulo: g.p.titulo });
    } else if (g.modo === "estirar") {
      setFantasma({ dia: g.dia, inicio: g.p.inicio, fin: aPaso(Math.max(minutos(g.p.inicio) + 15, min)), titulo: g.p.titulo });
    }
  };
  const terminar = (e) => {
    const g = gesto.current;
    gesto.current = null;
    if (!g) return;
    const f = fantasma;
    setFantasma(null);
    if (!g.activo) {
      // Un toque en lo vacío: algo nuevo a esa hora (una hora, sin pasar del hueco).
      if (g.modo === "crear") {
        const ini = aPaso(Math.floor(g.min0 / 15) * 15);
        onCrear({ dia: g.dia, inicio: ini, fin: aHora(Math.min(minutos(ini) + 60, 23 * 60 + 59)) });
      }
      return;
    }
    // Fue un arrastre: el clic que viene detrás no abre nada.
    sinClic.current = true;
    setTimeout(() => (sinClic.current = false), 0);
    if (!f) return;
    if (g.modo === "crear") onCrear({ dia: f.dia, inicio: f.inicio, fin: f.fin });
    else if (f.dia !== g.dia || f.inicio !== g.p.inicio || f.fin !== g.p.fin) onMover(g.p, { dia: f.dia, inicio: f.inicio, fin: f.fin, desde: g.dia });
    e.preventDefault();
  };
  const cancelar = () => {
    gesto.current = null;
    setFantasma(null);
  };
  const manejar = { onPointerMove: seguir, onPointerUp: terminar, onPointerCancel: cancelar };

  const minDe = (e) => lugar(e.clientX, e.clientY).min;

  return (
    <div className={`rejilla${tipo ? " es-tipo" : ""}`} role="group" aria-label={tipo ? "Tu semana tipo, con horas" : "Tu semana, con horas"}>
      <div className="rejilla-fila rejilla-cabeza">
        <span />
        {dias.map(({ dia, conHora }) => {
          const v = ventanaDelDia(dia, ajustes);
          const libre = huecos(conHora, { desde: v.despierta, hasta: v.duerme }).reduce((t, h) => t + h.minutos, 0);
          return (
            <div key={dia} className={`rejilla-dia${dia === hoy && !tipo ? " es-hoy" : ""}${dia === elegido && !tipo ? " elegido" : ""}`}>
              <strong>{tipo ? DIAS[diaSemana(dia)] : `${DIAS_CORTOS[diaSemana(dia)]} ${partes(dia).dia}`}</strong>
              <small>{libre ? `libre ${textoHoras(libre)}` : "sin huecos"}</small>
            </div>
          );
        })}
      </div>

      {!tipo && (
        <div className="rejilla-fila rejilla-deldia">
          <span className="rejilla-etq">Del día</span>
          {dias.map(({ dia, delDia }) => (
            <DelDia key={dia} dia={dia} delDia={delDia} sombreros={sombreros} onAbrir={abrirPieza} onSoltar={onSoltar} />
          ))}
        </div>
      )}

      <div className="rejilla-cuerpo" ref={cuerpo}>
        <div className="rejilla-lienzo" ref={lienzo} style={{ "--horas": hasta - desde }}>
          <div className="rejilla-horas" aria-hidden="true">
            {horas.map((h) => (
              <span key={h} style={{ top: pos(`${String(h).padStart(2, "0")}:00`) }}>{horaCorta(`${String(h).padStart(2, "0")}:00`)}</span>
            ))}
          </div>
          {dias.map(({ dia, conHora }) => {
            const v = ventanaDelDia(dia, ajustes);
            const libres = !tipo && dia < hoy ? [] : huecos(conHora, { desde: v.despierta, hasta: v.duerme, ahora: !tipo && dia === hoy ? hora : null });
            // Los bloques ocupan todo el ancho; lo que cae encima de un bloque (una reunión, una tarea con hora) va a su
            // derecha, sin partir el bloque en una tira que no se lee.
            const bloques = conHora.filter((p) => p.tipo === "bloque");
            const lados = new Map([...carriles(bloques), ...carriles(conHora.filter((p) => p.tipo !== "recordatorio" && p.tipo !== "bloque"))]);
            const sobreBloque = (p) => p.tipo !== "bloque" && bloques.some((b) => b.inicio < p.fin && p.inicio < b.fin);
            return (
              <div
                key={dia}
                className={`rejilla-col${dia === hoy && !tipo ? " es-hoy" : ""}`}
                aria-label={tipo ? DIAS[diaSemana(dia)] : `${DIAS[diaSemana(dia)]} ${partes(dia).dia}`}
                role="group"
                onPointerDown={(e) => {
                  if (e.target.closest(".rejilla-pieza, .rejilla-compromiso, .rejilla-rec")) return;
                  empezar(e, { modo: "crear", dia, min0: minDe(e) });
                }}
                {...manejar}
                {...zonaDeSoltar((d, e) => {
                  const b = e.target.closest("[data-bloque]")?.dataset.bloque ?? null;
                  onSoltar(d, b ? { dia, bloque: b, hora: null } : { dia, hora: aPaso(minDe(e)), bloque: null });
                })}
              >
                {libres.map((h) => (
                  <button
                    key={`l:${h.inicio}`}
                    type="button"
                    className={`rejilla-hueco${h.minutos < 60 ? " corto" : ""}`}
                    style={{ top: pos(h.inicio), height: alto(h.inicio, h.fin) }}
                    // Con el ratón lo lleva el gesto de la columna; con el teclado (detail 0), crea al principio del hueco.
                    onClick={(e) => e.detail === 0 && onCrear({ dia, inicio: h.inicio, fin: aHora(Math.min(minutos(h.inicio) + 60, minutos(h.fin))) })}
                    aria-label={`Libre el ${DIAS[diaSemana(dia)]} de ${rangoCorto(h.inicio, h.fin)}: añadir algo aquí`}
                  >
                    <span>Libre · {textoHoras(h.minutos)}</span>
                  </button>
                ))}
                {conHora.map((p) => {
                  const l = lados.get(p.clave) ?? { carril: 0, de: 1 };
                  const corta = minutos(p.fin) - minutos(p.inicio) < 45;
                  const encima = sobreBloque(p);
                  const [x0, ancho] = encima ? [45, 55] : [0, 100];
                  const estilo = {
                    ...((p.obj?.fuente === "google" || !p.sombrero) && p.color ? { "--s": p.color } : estiloDe(p.sombrero, sombreros)),
                    top: pos(p.inicio),
                    height: alto(p.inicio, p.fin),
                    left: `calc(${x0 + (l.carril / l.de) * ancho}% + 2px)`,
                    width: `calc(${ancho / l.de}% - 4px)`,
                  };
                  const arrastrando = fantasma && gesto.current?.p?.clave === p.clave && gesto.current?.dia === dia;
                  const puntero = movible(p)
                    ? {
                        onPointerDown: (e) => {
                          if (e.target.closest("li")) return;
                          e.stopPropagation();
                          empezar(e, { modo: e.target.closest(".asa") ? "estirar" : "mover", p, dia, min0: minDe(e) });
                        },
                        ...manejar,
                      }
                    : {};
                  const asa = movible(p) && <span className="asa" aria-hidden="true" />;
                  if (p.tipo === "recordatorio") {
                    return (
                      <div key={p.clave} className="rejilla-rec" style={{ ...estilo, left: "2px", width: "calc(100% - 4px)", height: "auto" }} title={`${horaCorta(p.inicio)} ${p.titulo}`}>
                        <Icon name="bell" size={10} /> <span>{horaCorta(p.inicio)} {p.titulo}</span>
                      </div>
                    );
                  }
                  if (p.tipo === "bloque") {
                    return (
                      <div key={p.clave} className={`rejilla-pieza bloque${corta ? " corta" : ""}${arrastrando ? " arrastrando" : ""}`} style={estilo} data-bloque={p.obj.id} {...puntero}>
                        <button type="button" className="rejilla-pieza-cabeza" onClick={() => abrirPieza(p, dia)} aria-label={tipo ? `Bloque ${p.titulo}, ${rangoCorto(p.inicio, p.fin)}. Editarlo` : `Bloque ${p.titulo}, ${rangoCorto(p.inicio, p.fin)}: ${p.tareas.length} tarea${p.tareas.length === 1 ? "" : "s"}. Ponerle tareas`}>
                          <strong>{p.titulo}</strong> <time>{rangoCorto(p.inicio, p.fin)}</time>
                        </button>
                        {!corta && !tipo && (p.tareas.length > 0 || p.recordatorios.length > 0) && (
                          <ul>
                            {p.recordatorios.map((r) => <li key={`r:${r.id}`} className="dentro-rec"><Icon name="bell" size={10} /> {horaCorta(r.inicio)} {r.titulo}</li>)}
                            {p.tareas.slice(0, DENTRO_MAX).map((a) => (
                              <li key={a.id} draggable onDragStart={(e) => empezarArrastre(e, { tipo: "accion", id: a.id, titulo: a.titulo })}>
                                <button type="button" onClick={() => onAbrir("accion", a)}><span className="ley-tarea" aria-hidden="true" /> {a.titulo}</button>
                              </li>
                            ))}
                            {p.tareas.length > DENTRO_MAX && <li className="rejilla-mas">y {p.tareas.length - DENTRO_MAX} más</li>}
                          </ul>
                        )}
                        {asa}
                      </div>
                    );
                  }
                  if (p.tipo === "evento" && !p.rutina) {
                    // Lo que NO se repite (una reunión, una cita, un evento) va en color, para que no se te escape; lo
                    // especial, relleno y con su estrella (también sale arriba del día).
                    const icono = p.especial ? "star" : p.obj?.clase === "reunion" || p.obj?.conPersonas ? "users" : "calendar";
                    return (
                      <button key={p.clave} type="button" className={`rejilla-evento${p.especial ? " especial" : ""}${corta ? " corta" : ""}${encima ? " sobre-bloque" : ""}${movible(p) ? " movible" : ""}${arrastrando ? " arrastrando" : ""}`} style={estilo} onClick={() => abrirPieza(p, dia)} title={`${rangoCorto(p.inicio, p.fin)} ${p.titulo}`} {...puntero}>
                        <strong><Icon name={icono} size={11} /> {p.titulo}</strong>
                        <time>{rangoCorto(p.inicio, p.fin)}</time>
                        {asa}
                      </button>
                    );
                  }
                  if (p.tipo === "evento" || p.tipo === "compromiso") {
                    // La rutina (lo que se repite cada semana) no es un bloque: sin caja, en gris y pequeño, como texto; una
                    // línea fina a la izquierda dice cuánto dura.
                    const icono = p.obj?.clase === "reunion" ? "users" : "calendar";
                    return (
                      <button key={p.clave} type="button" className={`rejilla-compromiso${corta ? " corta" : ""}${encima ? " sobre-bloque" : ""}${movible(p) ? " movible" : ""}${arrastrando ? " arrastrando" : ""}`} style={estilo} onClick={() => abrirPieza(p, dia)} title={`${rangoCorto(p.inicio, p.fin)} ${p.titulo}`} {...puntero}>
                        <time><Icon name={icono} size={10} /> {rangoCorto(p.inicio, p.fin)}</time>
                        <span>{p.titulo}</span>
                        {asa}
                      </button>
                    );
                  }
                  return (
                    <button key={p.clave} type="button" className={`rejilla-pieza ${p.tipo}${corta ? " corta" : ""}${encima ? " sobre-bloque" : ""}${arrastrando ? " arrastrando" : ""}`} style={estilo} onClick={() => abrirPieza(p, dia)} title={`${rangoCorto(p.inicio, p.fin)} ${p.titulo}`} {...puntero}>
                      <strong><span className="ley-tarea" aria-hidden="true" /> {p.titulo}</strong>
                      <time>{rangoCorto(p.inicio, p.fin)}</time>
                      {asa}
                    </button>
                  );
                })}
                {fantasma?.dia === dia && (
                  <div className="rejilla-fantasma" style={{ top: pos(fantasma.inicio), height: alto(fantasma.inicio, fantasma.fin) }} aria-hidden="true">
                    <time>{rangoCorto(fantasma.inicio, fantasma.fin)}</time>
                    {fantasma.titulo && <span>{fantasma.titulo}</span>}
                  </div>
                )}
                {!tipo && dia === hoy && hora && minutos(hora) >= desde * 60 && minutos(hora) <= hasta * 60 && <div className="rejilla-ahora" style={{ top: pos(hora) }} aria-hidden="true" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** «Del día» de una columna: lo de todo el día y las tareas sin hora; se suelta aquí una tarea para ese día, sin hora. */
function DelDia({ dia, delDia, sombreros, onAbrir, onSoltar }) {
  const [encima, setEncima] = useState(false);
  const [todo, setTodo] = useState(false);
  const cabe = todo ? delDia.length : 4;
  return (
    <ul className={`rejilla-deldia-lista${encima ? " soltando" : ""}`} {...zonaDeSoltar((d) => onSoltar(d, { dia, hora: null, bloque: null }), setEncima)}>
      {delDia.slice(0, cabe).map((p) => (
        <li key={p.clave} style={(p.obj?.fuente === "google" || !p.sombrero) && p.color ? { "--s": p.color } : estiloDe(p.sombrero, sombreros)} draggable={p.tipo === "tarea" || undefined} onDragStart={p.tipo === "tarea" ? (e) => empezarArrastre(e, { tipo: "accion", id: p.obj.id, titulo: p.titulo }) : undefined}>
          <button type="button" className={`rejilla-chip ${p.tipo}${p.especial ? " especial" : ""}`} onClick={() => onAbrir(p, dia)} title={p.titulo}>
            {p.tipo === "tarea" ? <span className="ley-tarea" aria-hidden="true" /> : <Icon name={p.tipo === "recordatorio" ? "bell" : p.especial ? "star" : "calendar"} size={11} />}
            <span>{p.arriba ? `${horaCorta(p.inicio)} ${p.titulo}` : p.obj?.horaPorDefinir ? `${p.titulo} (hora por definir)` : p.titulo}</span>
          </button>
        </li>
      ))}
      {delDia.length > 4 && (
        <li><button type="button" className="rejilla-mas" onClick={() => setTodo(!todo)}>{todo ? "Ver menos" : `y ${delDia.length - 4} más`}</button></li>
      )}
    </ul>
  );
}
