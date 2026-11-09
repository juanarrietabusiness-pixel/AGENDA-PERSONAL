import { useId, useState } from "react";
import Icon from "./Icon.jsx";
import { estiloDe } from "../lib/sombreros.js";

/**
 * Añadir a mano: se escribe y Enter. El sombrero se escoge (o se cambia) con los chips que salen al escribir; se propone
 * el filtrado o el del bloque en que estás, y si no, el último que usaste. Un recordatorio puede llevar su hora.
 */
export default function AnadirRapido({ sombreros, inicial, clase = "tarea", paraCuando = "para hoy", onAnadir }) {
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
        <button type="submit" className="boton primario" disabled={!titulo.trim()}>Añadir</button>
      </div>
      {titulo.trim() && esRec && (
        <div className="anadir-sombrero">
          <label htmlFor={`${id}-h`}>¿A qué hora? (opcional)</label>
          <input id={`${id}-h`} type="time" className="anadir-hora" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
      )}
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
