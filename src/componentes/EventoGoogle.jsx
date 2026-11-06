import { useId } from "react";
import Icon from "./Icon.jsx";
import { useDialogo } from "../hooks/useDialogo.js";
import { CLASES_GOOGLE, claseDeGoogle } from "../lib/agenda.js";
import { textoLargo, textoHora } from "../lib/fechas.js";

const EXPLICA = {
  reunion: "Sale en «Reuniones» de Hoy y en el resumen de la mañana.",
  rutina: "No ocupa Hoy: está en tu semana, en Plan (y plegada en Hoy, por si se te olvida).",
  especial: "Sale en «Eventos especiales» del mes.",
};

/**
 * Un evento de Google Calendar: se cambia allá (el enlace lo abre), pero aquí decides QUÉ ES para la agenda —una
 * reunión, parte de tu rutina o un evento especial—. Si se repite, vale para toda la serie.
 */
export default function EventoGoogle({ evento, ajustes, onCambiar, onCerrar }) {
  const ref = useDialogo(onCerrar);
  const id = useId();
  const actual = claseDeGoogle(evento, ajustes);
  return (
    <div className="capa" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div ref={ref} className="dialogo" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`}>
        <h2 id={`${id}-t`}>{evento.titulo}</h2>
        <p className="nota-fuente">
          {textoLargo(evento.dia)}
          {evento.inicio ? `, ${textoHora(evento.inicio)}${evento.fin ? ` a ${textoHora(evento.fin)}` : ""}` : ", todo el día"}
          {" · "}
          {evento.calendarioNombre ?? `Google · ${evento.cuenta}`}
        </p>
        {evento.lugar && <p style={{ fontSize: "var(--fs-sm)" }}><Icon name="mapPin" size={14} /> {evento.lugar}</p>}
        {evento.notas && <p className="texto-largo" style={{ fontSize: "var(--fs-sm)", color: "var(--texto-2)" }}>{evento.notas}</p>}

        <p className="etiqueta" id={`${id}-q`} style={{ marginTop: "var(--sp-4)" }}>¿Qué es para tu agenda?</p>
        <div className="opciones-clase" role="group" aria-labelledby={`${id}-q`}>
          {Object.entries(CLASES_GOOGLE).map(([v, t]) => (
            <button key={v} type="button" className="chip-boton" aria-pressed={actual === v} onClick={() => onCambiar(evento, v)}>{t}</button>
          ))}
        </div>
        <p className="nota" style={{ marginTop: "var(--sp-2)" }}>
          {EXPLICA[actual]}
          {evento.serie ? " Vale para todas las veces que se repite." : ""}
        </p>

        <div className="botones" style={{ marginTop: "var(--sp-5)", justifyContent: "flex-end" }}>
          {evento.enlace && (
            <a className="boton" href={evento.enlace} target="_blank" rel="noopener noreferrer"><Icon name="external" size={16} /> Cambiarlo en Google Calendar</a>
          )}
          <button type="button" className="boton primario" onClick={onCerrar}>Listo</button>
        </div>
      </div>
    </div>
  );
}
