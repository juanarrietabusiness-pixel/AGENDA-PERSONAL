import Icon from "../componentes/Icon.jsx";
import { SOMBREROS } from "../lib/sombreros.js";
import { proyectosSinSiguiente, LISTAS } from "../lib/metodo.js";
import { ordenar } from "../lib/prioridad.js";
import { textoFecha } from "../lib/fechas.js";

/**
 * Los cuatro sombreros: lo que lleva cada uno (responsabilidades que no terminan y proyectos que sí) y su siguiente
 * acción. Aquí se ve la vida por partes; el día, en cambio, es uno solo.
 */
export default function Sombreros({ estado, hoy }) {
  const { proyectos, acciones } = estado;
  const sinSiguiente = new Set(proyectosSinSiguiente(proyectos, acciones).map((p) => p.id));
  const abiertas = acciones.filter((a) => a.estado === "abierta");

  return (
    <>
      <h1 className="titulo-pantalla">Tus sombreros</h1>
      <p className="subtitulo">Cuatro roles, sin orden de importancia. Sirven para planear la semana y ver el equilibrio; el día los junta en una sola lista.</p>
      <div className="sombreros">
        {SOMBREROS.map((s) => {
          const suyos = proyectos.filter((p) => p.sombrero === s.id);
          const sueltas = abiertas.filter((a) => a.sombrero === s.id && !a.proyectoId && a.lista === "siguientes");
          const algunDia = abiertas.filter((a) => a.sombrero === s.id && a.lista === "algun-dia").length;
          return (
            <section key={s.id} className={`tarjeta sombrero-tarjeta s-${s.id}`} aria-labelledby={`t-${s.id}`}>
              <div className="sombrero-cabeza">
                <div className="sombrero-icono"><Icon name={s.icono} size={22} /></div>
                <div>
                  <h2 id={`t-${s.id}`}>{s.nombre}</h2>
                  <p>{s.detalle}</p>
                </div>
              </div>
              {s.fuente === "juancito-ads" && (
                <p className="nota-fuente">Sus tareas viven en Juancito Ads; aquí se leen y se marcan hechas.</p>
              )}
              <p style={{ margin: "var(--sp-3) 0", fontSize: "var(--fs-xs)", color: "var(--texto-3)" }}>
                <Icon name="target" size={12} style={{ display: "inline", verticalAlign: "-2px" }} /> Visión y meta del año: por escribir (en la revisión).
              </p>
              <div>
                {suyos.map((p) => {
                  const siguiente = ordenar(abiertas.filter((a) => a.proyectoId === p.id && a.lista === "siguientes"), hoy)[0];
                  const esperando = abiertas.filter((a) => a.proyectoId === p.id && a.lista === "espera");
                  return (
                    <div key={p.id} className="proyecto">
                      <div className="proyecto-nombre">
                        <span>{p.nombre}{p.confidencial && <Icon name="lock" size={12} style={{ display: "inline", marginLeft: 6, verticalAlign: "-1px" }} />}</span>
                        <span className="chip">{p.tipo === "proyecto" ? (p.limite ? `Proyecto · ${textoFecha(p.limite, hoy)}` : "Proyecto") : "Responsabilidad"}</span>
                      </div>
                      {siguiente ? (
                        <div className="proyecto-siguiente">Siguiente: {siguiente.titulo}</div>
                      ) : sinSiguiente.has(p.id) ? (
                        <div className="proyecto-siguiente" style={{ color: "var(--ambar)" }}>
                          Sin siguiente acción{esperando.length ? ` (esperas a ${esperando[0].espera?.persona})` : ""}: ¿cuál es el próximo paso?
                        </div>
                      ) : (
                        <div className="proyecto-siguiente" style={{ color: "var(--texto-3)" }}>Nada pendiente.</div>
                      )}
                    </div>
                  );
                })}
                {sueltas.length > 0 && (
                  <div className="proyecto">
                    <div className="proyecto-nombre"><span>Acciones sueltas</span><span className="chip">{sueltas.length}</span></div>
                    <div className="proyecto-siguiente">{sueltas.map((a) => a.titulo).join(" · ")}</div>
                  </div>
                )}
                {algunDia > 0 && (
                  <div className="proyecto">
                    <div className="proyecto-nombre"><span>{LISTAS["algun-dia"].nombre}</span><span className="chip">{algunDia}</span></div>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
