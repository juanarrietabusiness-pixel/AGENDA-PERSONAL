import { useId, useState } from "react";
import Icon from "./Icon.jsx";
import { estiloDe, nombreDe } from "../lib/sombreros.js";
import { horaCorta, minutos, rangoCorto } from "../lib/fechas.js";
import { textoHoras } from "../lib/semana.js";

/**
 * Modo enfoque (decisión de Juan): se oculta TODO —el menú, las demás listas, el asistente— y queda sólo el bloque de
 * ahora con su lista de tareas (tus 3 primero), una debajo de otra, la de arriba destacada. Lo hecho se va. Al salir
 * (o al acabar el bloque) todo vuelve como estaba. Mientras dura, los avisos de Telegram callan hasta `hasta`, menos
 * los recordatorios fijos y las reuniones. No es un diálogo: es la pantalla de Hoy mientras dura.
 */
export default function ModoEnfoque({ tareas, tres = [], bloque, hasta, hora, sombreros, onHecha, onAbrir, onAnadir, onSalir }) {
  const id = useId();
  const [nueva, setNueva] = useState("");
  const abiertas = tareas.filter((a) => a.estado === "abierta");
  const hechas = tareas.length - abiertas.length;
  const quedan = Math.max(0, minutos(hasta) - minutos(hora ?? "00:00"));
  const [primera, ...resto] = abiertas;
  const esDeTus3 = (a) => tres.some((x) => x.id === a.id);

  return (
    <section className="enfoque" aria-labelledby={`${id}-t`} style={estiloDe(bloque?.sombrero ?? primera?.sombrero, sombreros)}>
      <header className="enfoque-cabeza">
        <div>
          <p className="enfoque-etiqueta"><Icon name="target" size={14} /> Enfocado</p>
          <h1 id={`${id}-t`}>{bloque ? bloque.titulo.trim() : "Una cosa a la vez"}</h1>
          <p className="nota">
            {bloque ? rangoCorto(bloque.inicio, bloque.fin) : `hasta las ${horaCorta(hasta)}`}
            {quedan > 0 && ` · quedan ${textoHoras(quedan)}`}
            {tareas.length > 0 && ` · ${hechas} de ${tareas.length} hechas`}
          </p>
        </div>
        <button type="button" className="boton" onClick={onSalir}><Icon name="close" size={16} /> Salir del enfoque</button>
      </header>

      {primera ? (
        <>
          <div className="enfoque-actual">
            <button type="button" className="marcar grande" aria-label={`Marcar como hecha: ${primera.titulo}`} onClick={() => onHecha(primera.id)}>
              <Icon name="check" size={20} strokeWidth={3} />
            </button>
            <div>
              <p className="enfoque-ahora">{esDeTus3(primera) ? "Ahora · una de tus 3" : "Ahora"}</p>
              <button type="button" className="enlace enfoque-titulo" onClick={() => onAbrir?.(primera)}>{primera.titulo}</button>
              {primera.notas && <p className="enfoque-notas">{primera.notas}</p>}
              {primera.sombrero && primera.sombrero !== bloque?.sombrero && <p className="nota">{nombreDe(primera.sombrero, sombreros)}</p>}
            </div>
          </div>
          {resto.length > 0 && (
            <>
              <h2 className="enfoque-sub">Después</h2>
              <ol className="enfoque-lista">
                {resto.map((a) => (
                  <li key={a.id} style={estiloDe(a.sombrero, sombreros)}>
                    <button type="button" className="marcar" aria-label={`Marcar como hecha: ${a.titulo}`} onClick={() => onHecha(a.id)}>
                      <Icon name="check" size={14} strokeWidth={3} />
                    </button>
                    <button type="button" className="enlace" onClick={() => onAbrir?.(a)}>{a.titulo}</button>
                    {esDeTus3(a) && <Icon name="star" size={13} className="enfoque-tres" />}
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      ) : (
        <div className="enfoque-actual vacio-enfoque">
          <div>
            <p className="enfoque-titulo">{tareas.length ? "¡Terminaste lo de este bloque!" : "No hay tareas en este bloque."}</p>
            <p className="enfoque-notas">Añade lo que vas a hacer ahora, o sal y escoge lo siguiente.</p>
          </div>
        </div>
      )}

      {onAnadir && (
        <form
          className="anadir-linea enfoque-anadir"
          onSubmit={(e) => {
            e.preventDefault();
            if (!nueva.trim()) return;
            onAnadir(nueva.trim());
            setNueva("");
          }}
        >
          <Icon name="plus" size={16} />
          <label className="solo-lector" htmlFor={`${id}-a`}>Añadir a este bloque</label>
          <input id={`${id}-a`} className="anadir-campo" placeholder="Añadir a este bloque…" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        </form>
      )}

      <p className="enfoque-pie"><Icon name="bell" size={13} /> Avisos en silencio hasta las {horaCorta(hasta)} (menos tus recordatorios fijos y las reuniones). Al salir, todo vuelve como estaba.</p>
    </section>
  );
}
