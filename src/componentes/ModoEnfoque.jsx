import { useState } from "react";
import Icon from "./Icon.jsx";
import { useDialogo } from "../hooks/useDialogo.js";
import { estiloDe, nombreDe } from "../lib/sombreros.js";
import { horaCorta, minutos } from "../lib/fechas.js";
import { textoHoras } from "../lib/semana.js";

/**
 * Modo enfoque: una sola tarea a la vez, a pantalla completa, con lo que queda del bloque. Mientras dura, los avisos de
 * Telegram (los de la escalera y los de inicio de bloque) callan hasta `hasta`; los recordatorios fijos y las reuniones
 * siguen. «Hecha» la marca y pasa a la siguiente; «Después» la deja para luego.
 */
export default function ModoEnfoque({ tareas, bloque, hasta, hora, sombreros, onHecha, onSalir }) {
  const ref = useDialogo(onSalir);
  const [indice, setIndice] = useState(0);
  const abiertas = tareas.filter((a) => a.estado === "abierta");
  const actual = abiertas.length ? abiertas[indice % abiertas.length] : null;
  const quedan = Math.max(0, minutos(hasta) - minutos(hora ?? "00:00"));

  return (
    <div className="capa enfoque-capa">
      <div ref={ref} className="enfoque-modo" role="dialog" aria-modal="true" aria-labelledby="enfoque-titulo" style={estiloDe(actual?.sombrero ?? bloque?.sombrero, sombreros)}>
        <header className="enfoque-modo-cabeza">
          <p className="enfoque-modo-bloque">
            <Icon name="target" size={16} /> {bloque ? `${bloque.titulo.trim()} · hasta las ${horaCorta(bloque.fin)}` : "Una cosa a la vez"}
            {quedan > 0 && <span> · quedan {textoHoras(quedan)}</span>}
          </p>
          <button type="button" className="boton fantasma" onClick={onSalir}><Icon name="close" size={16} /> Salir</button>
        </header>

        {actual ? (
          <div className="enfoque-modo-tarea" aria-live="polite">
            <p className="enfoque-modo-cuenta">{(indice % abiertas.length) + 1} de {abiertas.length}{actual.sombrero ? ` · ${nombreDe(actual.sombrero, sombreros)}` : ""}</p>
            <h2 id="enfoque-titulo">{actual.titulo}</h2>
            {actual.notas && <p className="enfoque-modo-notas">{actual.notas}</p>}
            <div className="enfoque-modo-botones">
              <button type="button" className="boton grande primario" onClick={() => onHecha(actual.id)}><Icon name="check" size={20} /> Hecha</button>
              {abiertas.length > 1 && <button type="button" className="boton grande" onClick={() => setIndice((i) => i + 1)}>Después</button>}
            </div>
          </div>
        ) : (
          <div className="enfoque-modo-tarea">
            <h2 id="enfoque-titulo">¡Terminaste lo de este rato!</h2>
            <p className="enfoque-modo-notas">Descansa un momento o sal y escoge lo siguiente.</p>
            <div className="enfoque-modo-botones"><button type="button" className="boton grande primario" onClick={onSalir}>Salir</button></div>
          </div>
        )}

        <p className="enfoque-modo-pie"><Icon name="bell" size={13} /> Avisos en silencio hasta las {horaCorta(hasta)} (menos tus recordatorios fijos y las reuniones).</p>
      </div>
    </div>
  );
}
