import Icon from "../componentes/Icon.jsx";
import FilaAccion from "../componentes/FilaAccion.jsx";
import { planDelDia, ahora } from "../lib/hoy.js";
import { textoHora, textoLargo, minutos } from "../lib/fechas.js";
import { sombrero } from "../lib/sombreros.js";
import { elegirVersiculo, ATRIBUCION } from "../lib/versiculos.js";
import { variante } from "../lib/mensajes.js";
import { pideDecision } from "../lib/metodo.js";
import { RITMO_BASE } from "../lib/ritmo.js";

const SALUDO = ["Buenos días", "Buen día", "Arrancamos"];
const saludo = (hora, dia) => (hora < "12:00" ? variante(SALUDO, dia) : hora < "19:00" ? "Buenas tardes" : "Buenas noches");

const duracion = (min) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60}` : ""}`);

export default function Hoy({ estado, hoy, hora, acciones: accionesUI }) {
  const { acciones, eventos, ajustes, bandeja } = estado;
  const plan = planDelDia({ dia: hoy, eventos: [...RITMO_BASE, ...eventos], acciones, ajustes, ahora: hora });
  const { actual } = ahora(plan, hora);
  const v = elegirVersiculo({ momento: "manana", hoy, historial: estado.historialVersiculos, frecuencia: ajustes.frecuenciaVersiculos });
  const tres = [...plan.tres.escogidas, ...plan.tres.sugeridas];
  const hechasHoy = acciones.filter((a) => a.estado === "hecha" && a.hechaEl === hoy);

  const linea = [
    ...plan.fijos.map((f) => ({ ...f, tipo: "fijo" })),
    ...plan.propuesta.map((b) => ({ ...b, tipo: "propuesta", id: `p-${b.accionId}` })),
  ].sort((a, b) => a.inicio.localeCompare(b.inicio));

  return (
    <>
      <h1 className="titulo-pantalla">{saludo(hora, hoy)}, {ajustes.nombre}.</h1>
      <p className="subtitulo" style={{ textTransform: "none" }}>
        Hoy es {textoLargo(hoy)}. {hechasHoy.length > 0 && `Llevas ${hechasHoy.length} hecha${hechasHoy.length === 1 ? "" : "s"}.`}
      </p>
      {v && (
        <blockquote className="versiculo">
          «{v.texto}»<cite>{v.ref} <span className="solo-lector">({ATRIBUCION})</span></cite>
        </blockquote>
      )}

      {(plan.vencen.some((a) => a.limite < hoy) || plan.sobrecarga || bandeja.length > 0) && (
        <div className="lista" style={{ marginTop: "var(--sp-4)" }}>
          {plan.vencen.filter((a) => a.limite < hoy).map((a) => (
            <div key={a.id} className="aviso rojo">
              <Icon name="alert" size={18} />
              <span>«{a.titulo}» tenía fecha límite y se pasó. ¿La haces hoy?</span>
            </div>
          ))}
          {plan.sobrecarga && (
            <div className="aviso">
              <Icon name="clock" size={18} />
              <span>
                Hoy hay {duracion(plan.minutosPlaneados)} planeadas y {duracion(plan.minutosLibres)} libres. No cabe todo: {plan.noCaben.length === 1 ? "una" : plan.noCaben.length} se queda{plan.noCaben.length === 1 ? "" : "n"} fuera. ¿Movemos algo?
              </span>
            </div>
          )}
          {bandeja.length > 0 && (
            <a className="aviso" href="#asistente" style={{ textDecoration: "none" }}>
              <Icon name="inbox" size={18} />
              <span>{bandeja.length} cosa{bandeja.length === 1 ? "" : "s"} en la Bandeja por aclarar.</span>
            </a>
          )}
        </div>
      )}

      <div className="hoy-rejilla">
        <div>
          <section className="seccion" aria-labelledby="t-tres">
            <div className="seccion-cabeza">
              <h2 id="t-tres">Las 3 de hoy</h2>
              <span className="nota">{plan.tres.escogidas.length ? "Las escogiste tú" : "Sugeridas: escoge las tuyas"}</span>
            </div>
            <ul className="lista tres">
              {tres.map((a) => (
                <FilaAccion key={a.id} accion={a} hoy={hoy} onHecha={accionesUI.hecha}>
                  {a.enfoque !== hoy && (
                    <button type="button" className="boton" onClick={() => accionesUI.escoger(a.id)}>
                      <Icon name="target" size={16} /> Es de mis 3
                    </button>
                  )}
                </FilaAccion>
              ))}
              {!tres.length && <li className="tarjeta">Nada urgente ni importante pendiente. Buen día para avanzar en una meta.</li>}
            </ul>
          </section>

          <section className="seccion" aria-labelledby="t-resto">
            <div className="seccion-cabeza">
              <h2 id="t-resto">También para hoy</h2>
              <span className="nota">{plan.deHoy.length} acciones</span>
            </div>
            <ul className="lista">
              {plan.deHoy.filter((a) => !tres.some((t) => t.id === a.id)).map((a) => (
                <FilaAccion key={a.id} accion={a} hoy={hoy} onHecha={accionesUI.hecha} />
              ))}
              {hechasHoy.map((a) => <FilaAccion key={a.id} accion={a} hoy={hoy} onHecha={accionesUI.deshacer} />)}
            </ul>
          </section>

          {plan.porDecidir.length > 0 && (
            <section className="seccion" aria-labelledby="t-decidir">
              <div className="seccion-cabeza">
                <h2 id="t-decidir">Por decidir</h2>
                <span className="nota">Lo planeaste antes y no salió. Sin culpa: decide.</span>
              </div>
              <ul className="lista">
                {plan.porDecidir.map((a) => (
                  <FilaAccion key={a.id} accion={a} hoy={hoy} onHecha={accionesUI.hecha}>
                    {pideDecision(a) && <p style={{ margin: "0 0 var(--sp-2)", fontSize: "var(--fs-xs)" }}>Ya la moviste {a.pospuesta} veces. ¿Sigue valiendo la pena?</p>}
                    <div className="botones">
                      <button type="button" className="boton" onClick={() => accionesUI.decidir(a.id, "hoy")}>Hoy</button>
                      <button type="button" className="boton" onClick={() => accionesUI.decidir(a.id, "manana")}>Mañana</button>
                      <button type="button" className="boton" onClick={() => accionesUI.decidir(a.id, "algun-dia")}>Algún día</button>
                      <button type="button" className="boton fantasma" onClick={() => accionesUI.decidir(a.id, "soltar")}>Ya no aplica</button>
                    </div>
                  </FilaAccion>
                ))}
              </ul>
            </section>
          )}

          {plan.esperas.length > 0 && (
            <section className="seccion" aria-labelledby="t-espera">
              <div className="seccion-cabeza"><h2 id="t-espera">Toca preguntar</h2></div>
              <ul className="lista">
                {plan.esperas.map((a) => <FilaAccion key={a.id} accion={a} hoy={hoy} onHecha={accionesUI.hecha} />)}
              </ul>
            </section>
          )}
        </div>

        <section className="seccion" aria-labelledby="t-agenda">
          <div className="seccion-cabeza">
            <h2 id="t-agenda">Tu día</h2>
            <span className="nota">Lo fijo, y en punteado lo que te propongo acomodar</span>
          </div>
          <ol className="linea lista">
            {linea.map((b) => {
              const s = b.devocional ? "devocional" : b.sombrero;
              const esAhora = actual && actual.inicio === b.inicio && actual.titulo === b.titulo;
              return (
                <li key={b.id} className={`bloque s-${s ?? "ninguno"}${b.tipo === "propuesta" ? " propuesta" : ""}${esAhora ? " ahora" : ""}`}>
                  <div className="bloque-hora">
                    {textoHora(b.inicio)}
                    <small>{duracion(minutos(b.fin) - minutos(b.inicio))}</small>
                  </div>
                  <div>
                    <div className="bloque-titulo">{b.titulo}</div>
                    <div className="bloque-meta">
                      <span className="punto" />
                      <span>{b.devocional ? "Con Dios" : sombrero(b.sombrero)?.nombre ?? "—"}</span>
                      {esAhora && <span className="chip acento">Ahora</span>}
                      {b.protegido && (
                        <span><Icon name="moon" size={11} style={{ display: "inline", verticalAlign: "-1px" }} /> Sin avisos</span>
                      )}
                      {b.fuente === "google" && <span>Google Calendar</span>}
                      {b.porConfirmar && <span className="chip">Hora por confirmar</span>}
                      {b.tipo === "propuesta" && (
                        <button type="button" className="boton" style={{ minHeight: 28 }} onClick={() => accionesUI.aceptarBloque(b)}>
                          Agendar aquí
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </>
  );
}
