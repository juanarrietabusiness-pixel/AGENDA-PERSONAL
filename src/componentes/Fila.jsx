import Icon from "./Icon.jsx";
import { sombrero, estiloDe } from "../lib/sombreros.js";
import { urgencia } from "../lib/prioridad.js";
import { textoFecha, textoHora } from "../lib/fechas.js";
import { describir } from "../lib/recurrencia.js";
import { valorDe } from "../lib/agenda.js";

const TEXTO_URGENCIA = { vencida: "Se pasó", hoy: "Vence hoy", mañana: "Vence mañana", pronto: "Vence pronto" };

/**
 * Una tarea o un recordatorio: el círculo para marcarla (o desmarcarla), el título —que abre la edición— y lo que hay
 * que saber de ella sin abrirla. `compacta` deja sólo lo urgente (el color ya dice el sombrero): para «Tus 3» y Plan.
 */
export default function Fila({ accion, hoy, sombreros, proyectos = [], onHecha, onAbrir, onEnfoque, onHoyNo, mostrarDia = true, compacta = false, children }) {
  const s = sombrero(accion.sombrero, sombreros);
  const u = urgencia(accion, hoy);
  const hecha = accion.estado === "hecha";
  const valor = valorDe(accion, { proyectos, sombreros });
  const proyecto = proyectos.find((p) => p.id === accion.proyectoId);
  const planeadaAntes = accion.estado === "abierta" && accion.cuando && accion.cuando < hoy && !u;
  const urgente = u && <span className={`chip ${u === "vencida" ? "rojo" : "ambar"}`}>{TEXTO_URGENCIA[u]}{accion.limite && u !== "hoy" && u !== "mañana" ? ` · ${textoFecha(accion.limite, hoy)}` : ""}</span>;
  return (
    <li className={`accion${hecha ? " hecha" : ""}${compacta ? " compacta" : ""}`} style={estiloDe(accion.sombrero, sombreros)}>
      <button
        type="button"
        className="marcar"
        aria-pressed={hecha}
        aria-label={hecha ? `Reabrir: ${accion.titulo}` : `Marcar como hecha: ${accion.titulo}`}
        onClick={() => onHecha?.(accion.id)}
      >
        <Icon name="check" size={14} strokeWidth={3} />
      </button>
      <div>
        <button type="button" className="accion-titulo enlace" onClick={() => onAbrir?.(accion)}>
          {accion.titulo}
        </button>
        {compacta ? (
          (urgente || accion.hora || (mostrarDia && accion.cuando && accion.cuando !== hoy)) && (
            <div className="accion-meta">
              {urgente}
              {mostrarDia && accion.cuando && accion.cuando !== hoy && !u && <span>{textoFecha(accion.cuando, hoy)}</span>}
              {accion.hora && <span>{textoHora(accion.hora)}</span>}
            </div>
          )
        ) : (
          <div className="accion-meta">
            {s && <span>{s.nombre}</span>}
            {proyecto && <span>· {proyecto.nombre}</span>}
            {accion.cliente && <span className="chip">{accion.cliente}</span>}
            {urgente}
            {planeadaAntes && <span className="chip ambar">Quedó del {textoFecha(accion.cuando, hoy)}</span>}
            {valor === "alto" && !hecha && <span className="valor-alto">valor alto</span>}
            {mostrarDia && accion.cuando && accion.cuando !== hoy && !planeadaAntes && <span>{textoFecha(accion.cuando, hoy)}</span>}
            {accion.hora && <span>{textoHora(accion.hora)}</span>}
            {accion.repite?.regla && (
              <span>
                <Icon name="refresh" size={11} style={{ display: "inline", verticalAlign: "-1px" }} /> {describir(accion.repite.regla)}
              </span>
            )}
            {accion.delegable?.a && !hecha && <span className="chip">Puede hacerla {accion.delegable.a}</span>}
            {accion.lista === "espera" && accion.espera?.persona && <span className="chip">Esperas a {accion.espera.persona}</span>}
            {accion.confidencial && <span title="Confidencial"><Icon name="lock" size={11} style={{ display: "inline", verticalAlign: "-1px" }} /><span className="solo-lector">Confidencial</span></span>}
            {accion.notas && <span title={accion.notas}><Icon name="file" size={11} style={{ display: "inline", verticalAlign: "-1px" }} /> Notas</span>}
          </div>
        )}
        {children && <div className="accion-acciones">{children}</div>}
      </div>
      <div className="fila-botones">
        {onEnfoque && !hecha && (accion.clase ?? "tarea") === "tarea" && (
          <button type="button" className="editar-fila fijar" aria-pressed={accion.enfoque === hoy} aria-label={accion.enfoque === hoy ? `Quitar de tus 3 de hoy: ${accion.titulo}` : `Una de tus 3 de hoy: ${accion.titulo}`} title={accion.enfoque === hoy ? "Quitar de tus 3 de hoy" : "Ponerla en tus 3 de hoy"} onClick={() => onEnfoque(accion.id)}>
            <Icon name="star" size={15} />
          </button>
        )}
        {onHoyNo && !hecha && (
          <button type="button" className="editar-fila" aria-label={`Hoy no: ${accion.titulo}`} title="Hoy no" onClick={() => onHoyNo(accion.id)}>
            <Icon name="close" size={15} />
          </button>
        )}
        {!compacta && (
          <button type="button" className="editar-fila" aria-label={`Editar: ${accion.titulo}`} title="Editar: cambiar el tipo, el día, las notas…" onClick={() => onAbrir?.(accion)}>
            <Icon name="pencil" size={15} />
          </button>
        )}
      </div>
    </li>
  );
}
