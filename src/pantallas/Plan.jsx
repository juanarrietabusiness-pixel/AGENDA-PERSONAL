import { useId, useState } from "react";
import Icon from "../componentes/Icon.jsx";
import Fila from "../componentes/Fila.jsx";
import { lunesDe, sumarDias, DIAS, DIAS_CORTOS, partes, diaSemana, horaCorta, rangoCorto } from "../lib/fechas.js";
import { eventosDelDia } from "../lib/hoy.js";
import { sombrerosDe, estiloDe, nombreDe, balance, descuidados, aplicarSombrero, COLORES } from "../lib/sombreros.js";
import { cuadrante } from "../lib/prioridad.js";
import { ordenarPor, claseDeGoogle } from "../lib/agenda.js";
import { nuevaAccion } from "../lib/metodo.js";
import { RITMO_BASE } from "../lib/ritmo.js";
import SemanaTipo from "../componentes/SemanaTipo.jsx";
import AsignarBloque from "../componentes/AsignarBloque.jsx";
import { seriesTraidas, horasPorSombrero, semanaDelDia, diaEnBloques, minutosSinSombrero, porRevisar, textoHoras } from "../lib/semana.js";

const PRIORIDADES = { alta: "Alta", media: "Media", baja: "Baja" };
const EN_BLOQUE = 3; // tareas que se ven dentro de un bloque; las demás, al tocarlo

/**
 * Tu plan: la semana tal como es (cada bloque con sus recordatorios y sus tareas dentro), las horas de cada sombrero,
 * tu semana tipo (plegada) y cada sombrero con sus tareas (plegado). Lo que no hace falta ver siempre, plegado.
 */
export default function Plan({ estado, hoy, cambiar, onHecha, onAbrir, avisar, servidor = false, recargar }) {
  const id = useId();
  const { acciones, eventos, proyectos, ajustes } = estado;
  const sombreros = sombrerosDe(ajustes);
  const lunes = lunesDe(hoy);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const ritmo = estado.ritmo ?? RITMO_BASE;
  const traidas = seriesTraidas(ritmo);
  const externos = (estado.externos ?? []).filter((x) => !traidas.has(x.serie));
  const propioDeGoogle = (x) => eventos.some((p) => p.google?.id && (p.google.id === x.id || String(x.id).startsWith(`${p.google.id}_`)));
  const [visto, setVisto] = useState(dias.includes(hoy) ? hoy : dias[0]);
  const [asignando, setAsignando] = useState(null);
  const [semanaAbierta, setSemanaAbierta] = useState(false);

  const porDia = dias.map((d) => {
    const google = externos
      .filter((x) => x.tipo === "evento" && x.dia === d && !propioDeGoogle(x))
      .map((x) => ({ ...x, fuente: "google", clase: claseDeGoogle(x, ajustes) }));
    const propios = eventosDelDia(eventos, d).map((e) => ({ ...e, fuente: "agenda" }));
    const tareas = acciones.filter((a) => a.estado === "abierta" && (a.cuando === d || a.limite === d));
    return { dia: d, eventos: [...propios, ...google], ...diaEnBloques(ritmo, d, tareas) };
  });

  // Las horas de cada sombrero salen de tus bloques; sin bloques con sombrero, de lo que pasó esta semana.
  const porBloques = horasPorSombrero(ritmo, sombreros);
  const hayBloques = porBloques.some((f) => f.minutos > 0);
  const sinSombrero = hayBloques ? minutosSinSombrero(ritmo, sombreros) : 0;
  const filas = hayBloques ? porBloques : balance({ eventos: porDia.flatMap((p) => p.eventos.filter((e) => e.fuente !== "google")), hechas: porDia.flatMap((p) => [...p.tareas, ...p.bloques.flatMap((b) => b.tareas)]) }, sombreros);
  const totalMin = filas.reduce((t, f) => t + (f.minutos ?? 0), 0) + sinSombrero;
  const flojos = descuidados(filas);
  const bloquesSinSombrero = porRevisar(ritmo, sombreros).sinSombrero.length;

  const abrirSemanaTipo = () => {
    setSemanaAbierta(true);
    requestAnimationFrame(() => document.querySelector(".semana-tipo")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      <h1 className="titulo-pantalla">Tu plan</h1>
      <p className="subtitulo">Semana del lunes {partes(dias[0]).dia} al domingo {partes(dias[6]).dia}.</p>

      <section className="seccion" aria-labelledby={`${id}-dias`} style={{ marginTop: 0 }}>
        <div className="seccion-cabeza">
          <h2 id={`${id}-dias`}>Tu semana</h2>
          <span className="nota">Toca un bloque para ponerle tareas</span>
        </div>
        <ul className="leyenda-semana" aria-label="Qué es cada cosa">
          <li><span className="ley-bloque" aria-hidden="true" /> Bloque</li>
          <li><Icon name="bell" size={13} /> Recordatorio</li>
          <li><span className="ley-tarea" aria-hidden="true" /> Tarea</li>
          <li><Icon name="users" size={13} /> Reunión</li>
        </ul>

        <div className="semana-dias" role="group" aria-label="Día de la semana">
          {dias.map((d) => (
            <button key={d} type="button" aria-pressed={visto === d} className={d === hoy ? "es-hoy" : undefined} onClick={() => setVisto(d)}>
              <span>{DIAS_CORTOS[diaSemana(d)]}</span>
              <strong>{partes(d).dia}</strong>
            </button>
          ))}
        </div>

        <div className="semana">
          {porDia.map((p) => (
            <DiaPlan key={p.dia} {...p} hoy={hoy} visto={visto === p.dia} sombreros={sombreros} onBloque={(bloque) => setAsignando({ bloque, dia: p.dia })} onAbrir={onAbrir} />
          ))}
        </div>
      </section>

      <section className="tarjeta seccion balance-tarjeta" aria-labelledby={`${id}-balance`}>
        <div className="seccion-cabeza">
          <h2 id={`${id}-balance`}>Horas por sombrero</h2>
          <span className="nota">{hayBloques ? "a la semana, según tus bloques" : "esta semana"}</span>
        </div>
        <div className="balance" role="img" aria-label={filas.map((f) => `${nombreDe(f.id, sombreros)} ${hayBloques ? textoHoras(f.minutos) : `${f.porcentaje} %`}`).join(", ")}>
          {filas.map((f) => <span key={f.id} style={{ ...estiloDe(f.id, sombreros), width: `${hayBloques ? (totalMin ? (f.minutos / totalMin) * 100 : 0) : f.porcentaje}%` }} />)}
          {sinSombrero > 0 && <span className="sin-sombrero" style={{ width: `${(sinSombrero / totalMin) * 100}%` }} />}
        </div>
        <div className="balance-leyenda">
          {filas.map((f) => (
            <span key={f.id} style={estiloDe(f.id, sombreros)}><span className="punto" />{nombreDe(f.id, sombreros)} {hayBloques ? (f.minutos ? textoHoras(f.minutos) : "0 h") : `${f.porcentaje} %`}</span>
          ))}
          {sinSombrero > 0 && <span><span className="punto" style={{ background: "var(--texto-3)", opacity: 0.5 }} />Sin sombrero {textoHoras(sinSombrero)}</span>}
        </div>
        {bloquesSinSombrero > 0 ? (
          <p className="nota" style={{ margin: "var(--sp-3) 0 0" }}>
            {bloquesSinSombrero} bloque{bloquesSinSombrero === 1 ? " no tiene" : "s no tienen"} sombrero y no cuenta{bloquesSinSombrero === 1 ? "" : "n"}. <button type="button" className="enlace" onClick={abrirSemanaTipo}>Asignarles uno</button>
          </p>
        ) : (
          flojos.length > 0 && (
            <p className="nota" style={{ margin: "var(--sp-3) 0 0" }}>
              {flojos.map((x) => nombreDe(x, sombreros)).join(" y ")} casi no tiene{flojos.length > 1 ? "n" : ""} tiempo esta semana.
            </p>
          )
        )}
      </section>

      <SemanaTipo estado={estado} sombreros={sombreros} cambiar={cambiar} avisar={avisar} servidor={servidor} recargar={recargar} abierta={semanaAbierta} setAbierta={setSemanaAbierta} />

      {asignando && (
        <AsignarBloque
          bloque={asignando.bloque}
          dia={asignando.dia}
          hoy={hoy}
          acciones={acciones}
          proyectos={proyectos}
          sombreros={sombreros}
          todos={semanaDelDia(ritmo, asignando.dia).bloques}
          cambiar={cambiar}
          avisar={avisar}
          onCerrar={() => setAsignando(null)}
        />
      )}

      <Sombreros estado={estado} hoy={hoy} sombreros={sombreros} cambiar={cambiar} onHecha={onHecha} onAbrir={onAbrir} avisar={avisar} />
    </>
  );
}

/** Un día: lo de todo el día arriba, luego en orden de hora los bloques (con lo suyo dentro), los recordatorios sueltos y las reuniones; al final, las tareas sin bloque. */
function DiaPlan({ dia, hoy, visto, eventos, bloques, recordatorios, tareas, sombreros, onBloque, onAbrir }) {
  const todoElDia = eventos.filter((e) => !e.inicio || e.todoElDia);
  const conHora = [
    ...bloques.map((b) => ({ tipo: "bloque", inicio: b.bloque.inicio, ...b })),
    ...recordatorios.map((r) => ({ tipo: "recordatorio", inicio: r.inicio ?? "99", r })),
    ...eventos.filter((e) => e.inicio && !e.todoElDia).map((e) => ({ tipo: "evento", inicio: e.inicio, e })),
  ].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const vacio = !conHora.length && !todoElDia.length && !tareas.length;

  return (
    <article className={`dia${dia === hoy ? " es-hoy" : ""}${visto ? " visto" : ""}`} aria-label={`${DIAS[diaSemana(dia)]} ${partes(dia).dia}`}>
      <h3>
        <span>{DIAS_CORTOS[diaSemana(dia)]} {partes(dia).dia}</span>
        {dia === hoy && <span className="chip acento">Hoy</span>}
      </h3>
      <ul className="dia-cosas">
        {todoElDia.map((e) => <Evento key={`t:${e.fuente}:${e.id}`} e={e} sombreros={sombreros} onAbrir={onAbrir} />)}
        {conHora.map((x) =>
          x.tipo === "bloque" ? (
            <li key={`b:${x.bloque.id}`} className={`pl-bloque${x.bloque.porConfirmar ? " por-confirmar" : ""}`} style={estiloDe(x.bloque.sombrero, sombreros)}>
              <button
                type="button"
                className="pl-bloque-cabeza"
                onClick={() => onBloque(x.bloque)}
                aria-label={`Bloque ${x.bloque.titulo.trim()}, ${rangoCorto(x.bloque.inicio, x.bloque.fin)}: ${x.tareas.length} tarea${x.tareas.length === 1 ? "" : "s"}. Ponerle tareas`}
              >
                <strong>{x.bloque.titulo}</strong>
                <time>{rangoCorto(x.bloque.inicio, x.bloque.fin)}</time>
              </button>
              {(x.recordatorios.length > 0 || x.tareas.length > 0) && (
                <ul className="pl-dentro">
                  {x.recordatorios.map((r) => <Recordatorio key={`r:${r.id}`} r={r} onAbrir={onAbrir} />)}
                  {x.tareas.slice(0, EN_BLOQUE).map((a) => <Tarea key={a.id} a={a} onAbrir={onAbrir} />)}
                  {x.tareas.length > EN_BLOQUE && (
                    <li><button type="button" className="pl-mas" onClick={() => onBloque(x.bloque)}>y {x.tareas.length - EN_BLOQUE} más</button></li>
                  )}
                </ul>
              )}
            </li>
          ) : x.tipo === "recordatorio" ? (
            <Recordatorio key={`r:${x.r.id}`} r={x.r} sombreros={sombreros} suelto onAbrir={onAbrir} />
          ) : (
            <Evento key={`e:${x.e.fuente}:${x.e.id}`} e={x.e} sombreros={sombreros} onAbrir={onAbrir} />
          ),
        )}
      </ul>
      {tareas.length > 0 && (
        <>
          <p className="pl-sub">Sin bloque</p>
          <ul className="dia-cosas">
            {tareas.map((a) => <Tarea key={a.id} a={a} sombreros={sombreros} onAbrir={onAbrir} />)}
          </ul>
        </>
      )}
      {vacio && <p className="pl-libre">Libre</p>}
    </article>
  );
}

function Recordatorio({ r, sombreros, suelto = false, onAbrir }) {
  const contenido = (
    <>
      <Icon name="bell" size={12} />
      {r.inicio && r.inicio !== "99" && <time>{horaCorta(r.inicio)}</time>}
      <span>{r.titulo}</span>
    </>
  );
  return (
    <li className={`pl-rec${suelto ? " suelto" : ""}`} style={suelto && sombreros ? estiloDe(r.sombrero, sombreros) : undefined}>
      {r.tipo === "accion" ? <button type="button" onClick={() => onAbrir("accion", r)}>{contenido}</button> : <span className="pl-rec-fijo">{contenido}</span>}
    </li>
  );
}

function Tarea({ a, sombreros, onAbrir }) {
  return (
    <li className="pl-tarea" style={sombreros ? estiloDe(a.sombrero, sombreros) : undefined}>
      <button type="button" onClick={() => onAbrir("accion", a)}>
        <span className="ley-tarea" aria-hidden="true" />
        <span>{a.titulo}</span>
      </button>
    </li>
  );
}

function Evento({ e, sombreros, onAbrir }) {
  const rutina = e.fuente === "google" && e.clase === "rutina";
  const icono = e.clase === "especial" || !e.inicio || e.todoElDia ? "star" : rutina ? "calendar" : "users";
  return (
    <li className={`pl-evento${rutina ? " es-rutina" : ""}`} style={e.fuente === "google" ? (e.color ? { "--s": e.color } : undefined) : estiloDe(e.sombrero, sombreros)}>
      <button type="button" onClick={() => (e.fuente === "google" ? onAbrir("google", e) : onAbrir("evento", e))}>
        <Icon name={icono} size={12} />
        <time>{e.inicio && !e.todoElDia ? horaCorta(e.inicio) : "Todo el día"}</time>
        <span>{e.titulo}</span>
      </button>
    </li>
  );
}

/** Tus sombreros, plegados: cada uno con cuántas tiene abiertas y lo más importante; se abre para ver y añadir tareas. */
function Sombreros({ estado, hoy, sombreros, cambiar, onHecha, onAbrir, avisar }) {
  const id = useId();
  const { acciones, proyectos, ajustes } = estado;
  const abiertas = acciones.filter((a) => a.estado === "abierta" && a.lista === "siguientes");
  const ctx = { hoy, proyectos, sombreros };
  const [nuevas, setNuevas] = useState({});
  const [abierto, setAbierto] = useState(null);
  const [editando, setEditando] = useState(null);
  const [creando, setCreando] = useState(false);
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
    <section className="seccion" aria-labelledby={`${id}-somb`}>
      <div className="seccion-cabeza">
        <h2 id={`${id}-somb`}>Tus sombreros</h2>
        <span className="nota">En orden de prioridad</span>
      </div>
      <div className="sombreros">
        {sombreros.map((s, i) => {
          const suyas = abiertas.filter((a) => a.sombrero === s.id);
          const piedras = ordenarPor(suyas.filter((a) => a.importante && cuadrante(a, hoy) <= 2), "prioridad", ctx).slice(0, 2);
          const proys = proyectos.filter((p) => p.sombrero === s.id && p.estado !== "terminado");
          const sueltas = ordenarPor(suyas.filter((a) => !a.proyectoId || !proys.some((p) => p.id === a.proyectoId)), "prioridad", ctx);
          const abiertoEste = abierto === s.id;
          const enEdicion = editando === s.id;
          return (
            <article key={s.id} className="tarjeta sombrero-tarjeta" style={estiloDe(s.id, sombreros)} aria-labelledby={`${id}-s-${s.id}`}>
              <div className="sombrero-cabeza">
                <span className="sombrero-icono"><Icon name={s.icono} size={18} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 id={`${id}-s-${s.id}`}><span className="prioridad-num">{i + 1}</span> {s.nombre}</h2>
                  <p>
                    {suyas.length ? `${suyas.length} abierta${suyas.length === 1 ? "" : "s"}` : "Nada abierto"}
                    {piedras.length > 0 && ` · lo más importante: ${piedras[0].titulo}`}
                  </p>
                </div>
                <button type="button" className="boton fantasma" aria-expanded={abiertoEste} aria-controls={`${id}-c-${s.id}`} aria-label={`${abiertoEste ? "Plegar" : "Ver las tareas de"} ${s.nombre}`} onClick={() => setAbierto(abiertoEste ? null : s.id)}>
                  <Icon name={abiertoEste ? "chevronUp" : "chevronDown"} size={18} />
                </button>
                <button type="button" className="boton fantasma" aria-label={`Editar ${s.nombre}`} aria-expanded={enEdicion} onClick={() => setEditando(enEdicion ? null : s.id)}><Icon name="pencil" size={16} /></button>
              </div>

              {enEdicion && (
                <EditarSombrero
                  s={s}
                  primero={i === 0}
                  ultimo={i === sombreros.length - 1}
                  onMover={(a) => cambiarSombreros({ accion: "mover", id: s.id, a })}
                  posicion={i}
                  onGuardar={(c) => cambiarSombreros({ accion: "editar", id: s.id, ...c }) && setEditando(null)}
                  onQuitar={() => quitarSombrero(s)}
                />
              )}

              {abiertoEste && (
                <div id={`${id}-c-${s.id}`}>
                  {s.detalle && <p className="nota" style={{ margin: "var(--sp-2) 0 0" }}>{s.detalle}{s.fuente === "juancito-ads" ? " · se guarda en Juancito Ads" : ""}</p>}
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
                            {delProyecto.map((a) => <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={[]} onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)} compacta />)}
                          </ul>
                        ) : (
                          <p className="proyecto-siguiente" style={{ color: "var(--ambar)" }}>Sin siguiente acción. ¿Cuál es el próximo paso?</p>
                        )}
                      </div>
                    );
                  })}
                  {sueltas.length > 0 && (
                    <ul className="lista" style={{ marginTop: "var(--sp-3)" }}>
                      {sueltas.map((a) => <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={proyectos} onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)} compacta />)}
                    </ul>
                  )}
                  <form className="anadir-rapido" onSubmit={(e) => { e.preventDefault(); anadir(s); }}>
                    <label className="solo-lector" htmlFor={`${id}-n-${s.id}`}>Añadir una tarea a {s.nombre}</label>
                    <input id={`${id}-n-${s.id}`} className="campo" placeholder={`Añadir a ${s.nombre}…`} value={nuevas[s.id] ?? ""} onChange={(e) => setNuevas((n) => ({ ...n, [s.id]: e.target.value }))} />
                    <button type="submit" className="boton" aria-label={`Añadir a ${s.nombre}`}><Icon name="plus" size={16} /></button>
                  </form>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {creando ? (
        <form className="tarjeta anadir-rapido" style={{ marginTop: "var(--sp-3)" }} onSubmit={(e) => { e.preventDefault(); if (cambiarSombreros({ accion: "crear", nombre: nuevoSombrero })) { avisar(`Sombrero nuevo: «${nuevoSombrero.trim()}».`); setNuevoSombrero(""); setCreando(false); } }}>
          <label className="solo-lector" htmlFor={`${id}-nuevo`}>Nombre del sombrero nuevo</label>
          <input id={`${id}-nuevo`} className="campo" autoFocus placeholder="Estudios, Familia, Ministerio de jóvenes…" value={nuevoSombrero} onChange={(e) => setNuevoSombrero(e.target.value)} />
          <button type="submit" className="boton primario" disabled={!nuevoSombrero.trim()}>Crear</button>
        </form>
      ) : (
        <button type="button" className="boton fantasma" style={{ marginTop: "var(--sp-2)" }} onClick={() => setCreando(true)}><Icon name="plus" size={16} /> Sombrero nuevo</button>
      )}
    </section>
  );
}

function EditarSombrero({ s, primero, ultimo, posicion, onMover, onGuardar, onQuitar }) {
  const id = useId();
  const [nombre, setNombre] = useState(s.nombre);
  const [detalle, setDetalle] = useState(s.detalle);
  const [color, setColor] = useState(s.color);
  return (
    <form className="editar-sombrero" onSubmit={(e) => { e.preventDefault(); onGuardar({ nombre, detalle, color }); }}>
      <span className="etiqueta">Prioridad</span>
      <div className="botones">
        <button type="button" className="boton" disabled={primero} onClick={() => onMover(posicion)}><Icon name="arrowUp" size={16} /> Subir</button>
        <button type="button" className="boton" disabled={ultimo} onClick={() => onMover(posicion + 2)}><Icon name="arrowDown" size={16} /> Bajar</button>
      </div>
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
