import { useId, useState } from "react";
import Icon from "./Icon.jsx";
import { COLORES } from "../lib/sombreros.js";

/** Editar un sombrero: subirlo o bajarlo de prioridad, su nombre, de qué se trata, su color, o quitarlo. */
export default function EditarSombrero({ s, primero, ultimo, posicion, onMover, onGuardar, onQuitar }) {
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
