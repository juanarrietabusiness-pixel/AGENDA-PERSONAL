import { useId, useState } from "react";
import Icon from "../componentes/Icon.jsx";
import Fila from "../componentes/Fila.jsx";
import { lunesDe, sumarDias, DIAS, DIAS_CORTOS, partes, diaSemana, horaCorta, rangoCorto } from "../lib/fechas.js";
import { eventosDelDia } from "../lib/hoy.js";
import { sombrerosDe, estiloDe, nombreDe, balance, descuidados, aplicarSombrero, COLORES } from "../lib/sombreros.js";
import { cuadrante } from "../lib/prioridad.js";
import { ordenarPor, claseDeGoogle, esTodoElDia } from "../lib/agenda.js";
import { nuevaAccion } from "../lib/metodo.js";
import { RITMO_BASE } from "../lib/ritmo.js";
import SemanaTipo from "../componentes/SemanaTipo.jsx";
import AsignarBloque from "../componentes/AsignarBloque.jsx";
import ProyectosConFecha from "../componentes/ProyectosConFecha.jsx";
import SemanaRejilla from "../componentes/SemanaRejilla.jsx";
import AsignarHueco from "../componentes/AsignarHueco.jsx";
import AnadirRapido from "../componentes/AnadirRapido.jsx";
import { piezasDelDia, huecos, ventanaDelDia } from "../lib/rejilla.js";
import { seriesTraidas, horasPorSombrero, semanaDelDia, diaEnBloques, minutosSinSombrero, porRevisar, textoHoras } from "../lib/semana.js";

const PRIORIDADES = { alta: "Alta", media: "Media", baja: "Baja" };
const EN_BLOQUE = 3; // tareas que se ven dentro de un bloque; las demás, al tocarlo

/**
 * Tu plan: la semana tal como es (cada bloque con sus recordatorios y sus tareas dentro), las horas de cada sombrero,
 * tu semana tipo (plegada) y cada sombrero con sus tareas (plegado). Lo que no hace falta ver siempre, plegado.
 */
export default function Plan({ estado, hoy, hora, cambiar, onHecha, onAbrir, avisar, servidor = false, recargar }) {
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
  const [hueco, setHueco] = useState(null);

  const porDia = dias.map((d) => {
    const google = externos
      .filter((x) => x.tipo === "evento" && x.dia === d && !propioDeGoogle(x))
      .map((x) => ({ ...x, fuente: "google", clase: claseDeGoogle(x, ajustes) }));
    const propios = eventosDelDia(eventos, d).map((e) => ({ ...e, fuente: "agenda" }));
    const tareas = acciones.filter((a) => a.estado === "abierta" && (a.cuando === d || a.limite === d));
    const base = diaEnBloques(ritmo, d, tareas);
    const todos = [...propios, ...google];
    return { dia: d, eventos: todos, ...base, ...piezasDelDia({ ...base, eventos: todos }) };
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

  const anadirSinFecha = ({ titulo, sombrero }) => {
    cambiar((e) => ({ ...e, acciones: [...e.acciones, nuevaAccion({ titulo, sombrero, lista: "siguientes", origen: "app" }, hoy)] }));
    avisar(`Añadida a ${sombrero ? nombreDe(sombrero, sombreros) : "tus tareas"}: «${titulo}». Ponle un hueco de la semana cuando quieras.`);
  };

  return (
    <div className="plan">
      <div className="plan-cabeza">
        <div>
          <h1 className="titulo-pantalla">Tu plan</h1>
          <p className="subtitulo">Semana del lunes {partes(dias[0]).dia} al domingo {partes(dias[6]).dia}.</p>
        </div>
        <ul className="leyenda-semana" aria-label="Qué es cada cosa">
          <li><span className="ley-bloque" aria-hidden="true" /> Bloque</li>
          <li><Icon name="calendar" size={13} /> Compromiso</li>
          <li><Icon name="bell" size={13} /> Recordatorio</li>
          <li><span className="ley-tarea" aria-hidden="true" /> Tarea</li>
          <li><span className="ley-libre" aria-hidden="true" /> Libre: tócalo y pon algo</li>
        </ul>
      </div>

      <section className="plan-semana" aria-labelledby={`${id}-dias`}>
        <h2 id={`${id}-dias`} className="solo-lector">Tu semana</h2>
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
            <DiaPlan key={p.dia} {...p} hoy={hoy} hora={hora} ajustes={ajustes} visto={visto === p.dia} sombreros={sombreros} onBloque={(bloque) => setAsignando({ bloque, dia: p.dia })} onAbrir={onAbrir} onHueco={setHueco} />
          ))}
        </div>
        <SemanaRejilla dias={porDia} hoy={hoy} hora={hora} ajustes={ajustes} sombreros={sombreros} onBloque={(bloque, dia) => setAsignando({ bloque, dia })} onAbrir={onAbrir} onHueco={setHueco} />
      </section>

      <aside className="plan-lado" aria-label="Tus sombreros, tus proyectos y tu semana tipo">
        <div className="plan-anadir">
          <AnadirRapido sombreros={sombreros} paraCuando="(sin fecha)" onAnadir={anadirSinFecha} />
        </div>

        <Sombreros
          estado={estado}
          hoy={hoy}
          sombreros={sombreros}
          cambiar={cambiar}
          onHecha={onHecha}
          onAbrir={onAbrir}
          avisar={avisar}
          resumen={{ filas, hayBloques, sinSombrero, totalMin, flojos, bloquesSinSombrero, abrirSemanaTipo }}
        />

        <ProyectosConFecha estado={estado} hoy={hoy} sombreros={sombreros} cambiar={cambiar} onHecha={onHecha} onAbrir={onAbrir} avisar={avisar} />

        <SemanaTipo estado={estado} sombreros={sombreros} cambiar={cambiar} avisar={avisar} servidor={servidor} recargar={recargar} abierta={semanaAbierta} setAbierta={setSemanaAbierta} />
      </aside>

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
      {hueco && <AsignarHueco hueco={hueco} hoy={hoy} estado={estado} sombreros={sombreros} cambiar={cambiar} avisar={avisar} onCerrar={() => setHueco(null)} />}
    </div>
  );
}

/** Un día: lo de todo el día arriba, luego en orden de hora los bloques (con lo suyo dentro), los recordatorios sueltos y las reuniones; al final, las tareas sin bloque. */
function DiaPlan({ dia, hoy, hora, ajustes, visto, eventos, bloques, recordatorios, tareas, conHora: piezas, sombreros, onBloque, onAbrir, onHueco }) {
  const todoElDia = eventos.filter((e) => !e.inicio || e.todoElDia || esTodoElDia(e));
  // Los huecos libres de ese día (desde ahora si es hoy): se tocan para poner algo ahí.
  const v = ventanaDelDia(dia, ajustes);
  const libres = dia < hoy ? [] : huecos(piezas ?? [], { desde: v.despierta, hasta: v.duerme, ahora: dia === hoy ? hora : null });
  const conHora = [
    ...bloques.map((b) => ({ tipo: "bloque", inicio: b.bloque.inicio, ...b })),
    ...recordatorios.map((r) => ({ tipo: "recordatorio", inicio: r.inicio ?? "99", r })),
    ...eventos.filter((e) => e.inicio && !e.todoElDia && !esTodoElDia(e)).map((e) => ({ tipo: "evento", inicio: e.inicio, e })),
    ...libres.map((h) => ({ tipo: "libre", inicio: h.inicio, h })),
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
          ) : x.tipo === "libre" ? (
            <li key={`l:${x.h.inicio}`} className="pl-hueco">
              <button type="button" onClick={() => onHueco({ dia, ...x.h })}>
                <span>Libre · {rangoCorto(x.h.inicio, x.h.fin)}</span> <small>{textoHoras(x.h.minutos)} · poner algo</small>
              </button>
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
  const icono = e.clase === "especial" || !e.inicio || e.todoElDia ? "star" : e.clase === "reunion" && !rutina ? "users" : "calendar";
  return (
    <li className={`pl-evento${rutina ? " es-rutina" : ""}`} style={e.fuente === "google" ? (e.color ? { "--s": e.color } : undefined) : estiloDe(e.sombrero, sombreros)}>
      <button type="button" onClick={() => (e.fuente === "google" ? onAbrir("google", e) : onAbrir("evento", e))}>
        <Icon name={icono} size={12} />
        <time>{e.horaPorDefinir ? "Hora por definir" : e.inicio && !e.todoElDia && !esTodoElDia(e) ? rangoCorto(e.inicio, e.fin) : "Todo el día"}</time>
        <span>{e.titulo}</span>
      </button>
    </li>
  );
}

/**
 * Tus sombreros en una lista fina: cada uno en una línea (prioridad, nombre, horas a la semana y cuántas tiene abiertas)
 * con su siguiente tarea debajo. Al tocarlo se abre: añadir arriba, sus proyectos y sus tareas. Las horas por sombrero
 * van en la barra de arriba y en cada fila.
 */
function Sombreros({ estado, hoy, sombreros, cambiar, onHecha, onAbrir, avisar, resumen }) {
  const id = useId();
  const { acciones, proyectos, ajustes } = estado;
  const { filas, hayBloques, sinSombrero, totalMin, flojos, bloquesSinSombrero, abrirSemanaTipo } = resumen;
  const abiertas = acciones.filter((a) => a.estado === "abierta" && a.lista === "siguientes");
  const ctx = { hoy, proyectos, sombreros };
  const [nuevas, setNuevas] = useState({});
  const [abierto, setAbierto] = useState(null);
  const [editando, setEditando] = useState(null);
  const [creando, setCreando] = useState(false);
  const [nuevoSombrero, setNuevoSombrero] = useState("");
  const tiempoDe = (sid) => {
    const f = filas.find((x) => x.id === sid);
    if (!f) return "";
    return hayBloques ? (f.minutos ? textoHoras(f.minutos) : "0 h") : `${f.porcentaje} %`;
  };

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
    avisar(`Añadida a ${s.nombre}: «${titulo}».`);
  };

  const prioridadProyecto = (p, prioridad) => cambiar((e) => ({ ...e, proyectos: e.proyectos.map((x) => (x.id === p.id ? { ...x, prioridad } : x)) }));

  return (
    <section className="seccion somb-seccion" aria-labelledby={`${id}-somb`}>
      <div className="seccion-cabeza">
        <h2 id={`${id}-somb`}>Tus sombreros</h2>
        <span className="nota">{hayBloques ? "horas a la semana" : "esta semana"}</span>
      </div>
      <div className="balance balance-fino" role="img" aria-label={filas.map((f) => `${nombreDe(f.id, sombreros)} ${tiempoDe(f.id)}`).join(", ")}>
        {filas.map((f) => <span key={f.id} style={{ ...estiloDe(f.id, sombreros), width: `${hayBloques ? (totalMin ? (f.minutos / totalMin) * 100 : 0) : f.porcentaje}%` }} />)}
        {sinSombrero > 0 && <span className="sin-sombrero" style={{ width: `${(sinSombrero / totalMin) * 100}%` }} />}
      </div>

      <ul className="somb-lista">
        {sombreros.map((s, i) => {
          const suyas = abiertas.filter((a) => a.sombrero === s.id);
          const orden = ordenarPor(suyas, "prioridad", ctx);
          const piedra = orden.find((a) => a.importante && cuadrante(a, hoy) <= 2) ?? orden[0];
          const proys = proyectos.filter((p) => p.sombrero === s.id && p.estado !== "terminado");
          const sueltas = orden.filter((a) => !a.proyectoId || !proys.some((p) => p.id === a.proyectoId));
          const abiertoEste = abierto === s.id;
          const enEdicion = editando === s.id;
          const tiempo = tiempoDe(s.id);
          return (
            <li key={s.id} className={`somb${abiertoEste ? " abierto" : ""}`} style={estiloDe(s.id, sombreros)}>
              <button type="button" className="somb-fila" aria-expanded={abiertoEste} aria-controls={`${id}-c-${s.id}`} onClick={() => setAbierto(abiertoEste ? null : s.id)}>
                <span className="somb-num" aria-hidden="true">{i + 1}</span>
                <span className="somb-nombre">{s.nombre}</span>
                {tiempo && <span className="somb-horas">{tiempo}</span>}
                <span className="somb-cuenta">{suyas.length}<span className="solo-lector"> abierta{suyas.length === 1 ? "" : "s"}</span></span>
                <Icon name={abiertoEste ? "chevronUp" : "chevronDown"} size={14} />
                {!abiertoEste && piedra && <span className="somb-sig">{piedra.titulo}</span>}
              </button>

              {abiertoEste && (
                <div id={`${id}-c-${s.id}`} className="somb-cuerpo">
                  <form className="anadir-rapido" onSubmit={(e) => { e.preventDefault(); anadir(s); }}>
                    <label className="solo-lector" htmlFor={`${id}-n-${s.id}`}>Añadir una tarea a {s.nombre}</label>
                    <input id={`${id}-n-${s.id}`} className="campo" autoFocus placeholder={`Añadir a ${s.nombre}…`} value={nuevas[s.id] ?? ""} onChange={(e) => setNuevas((n) => ({ ...n, [s.id]: e.target.value }))} />
                    <button type="submit" className="boton" aria-label={`Añadir a ${s.nombre}`}><Icon name="plus" size={16} /></button>
                  </form>
                  {proys.map((p) => {
                    const delProyecto = orden.filter((a) => a.proyectoId === p.id);
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
                          <ul className="lista" style={{ marginTop: "var(--sp-1)" }}>
                            {delProyecto.map((a) => <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={[]} onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)} compacta />)}
                          </ul>
                        ) : (
                          <p className="proyecto-siguiente" style={{ color: "var(--ambar)" }}>Sin siguiente acción. ¿Cuál es el próximo paso?</p>
                        )}
                      </div>
                    );
                  })}
                  {sueltas.length > 0 ? (
                    <ul className="lista" style={{ marginTop: "var(--sp-2)" }}>
                      {sueltas.map((a) => <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={proyectos} onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)} compacta />)}
                    </ul>
                  ) : (
                    !proys.length && <p className="nota somb-vacio">Nada abierto aquí.</p>
                  )}
                  <div className="somb-pie">
                    {s.detalle ? <span className="nota">{s.detalle}{s.fuente === "juancito-ads" ? " · se guarda en Juancito Ads" : ""}</span> : <span />}
                    <button type="button" className="enlace" aria-expanded={enEdicion} onClick={() => setEditando(enEdicion ? null : s.id)}><Icon name="pencil" size={13} /> Editar</button>
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
                </div>
              )}
            </li>
          );
        })}
        {sinSombrero > 0 && (
          <li className="somb somb-sin">
            <span className="somb-fila somb-fila-fija">
              <span className="somb-num" aria-hidden="true">·</span>
              <span className="somb-nombre">Sin sombrero</span>
              <span className="somb-horas">{textoHoras(sinSombrero)}</span>
            </span>
          </li>
        )}
      </ul>

      {bloquesSinSombrero > 0 ? (
        <p className="nota somb-nota">
          {bloquesSinSombrero} bloque{bloquesSinSombrero === 1 ? " no tiene" : "s no tienen"} sombrero y no cuenta{bloquesSinSombrero === 1 ? "" : "n"}. <button type="button" className="enlace" onClick={abrirSemanaTipo}>Asignarles uno</button>
        </p>
      ) : (
        flojos.length > 0 && <p className="nota somb-nota">{flojos.map((x) => nombreDe(x, sombreros)).join(" y ")} casi no tiene{flojos.length > 1 ? "n" : ""} tiempo esta semana.</p>
      )}

      {creando ? (
        <form className="anadir-rapido" onSubmit={(e) => { e.preventDefault(); if (cambiarSombreros({ accion: "crear", nombre: nuevoSombrero })) { avisar(`Sombrero nuevo: «${nuevoSombrero.trim()}».`); setNuevoSombrero(""); setCreando(false); } }}>
          <label className="solo-lector" htmlFor={`${id}-nuevo`}>Nombre del sombrero nuevo</label>
          <input id={`${id}-nuevo`} className="campo" autoFocus placeholder="Estudios, Familia…" value={nuevoSombrero} onChange={(e) => setNuevoSombrero(e.target.value)} />
          <button type="submit" className="boton primario" disabled={!nuevoSombrero.trim()}>Crear</button>
        </form>
      ) : (
        <button type="button" className="enlace somb-nuevo" onClick={() => setCreando(true)}><Icon name="plus" size={14} /> Sombrero nuevo</button>
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
