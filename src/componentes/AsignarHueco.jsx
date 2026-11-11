import { useId } from "react";
import { useDialogo } from "../hooks/useDialogo.js";
import AnadirRapido from "./AnadirRapido.jsx";
import { ordenarPor, eventosPorAgendar, normalizarEvento } from "../lib/agenda.js";
import { nuevaAccion } from "../lib/metodo.js";
import { estiloDe } from "../lib/sombreros.js";
import { textoLargo, textoCorto, rangoCorto, horaCorta, minutos, aHora, lunesDe, sumarDias } from "../lib/fechas.js";
import { textoHoras } from "../lib/semana.js";

/**
 * Un hueco libre de la semana (martes de 1 a 3): qué poner ahí. Algo nuevo, una reunión que estaba por agendar, o una
 * tarea sin fecha (o de esta semana sin hora). Lo que se pone toma ese día y esa hora.
 */
export default function AsignarHueco({ hueco, hoy, estado, sombreros, cambiar, avisar, onCerrar }) {
  const ref = useDialogo(onCerrar);
  const id = useId();
  const { dia, inicio, fin } = hueco;
  const libre = minutos(fin) - minutos(inicio);
  const lunes = lunesDe(dia);
  const domingo = sumarDias(lunes, 6);
  const ctx = { hoy, proyectos: estado.proyectos, sombreros };
  const porAgendar = eventosPorAgendar(estado.eventos);
  const candidatas = ordenarPor(
    estado.acciones.filter((a) => a.estado === "abierta" && a.lista === "siguientes" && (a.clase ?? "tarea") === "tarea" && !a.hora && (!a.cuando || (a.cuando >= lunes && a.cuando <= domingo))),
    "prioridad",
    ctx,
  ).slice(0, 15);

  const ponerTarea = (a) => {
    cambiar((e) => ({ ...e, acciones: e.acciones.map((x) => (x.id === a.id ? { ...x, cuando: dia, hora: inicio, bloque: null } : x)) }));
    avisar(`«${a.titulo}»: ${textoCorto(dia, hoy)}, ${horaCorta(inicio)}.`);
    onCerrar();
  };
  const ponerReunion = (ev) => {
    const finR = aHora(Math.min(minutos(inicio) + 60, minutos(fin)));
    cambiar((e) => ({ ...e, eventos: e.eventos.map((x) => (x.id === ev.id ? normalizarEvento({ ...x, fecha: dia, inicio, fin: finR }) : x)) }));
    avisar(`«${ev.titulo}» agendada: ${textoCorto(dia, hoy)}, ${rangoCorto(inicio, finR)}.`);
    onCerrar();
  };
  const anadir = ({ titulo, sombrero }) => {
    cambiar((e) => ({ ...e, acciones: [...e.acciones, nuevaAccion({ titulo, sombrero, lista: "siguientes", cuando: dia, hora: inicio, minutos: libre >= 60 ? 60 : 30, origen: "app" }, hoy)] }));
    avisar(`«${titulo}»: ${textoCorto(dia, hoy)}, ${horaCorta(inicio)}.`);
    onCerrar();
  };

  return (
    <div className="capa" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div ref={ref} className="dialogo" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`}>
        <h2 id={`${id}-t`}>Libre · {rangoCorto(inicio, fin)}</h2>
        <p className="nota-fuente">{textoLargo(dia)} · {textoHoras(libre)} libres. ¿Qué pones aquí?</p>

        <AnadirRapido sombreros={sombreros} paraCuando={`a las ${horaCorta(inicio)}`} onAnadir={anadir} />

        {porAgendar.length > 0 && (
          <>
            <h3 className="sub-semana">Reuniones por agendar</h3>
            <ul className="lista-asignar">
              {porAgendar.map((ev) => (
                <li key={ev.id} style={estiloDe(ev.sombrero, sombreros)}>
                  <span>{ev.titulo}</span>
                  <button type="button" className="boton" onClick={() => ponerReunion(ev)}>Aquí</button>
                </li>
              ))}
            </ul>
          </>
        )}

        {candidatas.length > 0 && (
          <>
            <h3 className="sub-semana">Tareas sin fecha o sin hora esta semana</h3>
            <ul className="lista-asignar">
              {candidatas.map((a) => (
                <li key={a.id}>
                  <span>{a.titulo} <small>{textoHoras(Number(a.minutos) || 30)}{a.cuando ? ` · ${textoCorto(a.cuando, hoy)}` : ""}</small></span>
                  <button type="button" className="boton" onClick={() => ponerTarea(a)}>Aquí</button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="botones" style={{ marginTop: "var(--sp-5)", justifyContent: "flex-end" }}>
          <button type="button" className="boton fantasma" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
