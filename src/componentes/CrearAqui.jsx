import { useId, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { useDialogo } from "../hooks/useDialogo.js";
import { useDeslizar } from "../hooks/useDeslizar.js";
import { useMedia } from "../hooks/useMedia.js";
import { ordenarPor, eventosPorAgendar, normalizarEvento } from "../lib/agenda.js";
import { nuevaAccion, nuevoId } from "../lib/metodo.js";
import { estiloDe } from "../lib/sombreros.js";
import { semanaDelDia, textoHoras } from "../lib/semana.js";
import { textoLargo, textoCorto, rangoCorto, horaCorta, minutos, aHora, lunesDe, sumarDias, diaSemana, DIAS, esHora } from "../lib/fechas.js";
import { duracionCercana } from "../lib/rejilla.js";

const CODIGOS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const DIAS_SEMANA = [[1, "L"], [2, "M"], [3, "X"], [4, "J"], [5, "V"], [6, "S"], [0, "D"]];
const QUE = {
  tarea: { nombre: "Tarea", icono: "checkSquare", nota: "Algo que haces tú." },
  evento: { nombre: "Evento", icono: "calendar", nota: "Algo con hora: una reunión, una cita, un ensayo, un culto. De una sola vez se ve en color; si se repite cada semana, en gris (es rutina)." },
  recordatorio: { nombre: "Recordatorio", icono: "bell", nota: "Un momento que te avisa." },
  bloque: { nombre: "Bloque", icono: "layers", nota: "Tiempo para hacer tareas de un sombrero (Trabajo de 8 a 12); ahí caen sus tareas. Se repite cada semana." },
};

/**
 * Crear algo en el calendario, ahí donde tocaste: una tarea, una reunión, un compromiso, un recordatorio o un bloque de
 * tu semana, con su día y su hora ya puestos. Abajo, «o pon aquí algo que ya tienes»: una reunión por agendar o una
 * tarea sin fecha. En la semana tipo sólo se crea lo que se repite (bloque, compromiso fijo, recordatorio).
 */
export default function CrearAqui({ en, tipo = false, queInicial = null, hoy, estado, sombreros, cambiar, aplicarAlRitmo, avisar, onCerrar }) {
  const ref = useDialogo(onCerrar);
  const id = useId();
  const ritmo = estado.ritmo ?? [];
  // En el teléfono no se abre el teclado solo: movería la hoja antes de escoger qué es.
  const tactil = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const bloqueAhi = en.inicio ? semanaDelDia(ritmo, en.dia).bloques.find((b) => b.inicio <= en.inicio && en.inicio < b.fin) : null;
  const [f, setF] = useState(() => ({
    que: queInicial && QUE[queInicial] ? queInicial : tipo ? "bloque" : "tarea",
    personas: false,
    especial: false,
    titulo: "",
    sombrero: bloqueAhi?.sombrero ?? null,
    dia: en.dia,
    inicio: en.inicio ?? "",
    fin: en.fin ?? (en.inicio ? aHora(Math.min(minutos(en.inicio) + 60, 23 * 60 + 59)) : ""),
    repite: tipo,
    dias: [diaSemana(en.dia)],
  }));
  const [error, setError] = useState("");
  const poner = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const opciones = tipo ? ["bloque", "evento", "recordatorio"] : Object.keys(QUE);
  const semanal = f.que === "bloque" || tipo || (f.repite && f.que !== "tarea");
  const conFin = f.que !== "recordatorio";

  // En el teléfono (pantalla entera) se cambia de tipo deslizando a los lados: a la izquierda, el siguiente.
  const pantallaEntera = useMedia("(max-width: 699px)");
  const cuerpo = useRef(null);
  const chips = useRef(null);
  const deslizar = useDeslizar(
    (paso) => {
      const j = opciones.indexOf(f.que) + paso;
      if (j < 0 || j >= opciones.length) return;
      poner("que", opciones[j]);
      const fila = chips.current;
      const chip = fila?.children[j];
      if (fila && chip) fila.scrollTo({ left: fila.scrollLeft + chip.getBoundingClientRect().left - fila.getBoundingClientRect().left - (fila.clientWidth - chip.clientWidth) / 2, behavior: "smooth" });
      if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        cuerpo.current?.animate?.([{ transform: `translateX(${paso * 32}px)`, opacity: 0.3 }, { transform: "none", opacity: 1 }], { duration: 200, easing: "ease-out" });
      }
    },
    () => pantallaEntera,
  );

  const regla = (dias) => `FREQ=WEEKLY;BYDAY=${[...new Set(dias)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => CODIGOS[d]).join(",")}`;

  const crear = (e) => {
    e.preventDefault();
    const titulo = f.titulo.trim();
    if (!titulo) return setError("Escribe qué es.");
    if (f.inicio && !esHora(f.inicio)) return setError("La hora va como HH:MM.");
    if (conFin && f.inicio && f.fin && f.fin <= f.inicio) return setError("El final tiene que ser después del inicio.");
    const cuando = `${textoCorto(f.dia, hoy)}${f.inicio ? `, ${horaCorta(f.inicio)}` : ""}`;
    const clase = f.especial ? "especial" : f.personas ? "reunion" : "evento";
    // Lo que se repite cada semana vive en tu semana tipo (bloque, evento fijo = compromiso, recordatorio fijo); una
    // reunión o un especial que se repite sigue siendo un evento (con su aviso), pero se ve como rutina.
    const aLaSemanaTipo = f.que === "bloque" || f.que === "recordatorio" || (f.que === "evento" && !f.personas && !f.especial);
    if (semanal && aLaSemanaTipo) {
      if (!f.inicio) return setError("Ponle una hora: lo que se repite cada semana necesita hora.");
      if (!f.dias.length) return setError("Escoge al menos un día.");
      const err = aplicarAlRitmo(
        { accion: "agregar", titulo, sombrero: f.sombrero, clase: f.que === "evento" ? "compromiso" : f.que, dias: f.dias, inicio: f.inicio, fin: f.que === "recordatorio" ? undefined : f.fin || aHora(minutos(f.inicio) + 60), devocional: f.sombrero === "reino", ...(f.que === "recordatorio" ? { antes: 10 } : {}), ...(f.que === "evento" ? { avisar: false } : {}) },
        (b) => `«${b.titulo}» en tu semana tipo.`,
      );
      if (err) return setError(err);
      return onCerrar();
    }
    if (f.que === "evento") {
      const ev = normalizarEvento({
        id: nuevoId("e"),
        titulo,
        sombrero: f.sombrero,
        clase,
        ...(f.especial && f.personas ? { conPersonas: true } : {}),
        protegido: false,
        fuente: "app",
        notas: "",
        personas: [],
        fecha: f.repite ? null : f.dia,
        repite: f.repite ? { regla: regla(f.dias), inicio: f.dia } : null,
        inicio: f.inicio || "00:00",
        fin: f.inicio ? f.fin || null : "23:59",
      });
      cambiar((x) => ({ ...x, eventos: [...x.eventos, ev] }));
      avisar(`«${titulo}»: ${f.repite ? "cada semana" : cuando}.`);
      return onCerrar();
    }
    const dura = f.inicio && f.fin ? duracionCercana(minutos(f.fin) - minutos(f.inicio)) : 30;
    const accion = nuevaAccion({ titulo, sombrero: f.sombrero, clase: f.que === "recordatorio" ? "recordatorio" : "tarea", lista: "siguientes", cuando: f.dia, hora: f.inicio || null, minutos: dura, origen: "app" }, hoy);
    cambiar((x) => ({ ...x, acciones: [...x.acciones, accion] }));
    avisar(`«${titulo}»: ${cuando}.`);
    return onCerrar();
  };

  // «O pon aquí algo que ya tienes» (sólo con hora y fuera de la semana tipo).
  const lunes = lunesDe(en.dia);
  const porAgendar = eventosPorAgendar(estado.eventos);
  const candidatas = ordenarPor(
    estado.acciones.filter((a) => a.estado === "abierta" && a.lista === "siguientes" && (a.clase ?? "tarea") === "tarea" && !a.hora && (!a.cuando || (a.cuando >= lunes && a.cuando <= sumarDias(lunes, 6)))),
    "prioridad",
    { hoy, proyectos: estado.proyectos, sombreros },
  ).slice(0, 12);
  const finHueco = en.hueco?.fin ?? en.fin ?? aHora(Math.min(minutos(en.inicio ?? "00:00") + 60, 23 * 60 + 59));
  const ponerTarea = (a) => {
    cambiar((x) => ({ ...x, acciones: x.acciones.map((y) => (y.id === a.id ? { ...y, cuando: en.dia, hora: en.inicio ?? null, bloque: null } : y)) }));
    avisar(`«${a.titulo}»: ${textoCorto(en.dia, hoy)}${en.inicio ? `, ${horaCorta(en.inicio)}` : ""}.`);
    onCerrar();
  };
  const ponerReunion = (ev) => {
    const finR = en.inicio ? aHora(Math.min(minutos(en.inicio) + 60, minutos(finHueco))) : null;
    cambiar((x) => ({ ...x, eventos: x.eventos.map((y) => (y.id === ev.id ? normalizarEvento({ ...y, fecha: en.dia, inicio: en.inicio ?? "00:00", fin: finR ?? "23:59" }) : y)) }));
    avisar(`«${ev.titulo}» agendada: ${textoCorto(en.dia, hoy)}${en.inicio ? `, ${rangoCorto(en.inicio, finR)}` : ""}.`);
    onCerrar();
  };

  return (
    <div className="capa" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <form ref={ref} className="dialogo crear-aqui" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} onSubmit={crear}>
        {/* En el teléfono es una pantalla entera y quieta: arriba, siempre a la vista, cerrar y «Crear». */}
        <div className="crear-barra">
          <button type="button" className="boton fantasma icono" onClick={onCerrar} aria-label="Cancelar"><Icon name="close" size={20} /></button>
          <h2 id={`${id}-t`}>{tipo ? `Tu semana tipo · ${DIAS[diaSemana(en.dia)]}` : textoLargo(en.dia)}{en.inicio ? ` · ${rangoCorto(en.inicio, en.fin ?? finHueco)}` : ""}</h2>
          <button type="submit" className="boton primario crear-barra-ok">Crear</button>
        </div>
        <div ref={cuerpo} className="crear-cuerpo" {...deslizar}>

        <p className="etiqueta" id={`${id}-q`}>¿Qué es? <span className="nota crear-desliza">Desliza a los lados para cambiar</span></p>
        <div ref={chips} className="opciones-clase" role="group" aria-labelledby={`${id}-q`}>
          {opciones.map((k) => (
            <button key={k} type="button" className="chip-boton" aria-pressed={f.que === k} onClick={() => poner("que", k)}>
              <Icon name={QUE[k].icono} size={14} /> {QUE[k].nombre}
            </button>
          ))}
        </div>
        <p className="nota" style={{ marginTop: "var(--sp-2)" }}>{QUE[f.que].nota}</p>

        <label className="etiqueta" htmlFor={`${id}-n`}>Nombre</label>
        <input id={`${id}-n`} className="campo" autoFocus={!tactil} value={f.titulo} onChange={(e) => poner("titulo", e.target.value)} placeholder={f.que === "evento" ? "Reunión con Dayano, Evangelismo, Cita médica…" : f.que === "bloque" ? "Trabajo, Hogar, Grabación…" : "¿Qué es?"} />

        <p className="etiqueta" id={`${id}-s`}>Sombrero</p>
        <div className="filtro-sombreros" role="group" aria-labelledby={`${id}-s`}>
          {sombreros.map((s) => (
            <button key={s.id} type="button" className="chip-boton" style={estiloDe(s.id, sombreros)} aria-pressed={f.sombrero === s.id} onClick={() => poner("sombrero", f.sombrero === s.id ? null : s.id)}>
              <span className="punto" /> {s.nombre}
            </button>
          ))}
        </div>

        {semanal || (f.repite && f.que !== "tarea") ? (
          <>
            <p className="etiqueta" id={`${id}-d`}>Cada semana, los</p>
            <div className="dias-semana-elegir" role="group" aria-labelledby={`${id}-d`}>
              {DIAS_SEMANA.map(([n, letra]) => (
                <button key={n} type="button" className="chip-boton" aria-pressed={f.dias.includes(n)} aria-label={DIAS[n]} onClick={() => poner("dias", f.dias.includes(n) ? f.dias.filter((x) => x !== n) : [...f.dias, n])}>{letra}</button>
              ))}
            </div>
          </>
        ) : (
          <>
            <label className="etiqueta" htmlFor={`${id}-f`}>Día</label>
            <input id={`${id}-f`} type="date" className="campo" value={f.dia} onChange={(e) => e.target.value && poner("dia", e.target.value)} />
          </>
        )}

        <div className="campos-2">
          <div>
            <label className="etiqueta" htmlFor={`${id}-i`}>{conFin ? "Desde" : "A las"}</label>
            <input id={`${id}-i`} type="time" className="campo" value={f.inicio} onChange={(e) => poner("inicio", e.target.value)} />
          </div>
          {conFin && (
            <div>
              <label className="etiqueta" htmlFor={`${id}-h`}>Hasta</label>
              <input id={`${id}-h`} type="time" className="campo" value={f.fin} onChange={(e) => poner("fin", e.target.value)} />
            </div>
          )}
        </div>
        {!f.inicio && f.que === "tarea" && <p className="nota">Sin hora: queda para ese día, en «Del día».</p>}

        {f.que === "evento" && !tipo && (
          <>
            <label className="casilla">
              <input type="checkbox" checked={f.personas} onChange={(e) => poner("personas", e.target.checked)} />
              <span>Es con otras personas (reunión o cita): te aviso media hora antes</span>
            </label>
            <label className="casilla">
              <input type="checkbox" checked={f.especial} onChange={(e) => poner("especial", e.target.checked)} />
              <span><Icon name="star" size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> Especial: que no se me pase (sale arriba del día y en su hora, en color fuerte)</span>
            </label>
          </>
        )}
        {!tipo && f.que !== "bloque" && f.que !== "tarea" && (
          <label className="casilla">
            <input type="checkbox" checked={f.repite} onChange={(e) => poner("repite", e.target.checked)} />
            <span>Se repite cada semana{f.que === "evento" && !f.personas && !f.especial ? " (va a tu semana tipo, en gris)" : f.que === "recordatorio" ? " (va a tu semana tipo)" : " (se verá en gris, como rutina)"}</span>
          </label>
        )}

        {error && <p role="alert" className="aviso rojo" style={{ marginTop: "var(--sp-3)" }}>{error}</p>}

        <div className="botones crear-pie" style={{ marginTop: "var(--sp-4)", justifyContent: "flex-end" }}>
          <button type="button" className="boton fantasma" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="boton primario">Crear</button>
        </div>

        {!tipo && (porAgendar.length > 0 || candidatas.length > 0) && (
          <details className="ya-tienes">
            <summary>O pon aquí algo que ya tienes</summary>
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
          </details>
        )}
        </div>
      </form>
    </div>
  );
}
