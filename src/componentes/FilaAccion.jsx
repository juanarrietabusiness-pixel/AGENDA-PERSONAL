import Icon from "./Icon.jsx";
import { sombrero } from "../lib/sombreros.js";
import { urgencia } from "../lib/prioridad.js";
import { textoFecha } from "../lib/fechas.js";
import { describir } from "../lib/recurrencia.js";
import { MAX_POSPUESTAS } from "../lib/metodo.js";

const TEXTO_URGENCIA = { vencida: "Se pasó", hoy: "Vence hoy", mañana: "Vence mañana", pronto: "Vence pronto" };

/** Una acción: el círculo para marcarla, su título y lo que hay que saber de ella, sin abrirla. */
export default function FilaAccion({ accion, hoy, onHecha, children }) {
  const s = sombrero(accion.sombrero);
  const u = urgencia(accion, hoy);
  const hecha = accion.estado === "hecha";
  return (
    <li className={`accion s-${accion.sombrero ?? "ninguno"}${hecha ? " hecha" : ""}`}>
      <button
        type="button"
        className="marcar"
        aria-pressed={hecha}
        aria-label={hecha ? `Hecha: ${accion.titulo}` : `Marcar como hecha: ${accion.titulo}`}
        onClick={() => onHecha?.(accion.id)}
      >
        <Icon name="check" size={14} strokeWidth={3} />
      </button>
      <div>
        <div className="accion-titulo">{accion.titulo}</div>
        <div className="accion-meta">
          {s && <span>{s.nombre}</span>}
          {accion.cliente && <span className="chip">{accion.cliente}</span>}
          {accion.origen === "juancito-ads" && <span className="chip">Juancito Ads</span>}
          {u && <span className={`chip ${u === "vencida" ? "rojo" : "ambar"}`}>{TEXTO_URGENCIA[u]}{accion.limite && u !== "hoy" ? ` · ${textoFecha(accion.limite, hoy)}` : ""}</span>}
          {accion.importante && (
            <span className="chip acento">
              <Icon name="star" size={11} /> Importante
            </span>
          )}
          {accion.minutos && <span>{accion.minutos} min</span>}
          {accion.cuando && accion.cuando !== hoy && !u && <span>{textoFecha(accion.cuando, hoy)}</span>}
          {accion.repite?.regla && (
            <span>
              <Icon name="refresh" size={11} style={{ display: "inline", verticalAlign: "-1px" }} /> {describir(accion.repite.regla)}
            </span>
          )}
          {accion.confidencial && (
            <span className="chip">
              <Icon name="lock" size={11} /> Confidencial
            </span>
          )}
          {accion.lista === "espera" && accion.espera?.persona && <span>Esperas a {accion.espera.persona}</span>}
          {accion.pospuesta >= MAX_POSPUESTAS && <span className="chip ambar">Movida {accion.pospuesta} veces</span>}
        </div>
        {children && <div className="accion-acciones">{children}</div>}
      </div>
    </li>
  );
}
