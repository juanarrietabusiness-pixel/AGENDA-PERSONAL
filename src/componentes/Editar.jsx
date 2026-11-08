import { useId, useState } from "react";
import Icon from "./Icon.jsx";
import { useDialogo } from "../hooks/useDialogo.js";
import { DURACIONES } from "../lib/metodo.js";
import { QUE_ES, esDeAccion, normalizarEvento, esTodoElDia } from "../lib/agenda.js";
import { describir } from "../lib/recurrencia.js";

const LISTAS = { siguientes: "Siguientes acciones", espera: "En espera de alguien", "algun-dia": "Algún día", referencia: "Referencia" };

/**
 * Editar una tarea, un recordatorio o un evento: TODO se puede cambiar, también lo que ya está hecho (y reabrirlo), y
 * todo lleva notas. Lo de Juancito Ads y Google se cambia allá solo (lo hace el servidor al guardar).
 */
export default function Editar({ tipo, obj, sombreros, proyectos = [], hoy, onGuardar, onBorrar, onCerrar }) {
  const ref = useDialogo(onCerrar);
  const id = useId();
  // Lo de todo el día (o con la hora por definir) se enseña sin hora: se escribe la que sea y ya.
  const [f, setF] = useState(() => (tipo !== "accion" && esTodoElDia(obj) ? { ...obj, inicio: null, fin: null } : { ...obj }));
  // Qué es: se puede cambiar entre los cinco; si pasa de acción a evento (o al revés), se convierte al guardar.
  const [que, setQue] = useState(() => (tipo === "accion" ? obj.clase ?? "tarea" : obj.clase ?? "evento"));
  const cambiaDeTipo = esDeAccion(que) !== (tipo === "accion");
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const poner = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value === "" ? null : e.target.value }));
  const esAccion = tipo === "accion";
  const hecha = esAccion && f.estado === "hecha";
  const deSombrero = proyectos.filter((p) => !f.sombrero || p.sombrero === f.sombrero);

  const guardar = (e) => {
    e.preventDefault();
    const limpio = { ...f, titulo: String(f.titulo ?? "").trim() || obj.titulo, notas: String(f.notas ?? "") };
    if (esAccion) {
      limpio.minutos = Number(limpio.minutos) || 30;
      if (!limpio.delegable?.a) limpio.delegable = null;
    }
    if (cambiaDeTipo) onGuardar(esAccion ? limpio : normalizarEvento(limpio), { como: que });
    else onGuardar(esAccion ? { ...limpio, clase: que } : normalizarEvento({ ...limpio, clase: que }));
  };

  return (
    <div className="capa" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <form ref={ref} className="dialogo" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} onSubmit={guardar}>
        <h2 id={`${id}-t`}>{QUE_ES[que] ?? "Evento"}</h2>
        {(obj.juancito?.id || obj.google?.id || obj.fuente === "google") && (
          <p className="nota-fuente">
            {obj.juancito?.id ? "Vive también en Juancito Ads: al marcarla hecha aquí, se marca allá." : `Vive también en Google (${obj.google?.cuenta ?? "tu cuenta"}): lo que cambies aquí se cambia allá.`}
          </p>
        )}

        <label className="etiqueta" htmlFor={`${id}-titulo`}>Qué</label>
        <input id={`${id}-titulo`} className="campo" value={f.titulo ?? ""} onChange={poner("titulo")} required />

        <p className="etiqueta" id={`${id}-que`}>¿Qué es?</p>
        <div className="opciones-clase" role="group" aria-labelledby={`${id}-que`}>
          {Object.entries(QUE_ES).map(([v, t]) => (
            <button key={v} type="button" className="chip-boton" aria-pressed={que === v} onClick={() => setQue(v)}>{t}</button>
          ))}
        </div>
        {cambiaDeTipo && (
          <p className="nota-fuente" role="status">
            Al guardar pasa a ser {QUE_ES[que].toLowerCase()}, con el día{esDeAccion(que) ? " y la hora" : ", la hora y lo que dura"} de abajo.
            {obj.juancito?.id && !esDeAccion(que) ? " En Juancito Ads la tarea quedará como hecha." : ""}
          </p>
        )}
        {esAccion && !cambiaDeTipo && (
          <div className="botones" style={{ marginTop: "var(--sp-3)" }}>
            <button type="button" className={`boton${hecha ? "" : " primario"}`} aria-pressed={hecha} onClick={() => setF((x) => (x.estado === "hecha" ? { ...x, estado: "abierta", hechaEl: null } : { ...x, estado: "hecha", hechaEl: hoy }))}>
              <Icon name={hecha ? "undo" : "check"} size={16} /> {hecha ? "Reabrir" : "Marcar hecha"}
            </button>
          </div>
        )}

        <div className="campos-2">
          <div>
            <label className="etiqueta" htmlFor={`${id}-s`}>Sombrero</label>
            <select id={`${id}-s`} className="campo" value={f.sombrero ?? ""} onChange={poner("sombrero")}>
              <option value="">Sin sombrero</option>
              {sombreros.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          {esAccion && (
            <div>
              <label className="etiqueta" htmlFor={`${id}-p`}>Proyecto</label>
              <select id={`${id}-p`} className="campo" value={f.proyectoId ?? ""} onChange={poner("proyectoId")}>
                <option value="">Ninguno</option>
                {deSombrero.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          )}
        </div>

        {esAccion ? (
          <div className="campos-2">
            <div>
              <label className="etiqueta" htmlFor={`${id}-c`}>Cuándo la haces</label>
              <input id={`${id}-c`} type="date" className="campo" value={f.cuando ?? ""} onChange={poner("cuando")} />
            </div>
            <div>
              <label className="etiqueta" htmlFor={`${id}-h`}>Hora</label>
              <input id={`${id}-h`} type="time" className="campo" value={f.hora ?? ""} onChange={poner("hora")} />
            </div>
            <div>
              <label className="etiqueta" htmlFor={`${id}-l`}>Fecha límite (sólo si es real)</label>
              <input id={`${id}-l`} type="date" className="campo" value={f.limite ?? ""} onChange={poner("limite")} />
            </div>
            <div>
              <label className="etiqueta" htmlFor={`${id}-m`}>Cuánto toma</label>
              <select id={`${id}-m`} className="campo" value={f.minutos ?? 30} onChange={poner("minutos")}>
                {DURACIONES.map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="campos-2">
            <div>
              <label className="etiqueta" htmlFor={`${id}-f`}>Día</label>
              <input id={`${id}-f`} type="date" className="campo" value={f.fecha ?? ""} onChange={poner("fecha")} disabled={!obj.fecha && Boolean(obj.repite?.regla)} />
            </div>
            <div className="campos-2" style={{ marginTop: 0 }}>
              <div>
                <label className="etiqueta" htmlFor={`${id}-i`}>Empieza{!f.inicio ? <span className="nota"> (vacío: todo el día)</span> : null}</label>
                <input id={`${id}-i`} type="time" className="campo" value={f.inicio ?? ""} onChange={poner("inicio")} />
              </div>
              <div>
                <label className="etiqueta" htmlFor={`${id}-fi`}>Termina</label>
                <input id={`${id}-fi`} type="time" className="campo" value={f.fin ?? ""} onChange={poner("fin")} />
              </div>
            </div>
          </div>
        )}
        {f.repite?.regla && <p className="nota-fuente">Se repite: {describir(f.repite.regla)}. Para cambiar cada cuánto, díselo al asistente.</p>}

        {esAccion && (
          <>
            <div className="campos-2">
              <div>
                <label className="etiqueta" htmlFor={`${id}-v`}>Valor</label>
                <select id={`${id}-v`} className="campo" value={f.valor ?? ""} onChange={poner("valor")}>
                  <option value="">Que lo calcule el mentor</option>
                  <option value="alto">Alto: me acerca a lo que más importa</option>
                  <option value="medio">Medio</option>
                  <option value="bajo">Bajo: ¿vale la pena?</option>
                </select>
              </div>
              <div>
                <label className="etiqueta" htmlFor={`${id}-li`}>Lista</label>
                <select id={`${id}-li`} className="campo" value={f.lista ?? "siguientes"} onChange={poner("lista")}>
                  {Object.entries(LISTAS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </div>
            </div>
            <label className="casilla">
              <input type="checkbox" checked={Boolean(f.importante)} onChange={poner("importante")} /> Importante
            </label>
            <label className="etiqueta" htmlFor={`${id}-d`}>{f.lista === "espera" ? "La espero de" : "La puede hacer otra persona"}</label>
            {f.lista === "espera" ? (
              <input id={`${id}-d`} className="campo" value={f.espera?.persona ?? ""} onChange={(e) => setF((x) => ({ ...x, espera: { ...(x.espera ?? { desde: hoy }), persona: e.target.value } }))} placeholder="Nombre" />
            ) : (
              <input id={`${id}-d`} className="campo" value={f.delegable?.a ?? ""} onChange={(e) => setF((x) => ({ ...x, delegable: e.target.value ? { a: e.target.value, porque: x.delegable?.porque ?? "" } : null }))} placeholder="Nombre (vacío si la haces tú)" />
            )}
          </>
        )}

        <label className="etiqueta" htmlFor={`${id}-n`}>Notas</label>
        <textarea id={`${id}-n`} className="campo" value={f.notas ?? ""} onChange={(e) => setF((x) => ({ ...x, notas: e.target.value }))} placeholder="Lo que haga falta recordar: qué llevar, de qué se habló, enlaces…" />

        <div className="botones" style={{ justifyContent: "space-between", marginTop: "var(--sp-5)" }}>
          {onBorrar ? (
            <button type="button" className="boton fantasma" style={{ color: "var(--rojo)" }} onClick={() => (confirmarBorrar ? onBorrar(obj.id) : setConfirmarBorrar(true))}>
              <Icon name="trash" size={16} /> {confirmarBorrar ? "¿Seguro? Pulsa otra vez" : "Borrar"}
            </button>
          ) : <span />}
          <div className="botones">
            <button type="button" className="boton grande fantasma" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="boton grande primario">Guardar</button>
          </div>
        </div>
      </form>
    </div>
  );
}
