import { lunesDe, sumarDias, DIAS, DIAS_CORTOS, partes, textoHora, diaSemana } from "../lib/fechas.js";
import { eventosDelDia } from "../lib/hoy.js";
import { SOMBREROS, balance, descuidados, sombrero } from "../lib/sombreros.js";
import { cuadrante, ordenar } from "../lib/prioridad.js";
import { RITMO_BASE } from "../lib/ritmo.js";

/** La semana: lo fijo y lo planeado día por día, cómo se reparte entre los sombreros y las piedras grandes de cada uno. */
export default function Semana({ estado, hoy }) {
  const { acciones, eventos } = estado;
  const lunes = lunesDe(hoy);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const todos = [...(estado.ritmo ?? RITMO_BASE), ...eventos];
  const porDia = dias.map((d) => ({
    dia: d,
    eventos: eventosDelDia(todos, d),
    acciones: acciones.filter((a) => a.estado === "abierta" && (a.cuando === d || a.limite === d)),
  }));
  const filas = balance({
    eventos: porDia.flatMap((p) => p.eventos.filter((e) => !e.devocional)),
    hechas: porDia.flatMap((p) => p.acciones),
  });
  const flojos = descuidados(filas);
  const abiertas = acciones.filter((a) => a.estado === "abierta" && a.lista === "siguientes");

  return (
    <>
      <h1 className="titulo-pantalla">Esta semana</h1>
      <p className="subtitulo">Del lunes {partes(dias[0]).dia} al domingo {partes(dias[6]).dia}. Lo fijo viene de Google Calendar; lo demás lo planeas tú.</p>

      <section className="tarjeta" aria-labelledby="t-balance">
        <div className="seccion-cabeza"><h2 id="t-balance">Cómo se reparte tu tiempo</h2></div>
        <div className="balance" role="img" aria-label={filas.map((f) => `${sombrero(f.id).nombre} ${f.porcentaje} %`).join(", ")}>
          {filas.map((f) => <span key={f.id} className={`s-${f.id}`} style={{ width: `${f.porcentaje}%` }} />)}
        </div>
        <div className="balance-leyenda">
          {filas.map((f) => (
            <span key={f.id} className={`s-${f.id}`}><span className="punto" />{sombrero(f.id).nombre} {f.porcentaje} %</span>
          ))}
        </div>
        {flojos.length > 0 && (
          <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--fs-sm)", color: "var(--texto-2)" }}>
            {flojos.map((id) => sombrero(id).nombre).join(" y ")} casi no tiene{flojos.length > 1 ? "n" : ""} tiempo esta semana. ¿Le damos una piedra grande?
          </p>
        )}
      </section>

      <section className="seccion" aria-labelledby="t-piedras">
        <div className="seccion-cabeza">
          <h2 id="t-piedras">Piedras grandes</h2>
          <span className="nota">Lo importante de cada sombrero, antes de que la semana se llene de lo urgente</span>
        </div>
        <div className="sombreros">
          {SOMBREROS.map((s) => {
            const piedras = ordenar(abiertas.filter((a) => a.sombrero === s.id && a.importante && cuadrante(a, hoy) <= 2), hoy).slice(0, 2);
            return (
              <div key={s.id} className={`tarjeta s-${s.id}`} style={{ borderTop: "4px solid var(--s)", padding: "var(--sp-3) var(--sp-4)" }}>
                <strong>{s.nombre}</strong>
                <ul className="lista" style={{ marginTop: "var(--sp-2)", gap: 4 }}>
                  {piedras.map((a) => <li key={a.id} style={{ fontSize: "var(--fs-sm)" }}>{a.titulo}</li>)}
                  {!piedras.length && <li style={{ fontSize: "var(--fs-sm)", color: "var(--texto-3)" }}>Ninguna todavía. Se escoge en la revisión del sábado.</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="seccion" aria-labelledby="t-dias">
        <div className="seccion-cabeza"><h2 id="t-dias">Día por día</h2></div>
        <div className="semana">
          {porDia.map(({ dia, eventos: evs, acciones: acs }) => (
            <article key={dia} className={`dia${dia === hoy ? " es-hoy" : ""}`} aria-label={`${DIAS[diaSemana(dia)]} ${partes(dia).dia}`}>
              <h3>
                <span>{DIAS_CORTOS[diaSemana(dia)]} {partes(dia).dia}</span>
                {dia === hoy && <span className="chip acento">Hoy</span>}
              </h3>
              {evs.filter((e) => !e.devocional).map((e) => (
                <div key={e.id} className={`dia-item s-${e.sombrero}`}>
                  <span className="punto" />
                  <span><time>{textoHora(e.inicio)}</time>{e.titulo}</span>
                </div>
              ))}
              {acs.map((a) => (
                <div key={a.id} className={`dia-item accion-dia s-${a.sombrero}`}>
                  <span className="punto" style={{ background: "transparent", border: "2px solid var(--s)" }} />
                  <span>{a.titulo}</span>
                </div>
              ))}
              {!evs.some((e) => !e.devocional) && !acs.length && <div className="dia-item">Libre</div>}
            </article>
          ))}
        </div>
        <p style={{ color: "var(--texto-3)", fontSize: "var(--fs-xs)", marginTop: "var(--sp-3)" }}>
          Los tiempos con Dios (oración y Palabra) no salen aquí ni cuentan en el reparto: van antes que los sombreros.
        </p>
      </section>
    </>
  );
}
