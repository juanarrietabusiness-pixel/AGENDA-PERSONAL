import { useId } from "react";
import Icon from "../componentes/Icon.jsx";
import { TEMAS, OTROS_NOMBRES } from "../lib/temas.js";
import { MODELOS, FUNCIONES, PROVEEDORES, modeloEscogido, advertencias, costo } from "../lib/ia.js";
import { FUERA_DE_CONTEXTO, ATRIBUCION } from "../lib/versiculos.js";

const FRECUENCIAS = [
  { id: "normal", texto: "Normal" },
  { id: "poco", texto: "Poco" },
  { id: "nunca", texto: "Nunca" },
];

const mensual = (m) => 900 * costo(m, { entrada: 6000, salida: 1000 });

export default function Ajustes({ estado, cambiar, reiniciar }) {
  const id = useId();
  const { ajustes } = estado;
  const ia = ajustes.ia;
  const poner = (fn) => cambiar((e) => ({ ...e, ajustes: fn(e.ajustes) }));
  const avisos = advertencias(ia);

  return (
    <>
      <h1 className="titulo-pantalla">Ajustes</h1>
      <p className="subtitulo">Todo se puede cambiar después.</p>

      <section className="tarjeta" aria-labelledby={`${id}-tema`}>
        <div className="seccion-cabeza"><h2 id={`${id}-tema`}>Nombre y color (pruébalos)</h2></div>
        <div className="opciones-tema">
          {TEMAS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="opcion-tema"
              aria-pressed={ajustes.tema === t.id}
              style={{ "--t": t.acento }}
              onClick={() => poner((a) => ({ ...a, tema: t.id }))}
            >
              <span className="muestra" aria-hidden="true" />
              <span>
                <strong>{t.nombre}</strong>
                <span>{t.idea}</span>
              </span>
            </button>
          ))}
        </div>
        <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--fs-xs)", color: "var(--texto-3)" }}>Otros nombres posibles: {OTROS_NOMBRES.join(", ")}.</p>
      </section>

      <section className="tarjeta seccion" aria-labelledby={`${id}-ia`}>
        <div className="seccion-cabeza"><h2 id={`${id}-ia`}>Quién piensa: Claude o Meta</h2></div>
        <div className="segmentado" role="group" aria-label="Proveedor de IA">
          {Object.entries(PROVEEDORES).map(([pid, p]) => (
            <button key={pid} type="button" aria-pressed={ia.proveedor === pid} onClick={() => poner((a) => ({ ...a, ia: { proveedor: pid, modelos: {} } }))}>
              {p.nombre}
            </button>
          ))}
        </div>
        {Object.entries(FUNCIONES).map(([fid, f]) => {
          const actual = modeloEscogido(fid, ia);
          return (
            <div key={fid} className="fila-ajuste">
              <div>
                <label htmlFor={`${id}-${fid}`}><strong>{f.nombre}</strong></label>
                <br />
                <small>{f.detalle}</small>
              </div>
              <select
                id={`${id}-${fid}`}
                className="campo"
                value={actual}
                onChange={(e) => poner((a) => ({ ...a, ia: { ...a.ia, modelos: { ...a.ia.modelos, [fid]: e.target.value } } }))}
              >
                {Object.entries(MODELOS).map(([mid, m]) => (
                  <option key={mid} value={mid}>
                    {m.nombre}{m.entrena ? " (entrena con lo que recibe)" : ""}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
        {avisos.map((t) => (
          <p key={t} className="aviso rojo" role="alert" style={{ marginTop: "var(--sp-3)" }}>
            <Icon name="alert" size={18} /> <span>{t}</span>
          </p>
        ))}
        <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--fs-xs)", color: "var(--texto-3)" }}>
          Ordenar 30 capturas al día cuesta al mes, más o menos: {Object.keys(MODELOS).map((m) => `${MODELOS[m].nombre} ${mensual(m).toFixed(2).replace(".", ",")} US$`).join(" · ")}.
        </p>
      </section>

      <section className="tarjeta seccion" aria-labelledby={`${id}-v`}>
        <div className="seccion-cabeza"><h2 id={`${id}-v`}>Versículos</h2></div>
        <div className="fila-ajuste" style={{ borderTop: 0 }}>
          <div>
            <strong>¿Cada cuánto?</strong>
            <br />
            <small>Normal: en el resumen, el cierre, la revisión y al cumplir algo grande. Poco: sólo el resumen y la revisión. Nunca en un recordatorio.</small>
          </div>
          <div className="segmentado" role="group" aria-label="Frecuencia de los versículos">
            {FRECUENCIAS.map((f) => (
              <button key={f.id} type="button" aria-pressed={ajustes.frecuenciaVersiculos === f.id} onClick={() => poner((a) => ({ ...a, frecuenciaVersiculos: f.id }))}>
                {f.texto}
              </button>
            ))}
          </div>
        </div>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--texto-2)" }}>
          El asistente escoge de un banco cerrado y el texto lo pone la aplicación: nunca cita de memoria. No usa como promesa personal: {FUERA_DE_CONTEXTO.map((v) => v.ref).join(", ")}.
        </p>
        <p style={{ fontSize: "var(--fs-3xs)", color: "var(--texto-3)" }}>{ATRIBUCION}</p>
      </section>

      <section className="tarjeta seccion" aria-labelledby={`${id}-h`}>
        <div className="seccion-cabeza"><h2 id={`${id}-h`}>Tu semana: por confirmar</h2></div>
        <ul style={{ margin: 0, paddingLeft: "var(--sp-5)", color: "var(--texto-2)", fontSize: "var(--fs-sm)" }}>
          {ajustes.porConfirmar.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </section>

      <div className="botones seccion">
        <button type="button" className="boton" onClick={reiniciar}><Icon name="refresh" size={16} /> Volver a los datos de ejemplo</button>
      </div>
    </>
  );
}
