import Icon from "../componentes/Icon.jsx";
import { planDelDia } from "../lib/hoy.js";
import { resumenDeLaManana, cierreDelDia, preguntaCompletaste, BOTONES_DECIDIR } from "../lib/mensajes.js";
import { elegirVersiculo } from "../lib/versiculos.js";
import { preguntasDeHoy } from "../lib/avisos.js";
import { diaSemana, sumarDias, textoCorto } from "../lib/fechas.js";
import { RITMO_BASE } from "../lib/ritmo.js";

const CANAL = { telegram: "Telegram", voz: "Nota de voz", app: "La aplicación", claude: "Claude" };

/**
 * La Bandeja (lo capturado que falta aclarar) y cómo te va a hablar el asistente. Los mensajes de la derecha los arma
 * el CÓDIGO con tu día de verdad: son los que llegarán por Telegram.
 */
export default function Asistente({ estado, hoy, onAclarar }) {
  const { acciones, eventos, ajustes, bandeja } = estado;
  const plan = planDelDia({ dia: hoy, eventos: [...RITMO_BASE, ...eventos], acciones, ajustes });
  const frecuencia = ajustes.frecuenciaVersiculos;
  const resumen = resumenDeLaManana({
    nombre: ajustes.nombre,
    plan,
    versiculo: elegirVersiculo({ momento: "manana", hoy, historial: estado.historialVersiculos, frecuencia }),
  });
  const hechas = acciones.filter((a) => a.estado === "hecha" && a.hechaEl === hoy);
  const cierre = cierreDelDia({
    dia: hoy,
    hechas,
    pendientes: plan.deHoy,
    versiculo: elegirVersiculo({ momento: plan.deHoy.length > hechas.length ? "gracia" : "constancia", hoy, frecuencia }),
  });
  const pregunta = preguntasDeHoy(acciones, hoy)[0];
  const accionPregunta = pregunta && acciones.find((a) => a.id === pregunta.accionId);
  const sabado = sumarDias(hoy, (6 - diaSemana(hoy) + 7) % 7 || 7);

  return (
    <>
      <h1 className="titulo-pantalla">Asistente</h1>
      <p className="subtitulo">Lo que capturas llega aquí, y el asistente lo deja en su sitio. Así te va a escribir por Telegram.</p>
      <div className="rejilla-2">
        <section aria-labelledby="t-bandeja">
          <div className="seccion-cabeza">
            <h2 id="t-bandeja">Bandeja</h2>
            <span className="nota">{bandeja.length ? `${bandeja.length} por aclarar` : "Vacía. Así se queda la cabeza tranquila."}</span>
          </div>
          <ul className="lista">
            {bandeja.map((c) => (
              <li key={c.id} className="tarjeta" style={{ padding: "var(--sp-3) var(--sp-4)" }}>
                <div className="etiqueta-canal">{CANAL[c.canal] ?? c.canal}</div>
                <div>{c.texto}</div>
                <div className="botones" style={{ marginTop: "var(--sp-3)" }}>
                  <button type="button" className="boton primario" onClick={() => onAclarar(c)}>Aclarar</button>
                </div>
              </li>
            ))}
          </ul>
          <p style={{ color: "var(--texto-3)", fontSize: "var(--fs-xs)", marginTop: "var(--sp-3)" }}>
            Con la IA conectada, esto pasa solo: el asistente responde las mismas preguntas y te enseña lo que hizo, con «Deshacer».
            Aquí sólo quedará lo que no supo ordenar.
          </p>
        </section>

        <section aria-labelledby="t-mensajes">
          <div className="seccion-cabeza">
            <h2 id="t-mensajes">Cómo te escribe</h2>
            <span className="nota">Con tu día de hoy</span>
          </div>
          <div className="mensajes">
            <div className="burbuja agente">
              <div className="etiqueta-canal">Resumen de la mañana · {ajustes.avisos.resumen[diaSemana(hoy)]}</div>
              {resumen}
            </div>

            <div className="burbuja tu">
              <div className="etiqueta-canal">Tú, por nota de voz (ejemplo)</div>
              Agenda una reunión con mi hermano Adolfo de la iglesia el sábado a las 10
            </div>
            <div className="burbuja agente">
              <div className="etiqueta-canal">Asistente (ejemplo)</div>
              {`Listo: «Reunión con Adolfo»\nIglesia · ${textoCorto(sabado, hoy)}, 10:00 a. m. · en Google Calendar.\nRecordaré que Adolfo es tu hermano de la iglesia.`}
              <div className="botones">
                <button type="button" className="boton">Cambiar</button>
                <button type="button" className="boton fantasma"><Icon name="undo" size={16} /> Deshacer</button>
              </div>
            </div>

            {accionPregunta && (
              <div className="burbuja agente">
                <div className="etiqueta-canal">Seguimiento</div>
                {preguntaCompletaste(accionPregunta, pregunta.intento, hoy)}
                <div className="botones">
                  {BOTONES_DECIDIR.map((b) => <button key={b.id} type="button" className="boton">{b.texto}</button>)}
                </div>
              </div>
            )}

            <div className="burbuja agente">
              <div className="etiqueta-canal">Cierre del día</div>
              {cierre || "Hoy no había nada planeado. Descansa bien."}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
