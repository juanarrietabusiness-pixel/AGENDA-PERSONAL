import { useId, useState } from "react";
import Icon from "./Icon.jsx";
import { useDialogo } from "../hooks/useDialogo.js";
import { diasDe, claseDeRitmo, avisa } from "../lib/semana.js";

const DIAS_SEMANA = [
  [1, "L", "lunes"],
  [2, "M", "martes"],
  [3, "X", "miércoles"],
  [4, "J", "jueves"],
  [5, "V", "viernes"],
  [6, "S", "sábado"],
  [0, "D", "domingo"],
];
const ANTES = [0, 5, 10, 15, 30, 60];
const cincoMinDespues = (h) => {
  const [a, b] = String(h).split(":").map(Number);
  const m = Math.min(a * 60 + b + 5, 23 * 60 + 59);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/**
 * Un bloque de tu semana (Trabajo 8–12) o un recordatorio dentro de ella (Proverbios 11:45): su sombrero, sus días,
 * su hora y si avisa. Lo comprueba `aplicarRitmo` (la misma regla que usa el asistente); lo que no cuadra se dice.
 */
export default function EditarBloque({ item, sombreros, onGuardar, onBorrar, onCerrar, dia = null, onQuitarDia = null }) {
  const ref = useDialogo(onCerrar);
  const id = useId();
  const nuevo = !item.id;
  const [f, setF] = useState(() => ({
    clase: claseDeRitmo(item),
    titulo: item.titulo ?? "",
    sombrero: item.sombrero ?? "",
    dias: item.repite ? diasDe(item) : [1, 2, 3, 4, 5],
    inicio: item.inicio ?? "08:00",
    fin: item.fin ?? "12:00",
    protegido: Boolean(item.protegido),
    avisar: item.titulo ? avisa(item) : true,
    antes: item.antes ?? 15,
  }));
  const [error, setError] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const poner = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const esBloque = f.clase === "bloque" || f.clase === "compromiso";
  const esCompromiso = f.clase === "compromiso";

  const guardar = (e) => {
    e.preventDefault();
    if (!f.dias.length) {
      setError("Escoge al menos un día.");
      return;
    }
    const datos = {
      titulo: f.titulo.trim(),
      sombrero: f.sombrero || null,
      clase: f.clase,
      dias: f.dias,
      inicio: f.inicio,
      ...(esBloque ? { fin: f.fin, protegido: f.protegido, avisar: esCompromiso ? false : f.avisar } : { fin: cincoMinDespues(f.inicio), protegido: false, avisar: f.avisar, antes: Math.max(0, f.antes) }),
      devocional: f.sombrero === "reino",
    };
    const r = onGuardar(datos);
    if (r) setError(r);
  };

  return (
    <div className="capa" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <form ref={ref} className="dialogo" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} onSubmit={guardar}>
        <h2 id={`${id}-t`}>{nuevo ? (esCompromiso ? "Evento fijo nuevo" : esBloque ? "Bloque nuevo" : "Recordatorio nuevo") : f.titulo || "Tu semana"}</h2>

        <p className="etiqueta" id={`${id}-q`}>¿Qué es?</p>
        <div className="opciones-clase" role="group" aria-labelledby={`${id}-q`}>
          <button type="button" className="chip-boton" aria-pressed={f.clase === "bloque"} onClick={() => poner("clase", "bloque")}>Bloque de tiempo</button>
          <button type="button" className="chip-boton" aria-pressed={esCompromiso} onClick={() => poner("clase", "compromiso")}>Evento fijo (rutina)</button>
          <button type="button" className="chip-boton" aria-pressed={f.clase === "recordatorio"} onClick={() => poner("clase", "recordatorio")}>Recordatorio</button>
        </div>
        <p className="nota" style={{ marginTop: "var(--sp-2)" }}>
          {esCompromiso
            ? "Algo fijo que ocupa su tiempo pero no es para meter tareas (la lectura bíblica, el ejercicio, la célula). Se ve en gris."
            : esBloque
              ? "Un tramo de tu semana para un sombrero: ahí van sus tareas (Trabajo de 8 a 12)."
              : "Un momento fijo, aunque caiga dentro de otro bloque (Proverbios a las 11:45)."}
        </p>

        <label className="etiqueta" htmlFor={`${id}-n`}>Nombre</label>
        <input id={`${id}-n`} className="campo" value={f.titulo} onChange={(e) => poner("titulo", e.target.value)} required placeholder={esBloque ? "Trabajo, Reino, Ensayo…" : "Lectura de Proverbios"} />

        <label className="etiqueta" htmlFor={`${id}-s`}>Sombrero</label>
        <select id={`${id}-s`} className="campo" value={f.sombrero} onChange={(e) => poner("sombrero", e.target.value)}>
          <option value="">Sin sombrero</option>
          {sombreros.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>

        <p className="etiqueta" id={`${id}-d`}>Días</p>
        <div className="dias-semana-elegir" role="group" aria-labelledby={`${id}-d`}>
          {DIAS_SEMANA.map(([n, letra, nombre]) => (
            <button key={n} type="button" className="chip-boton" aria-pressed={f.dias.includes(n)} aria-label={nombre} onClick={() => poner("dias", f.dias.includes(n) ? f.dias.filter((x) => x !== n) : [...f.dias, n])}>{letra}</button>
          ))}
        </div>

        <div className="campos-2">
          <div>
            <label className="etiqueta" htmlFor={`${id}-i`}>{esBloque ? "Desde" : "A las"}</label>
            <input id={`${id}-i`} type="time" className="campo" value={f.inicio} onChange={(e) => poner("inicio", e.target.value)} required />
          </div>
          {esBloque && (
            <div>
              <label className="etiqueta" htmlFor={`${id}-f`}>Hasta</label>
              <input id={`${id}-f`} type="time" className="campo" value={f.fin} onChange={(e) => poner("fin", e.target.value)} required />
            </div>
          )}
        </div>

        {esCompromiso ? (
          <label className="casilla">
            <input type="checkbox" checked={f.protegido} onChange={(e) => poner("protegido", e.target.checked)} />
            <span>Protegido: que nada suene en medio</span>
          </label>
        ) : esBloque ? (
          <>
            <label className="casilla">
              <input type="checkbox" checked={f.avisar} onChange={(e) => poner("avisar", e.target.checked)} />
              <span>Avisarme por Telegram al empezar, con las tareas del bloque</span>
            </label>
            <label className="casilla">
              <input type="checkbox" checked={f.protegido} onChange={(e) => poner("protegido", e.target.checked)} />
              <span>Protegido: que nada más suene en medio (sólo sus recordatorios)</span>
            </label>
          </>
        ) : (
          <>
            <label className="etiqueta" htmlFor={`${id}-a`}>Avisarme</label>
            <select id={`${id}-a`} className="campo" value={f.avisar === false ? -1 : f.antes} onChange={(e) => (Number(e.target.value) < 0 ? setF((x) => ({ ...x, avisar: false })) : setF((x) => ({ ...x, avisar: true, antes: Number(e.target.value) })))}>
              {ANTES.map((m) => <option key={m} value={m}>{m === 0 ? "A la hora" : `${m} min antes`}</option>)}
              <option value={-1}>No avisar</option>
            </select>
          </>
        )}

        {error && <p role="alert" className="aviso rojo" style={{ marginTop: "var(--sp-3)" }}>{error}</p>}

        <div className="botones" style={{ marginTop: "var(--sp-5)", justifyContent: "space-between" }}>
          {!nuevo && onQuitarDia && dia ? (
            <span className="botones">
              <button type="button" className="boton fantasma" onClick={onQuitarDia}>Quitar sólo este día</button>
              {confirmar ? (
                <button type="button" className="boton rojo" onClick={() => onBorrar()}><Icon name="trash" size={16} /> Sí, de todas las semanas</button>
              ) : (
                <button type="button" className="boton fantasma" onClick={() => setConfirmar(true)}><Icon name="trash" size={16} /> Quitar siempre</button>
              )}
            </span>
          ) : !nuevo && onBorrar ? (
            confirmar ? (
              <button type="button" className="boton rojo" onClick={() => onBorrar()}><Icon name="trash" size={16} /> Sí, quitarlo</button>
            ) : (
              <button type="button" className="boton fantasma" onClick={() => setConfirmar(true)}><Icon name="trash" size={16} /> Quitar</button>
            )
          ) : (
            <span />
          )}
          <div className="botones">
            <button type="button" className="boton fantasma" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="boton primario">Guardar</button>
          </div>
        </div>
      </form>
    </div>
  );
}
