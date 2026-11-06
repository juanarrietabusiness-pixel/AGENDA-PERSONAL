import { useId, useState } from "react";
import Icon from "../componentes/Icon.jsx";
import Fila from "../componentes/Fila.jsx";
import { lunesDe, sumarDias, DIAS, DIAS_CORTOS, partes, textoHora, diaSemana } from "../lib/fechas.js";
import { eventosDelDia } from "../lib/hoy.js";
import { sombrerosDe, estiloDe, nombreDe, balance, descuidados, aplicarSombrero, COLORES } from "../lib/sombreros.js";
import { cuadrante } from "../lib/prioridad.js";
import { ordenarPor, claseDeGoogle } from "../lib/agenda.js";
import { nuevaAccion } from "../lib/metodo.js";
import { RITMO_BASE } from "../lib/ritmo.js";
import SemanaTipo from "../componentes/SemanaTipo.jsx";
import { seriesTraidas, horasPorSombrero, claseDeRitmo } from "../lib/semana.js";

const PRIORIDADES = { alta: "Alta", media: "Media", baja: "Baja" };

/**
 * Tu plan: la semana con tu rutina, cómo se reparte el tiempo entre los sombreros, las piedras grandes, y cada
 * sombrero con sus proyectos y sus tareas listas para marcar. Aquí se renombran, se ordenan por prioridad y se crean
 * sombreros.
 */
export default function Plan({ estado, hoy, cambiar, onHecha, onAbrir, avisar, servidor = false, recargar }) {
  const id = useId();
  const { acciones, eventos, proyectos, ajustes } = estado;
  const sombreros = sombrerosDe(ajustes);
  const lunes = lunesDe(hoy);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const ritmo = estado.ritmo ?? RITMO_BASE;
  const todos = [...ritmo, ...eventos];
  // Lo de Google que ya se trajo a tu semana no sale dos veces.
  const traidas = seriesTraidas(ritmo);
  const externos = (estado.externos ?? []).filter((x) => !traidas.has(x.serie));
  const propioDeGoogle = (x) => eventos.some((p) => p.google?.id && (p.google.id === x.id || String(x.id).startsWith(`${p.google.id}_`)));
  const porDia = dias.map((d) => {
    // Tu semana de Google Calendar (la rutina y las reuniones), con su hora; lo de todo el día, arriba.
    const google = externos
      .filter((x) => x.tipo === "evento" && x.dia === d && !propioDeGoogle(x))
      .map((x) => ({ ...x, fuente: "google", clase: claseDeGoogle(x, ajustes) }));
    const horas = new Set(google.map((x) => x.inicio).filter(Boolean));
    // Lo de la rutina de la agenda que ya está en Google a la misma hora no se repite.
    const propios = eventosDelDia(todos, d).filter((e) => !(e.porConfirmar && horas.has(e.inicio)));
    return {
      dia: d,
      eventos: [...propios, ...google].sort((a, b) => (a.inicio ?? "00:00").localeCompare(b.inicio ?? "00:00")),
      acciones: acciones.filter((a) => a.estado === "abierta" && (a.cuando === d || a.limite === d)),
    };
  });
  // El tiempo de cada sombrero sale de tus bloques; si todavía no hay bloques con sombrero, de lo que pasó esta semana.
  const porBloques = horasPorSombrero(ritmo, sombreros);
  const hayBloques = porBloques.some((f) => f.minutos > 0);
  const filas = hayBloques ? porBloques : balance({ eventos: porDia.flatMap((p) => p.eventos.filter((e) => e.fuente !== "google")), hechas: porDia.flatMap((p) => p.acciones) }, sombreros);
  const flojos = descuidados(filas);
  const abiertas = acciones.filter((a) => a.estado === "abierta" && a.lista === "siguientes");
  const ctx = { hoy, proyectos, sombreros };
  const [nuevas, setNuevas] = useState({});
  const [editando, setEditando] = useState(null);
  const [nuevoSombrero, setNuevoSombrero] = useState("");

  const cambiarSombreros = (cambio) => {
    try {
      const r = aplicarSombrero(ajustes.sombreros, cambio);
      cambiar((e) => ({ ...e, ajustes: { ...e.ajustes, sombreros: r.lista } }));
      return true;
    } catch (err) {
      avisar(err.message);
      return false;
    }
  };

  const quitarSombrero = (s) => {
    if ([...acciones, ...proyectos].some((x) => x.sombrero === s.id && x.estado !== "hecha" && x.estado !== "soltada" && x.estado !== "terminado")) {
      avisar(`«${s.nombre}» todavía tiene cosas abiertas: muévelas a otro sombrero antes de quitarlo.`);
      return;
    }
    if (cambiarSombreros({ accion: "quitar", id: s.id })) avisar(`Quité «${s.nombre}».`);
  };

  const anadir = (s) => {
    const titulo = String(nuevas[s.id] ?? "").trim();
    if (!titulo) return;
    cambiar((e) => ({ ...e, acciones: [...e.acciones, nuevaAccion({ titulo, sombrero: s.id, lista: "siguientes", origen: "app" }, hoy)] }));
    setNuevas((n) => ({ ...n, [s.id]: "" }));
  };

  const prioridadProyecto = (p, prioridad) => cambiar((e) => ({ ...e, proyectos: e.proyectos.map((x) => (x.id === p.id ? { ...x, prioridad } : x)) }));

  return (
    <>
      <h1 className="titulo-pantalla">Tu plan</h1>
      <p className="subtitulo">Semana del lunes {partes(dias[0]).dia} al domingo {partes(dias[6]).dia}. Tu rutina, tus sombreros y lo que toca en cada uno.</p>

      <section className="tarjeta" aria-labelledby={`${id}-balance`}>
        <div className="seccion-cabeza"><h2 id={`${id}-balance`}>Cómo se reparte tu tiempo</h2></div>
        <div className="balance" role="img" aria-label={filas.map((f) => `${nombreDe(f.id, sombreros)} ${f.porcentaje} %`).join(", ")}>
          {filas.map((f) => <span key={f.id} style={{ ...estiloDe(f.id, sombreros), width: `${f.porcentaje}%` }} />)}
        </div>
        <div className="balance-leyenda">
          {filas.map((f) => (
            <span key={f.id} style={estiloDe(f.id, sombreros)}><span className="punto" />{nombreDe(f.id, sombreros)} {hayBloques ? `${Math.round((f.minutos / 60) * 10) / 10} h` : `${f.porcentaje} %`}</span>
          ))}
        </div>
        {flojos.length > 0 && (
          <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--fs-sm)", color: "var(--texto-2)" }}>
            {flojos.map((x) => nombreDe(x, sombreros)).join(" y ")} casi no tiene{flojos.length > 1 ? "n" : ""} tiempo esta semana. ¿Le damos una piedra grande?
          </p>
        )}
      </section>

      <section className="seccion" aria-labelledby={`${id}-dias`}>
        <div className="seccion-cabeza"><h2 id={`${id}-dias`}>Tu semana</h2><span className="nota">Tu rutina, tus reuniones y lo planeado</span></div>
        <div className="semana">
          {porDia.map(({ dia, eventos: evs, acciones: acs }) => (
            <article key={dia} className={`dia${dia === hoy ? " es-hoy" : ""}`} aria-label={`${DIAS[diaSemana(dia)]} ${partes(dia).dia}`}>
              <h3>
                <span>{DIAS_CORTOS[diaSemana(dia)]} {partes(dia).dia}</span>
                {dia === hoy && <span className="chip acento">Hoy</span>}
              </h3>
              {evs.map((e) =>
                e.fuente === "google" ? (
                  <button key={`g:${e.id}`} type="button" className={`dia-item dia-google${e.clase === "rutina" ? " es-rutina" : ""}`} style={e.color ? { "--s": e.color } : undefined} onClick={() => onAbrir("google", e)}>
                    <span className="punto" />
                    <span><time>{e.inicio ? textoHora(e.inicio) : "Todo el día"}</time>{e.titulo}</span>
                  </button>
                ) : (
                  <div key={e.id} className={`dia-item${claseDeRitmo(e) === "recordatorio" && e.repite ? " es-recordatorio" : ""}${e.repite && claseDeRitmo(e) === "bloque" ? " es-bloque" : ""}`} style={estiloDe(e.sombrero, sombreros)}>
                    <span className="punto" />
                    <span><time>{textoHora(e.inicio)}{e.repite && claseDeRitmo(e) === "bloque" ? `–${textoHora(e.fin)}` : ""}</time>{e.titulo}</span>
                  </div>
                ),
              )}
              {acs.map((a) => (
                <button key={a.id} type="button" className="dia-item accion-dia" style={estiloDe(a.sombrero, sombreros)} onClick={() => onAbrir("accion", a)}>
                  <span className="punto" style={{ background: "transparent", border: "2px solid var(--s)" }} />
                  <span>{a.titulo}</span>
                </button>
              ))}
              {!evs.length && !acs.length && <div className="dia-item">Libre</div>}
            </article>
          ))}
        </div>
        <p style={{ color: "var(--texto-3)", fontSize: "var(--fs-xs)", marginTop: "var(--sp-3)" }}>
          Aquí vive tu semana completa: tus bloques, lo de Google Calendar (toca un evento de Google para decir si es rutina, reunión o especial) y lo que planeaste.
        </p>
      </section>

      <SemanaTipo estado={estado} sombreros={sombreros} cambiar={cambiar} avisar={avisar} servidor={servidor} recargar={recargar} />

      <section className="seccion" aria-labelledby={`${id}-somb`}>
        <div className="seccion-cabeza">
          <h2 id={`${id}-somb`}>Tus sombreros y sus tareas</h2>
          <span className="nota">En orden de prioridad: el primero pesa más cuando dos cosas compiten por el mismo tiempo</span>
        </div>
        <div className="sombreros">
          {sombreros.map((s, i) => {
            const suyas = abiertas.filter((a) => a.sombrero === s.id);
            const piedras = ordenarPor(suyas.filter((a) => a.importante && cuadrante(a, hoy) <= 2), "prioridad", ctx).slice(0, 2);
            const proys = proyectos.filter((p) => p.sombrero === s.id && p.estado !== "terminado");
            const sueltas = ordenarPor(suyas.filter((a) => !a.proyectoId || !proys.some((p) => p.id === a.proyectoId)), "prioridad", ctx);
            const enEdicion = editando === s.id;
            return (
              <article key={s.id} className="tarjeta sombrero-tarjeta" style={estiloDe(s.id, sombreros)} aria-labelledby={`${id}-s-${s.id}`}>
                <div className="sombrero-cabeza">
                  <span className="sombrero-icono"><Icon name={s.icono} size={20} /></span>
                  <div style={{ flex: 1 }}>
                    <h2 id={`${id}-s-${s.id}`}><span className="prioridad-num">{i + 1}</span> {s.nombre}</h2>
                    <p>{s.detalle}{s.fuente === "juancito-ads" ? " · se guarda en Juancito Ads" : ""}</p>
                  </div>
                  <div className="botones">
                    <button type="button" className="boton fantasma" aria-label={`Subir la prioridad de ${s.nombre}`} disabled={i === 0} onClick={() => cambiarSombreros({ accion: "mover", id: s.id, a: i })}><Icon name="arrowUp" size={16} /></button>
                    <button type="button" className="boton fantasma" aria-label={`Bajar la prioridad de ${s.nombre}`} disabled={i === sombreros.length - 1} onClick={() => cambiarSombreros({ accion: "mover", id: s.id, a: i + 2 })}><Icon name="arrowDown" size={16} /></button>
                    <button type="button" className="boton fantasma" aria-label={`Editar ${s.nombre}`} aria-expanded={enEdicion} onClick={() => setEditando(enEdicion ? null : s.id)}><Icon name="pencil" size={16} /></button>
                  </div>
                </div>

                {enEdicion && (
                  <EditarSombrero s={s} onGuardar={(c) => cambiarSombreros({ accion: "editar", id: s.id, ...c }) && setEditando(null)} onQuitar={() => quitarSombrero(s)} />
                )}

                {piedras.length > 0 && (
                  <p className="nota-fuente"><strong>Piedras grandes:</strong> {piedras.map((a) => a.titulo).join(" · ")}</p>
                )}

                {proys.map((p) => {
                  const delProyecto = ordenarPor(suyas.filter((a) => a.proyectoId === p.id), "prioridad", ctx);
                  return (
                    <div key={p.id} className="proyecto">
                      <div className="proyecto-nombre">
                        <span>{p.nombre}{p.limite ? <small style={{ color: "var(--texto-3)", fontWeight: 400 }}> · hasta {p.limite}</small> : null}</span>
                        <label className="prioridad-proyecto">
                          <span className="solo-lector">Prioridad de {p.nombre}</span>
                          <select value={p.prioridad ?? "media"} onChange={(e) => prioridadProyecto(p, e.target.value)}>
                            {Object.entries(PRIORIDADES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                          </select>
                        </label>
                      </div>
                      {delProyecto.length ? (
                        <ul className="lista" style={{ marginTop: "var(--sp-2)" }}>
                          {delProyecto.map((a) => <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={[]} onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)} />)}
                        </ul>
                      ) : (
                        <p className="proyecto-siguiente" style={{ color: "var(--ambar)" }}>Sin siguiente acción. ¿Cuál es el próximo paso?</p>
                      )}
                    </div>
                  );
                })}

                {sueltas.length > 0 && (
                  <ul className="lista" style={{ marginTop: "var(--sp-3)" }}>
                    {sueltas.map((a) => <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={proyectos} onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)} />)}
                  </ul>
                )}
                {!suyas.length && !proys.length && <p className="vacio">Nada abierto.</p>}

                <form className="anadir-rapido" onSubmit={(e) => { e.preventDefault(); anadir(s); }}>
                  <label className="solo-lector" htmlFor={`${id}-n-${s.id}`}>Añadir una tarea a {s.nombre}</label>
                  <input id={`${id}-n-${s.id}`} className="campo" placeholder={`Añadir a ${s.nombre}…`} value={nuevas[s.id] ?? ""} onChange={(e) => setNuevas((n) => ({ ...n, [s.id]: e.target.value }))} />
                  <button type="submit" className="boton" aria-label={`Añadir a ${s.nombre}`}><Icon name="plus" size={16} /></button>
                </form>
              </article>
            );
          })}
        </div>

        <form className="tarjeta anadir-rapido" style={{ marginTop: "var(--sp-4)" }} onSubmit={(e) => { e.preventDefault(); if (cambiarSombreros({ accion: "crear", nombre: nuevoSombrero })) { avisar(`Sombrero nuevo: «${nuevoSombrero.trim()}».`); setNuevoSombrero(""); } }}>
          <label className="solo-lector" htmlFor={`${id}-nuevo`}>Nombre del sombrero nuevo</label>
          <input id={`${id}-nuevo`} className="campo" placeholder="Un sombrero nuevo (p. ej., Estudios, Familia, Ministerio de jóvenes)" value={nuevoSombrero} onChange={(e) => setNuevoSombrero(e.target.value)} />
          <button type="submit" className="boton primario" disabled={!nuevoSombrero.trim()}><Icon name="plus" size={16} /> Crear</button>
        </form>
      </section>
    </>
  );
}

function EditarSombrero({ s, onGuardar, onQuitar }) {
  const id = useId();
  const [nombre, setNombre] = useState(s.nombre);
  const [detalle, setDetalle] = useState(s.detalle);
  const [color, setColor] = useState(s.color);
  return (
    <form className="editar-sombrero" onSubmit={(e) => { e.preventDefault(); onGuardar({ nombre, detalle, color }); }}>
      <label className="etiqueta" htmlFor={`${id}-n`}>Nombre</label>
      <input id={`${id}-n`} className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={30} required />
      <label className="etiqueta" htmlFor={`${id}-d`}>De qué se trata</label>
      <input id={`${id}-d`} className="campo" value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={140} />
      <span className="etiqueta">Color</span>
      <div className="colores" role="group" aria-label="Color">
        {[s.color, ...COLORES.filter((c) => c !== s.color)].map((c) => (
          <button key={c} type="button" className="color" aria-pressed={color === c} aria-label={`Color ${c}`} style={{ "--c": c }} onClick={() => setColor(c)} />
        ))}
      </div>
      <div className="botones" style={{ justifyContent: "space-between", marginTop: "var(--sp-3)" }}>
        <button type="button" className="boton fantasma" style={{ color: "var(--rojo)" }} onClick={onQuitar}><Icon name="trash" size={16} /> Quitar sombrero</button>
        <button type="submit" className="boton primario">Guardar</button>
      </div>
    </form>
  );
}
