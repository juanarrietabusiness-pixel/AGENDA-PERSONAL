import { useId, useMemo, useState } from "react";
import Icon from "./Icon.jsx";
import EditarBloque from "./EditarBloque.jsx";
import { aplicarRitmo } from "../lib/ritmo.js";
import { claseDeRitmo, textoDias, diasDe, avisa, rutinaDeGoogle, porRevisar, sombreroPorTitulo } from "../lib/semana.js";
import { claseDeGoogle } from "../lib/agenda.js";
import { estiloDe, nombreDe } from "../lib/sombreros.js";
import { rangoCorto, horaCorta, DIAS } from "../lib/fechas.js";
import * as api from "../lib/api.js";

const primerDia = (e) => Math.min(...diasDe(e).map((d) => (d + 6) % 7), 7);
const cuando = (e) => `${textoDias(e)} · ${claseDeRitmo(e) === "bloque" ? rangoCorto(e.inicio, e.fin) : horaCorta(e.inicio)}`;

/**
 * Tu semana tipo, plegada en una línea: cuántos bloques y recordatorios tiene y si algo está por revisar. Abierta, se
 * explica qué es cada cosa, se arregla lo que está por revisar (bloques sin sombrero, los que se cruzan, lo que quedó
 * de ejemplo) y se edita la lista. También trae la rutina de Google y la publica en «Kairos · Bloques».
 */
export default function SemanaTipo({ estado, sombreros, cambiar, avisar, servidor, recargar, abierta, setAbierta }) {
  const id = useId();
  const ritmo = useMemo(() => estado.ritmo ?? [], [estado.ritmo]);
  const [editando, setEditando] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const google = (estado.conexiones ?? []).filter((c) => c.servicio?.startsWith("google:"));
  const publicada = google.some((c) => c.semana);
  const deGoogle = useMemo(
    () => rutinaDeGoogle(estado.externos ?? [], ritmo, { ajustes: estado.ajustes, esRutina: (x) => claseDeGoogle(x, estado.ajustes) === "rutina" }),
    [estado.externos, ritmo, estado.ajustes],
  );
  const revisar = useMemo(() => porRevisar(ritmo, sombreros), [ritmo, sombreros]);
  const cuantasRevisar = revisar.sinSombrero.length + revisar.choques.length + revisar.porConfirmar.length;
  const orden = [...ritmo].sort((a, b) => primerDia(a) - primerDia(b) || a.inicio.localeCompare(b.inicio));
  const bloques = orden.filter((e) => claseDeRitmo(e) === "bloque");
  const recordatorios = orden.filter((e) => claseDeRitmo(e) === "recordatorio");

  const aplicar = (cambio, aviso) => {
    try {
      const r = aplicarRitmo(ritmo, cambio);
      cambiar((e) => ({ ...e, ritmo: r.ritmo }));
      if (aviso) avisar(aviso(r.bloque));
      return null;
    } catch (err) {
      return err.message;
    }
  };

  const guardar = (datos) => {
    const error = editando.id ? aplicar({ accion: "cambiar", id: editando.id, ...datos }, (b) => `Guardado: «${b.titulo}».`) : aplicar({ accion: "agregar", ...datos }, (b) => `Añadido a tu semana: «${b.titulo}».`);
    if (!error) setEditando(null);
    return error;
  };

  const borrar = () => {
    aplicar({ accion: "quitar", id: editando.id }, (b) => `Quité «${b.titulo}» de tu semana.`);
    setEditando(null);
  };

  const traer = () => {
    const { nuevos, quitar } = deGoogle;
    cambiar((e) => ({ ...e, ritmo: [...(e.ritmo ?? []).filter((x) => !quitar.includes(x.id)), ...nuevos] }));
    avisar(`Traje ${nuevos.length} de tu Google Calendar.`);
  };

  const publicar = async (si) => {
    setOcupado(true);
    try {
      const r = await api.googleSemana(si);
      avisar(r.ok ? (si ? "Listo: tu semana está en el calendario «Kairos · Bloques» de Google." : "Quité el calendario «Kairos · Bloques» de tu Google.") : r.error ?? "No se pudo.");
      await recargar?.();
    } catch {
      avisar("No hay conexión con el servidor.");
    } finally {
      setOcupado(false);
    }
  };

  const fila = (e) => (
    <li key={e.id}>
      <button type="button" className="bloque-fila" style={estiloDe(e.sombrero, sombreros)} onClick={() => setEditando(e)}>
        {claseDeRitmo(e) === "bloque" ? <span className="ley-bloque" aria-hidden="true" /> : <Icon name="bell" size={14} />}
        <span className="bloque-fila-texto">
          <strong>{e.titulo}</strong>
          <small>{cuando(e)}{e.sombrero ? ` · ${nombreDe(e.sombrero, sombreros)}` : " · sin sombrero"}{!avisa(e) ? " · no avisa" : ""}</small>
        </span>
        <Icon name="pencil" size={15} />
      </button>
    </li>
  );

  return (
    <section className="tarjeta semana-tipo" aria-labelledby={`${id}-t`}>
      <div className="semana-tipo-fila">
        <div>
          <h2 id={`${id}-t`}>Tu semana tipo</h2>
          <p className="nota">
            {bloques.length} bloque{bloques.length === 1 ? "" : "s"} · {recordatorios.length} recordatorio{recordatorios.length === 1 ? "" : "s"}
            {cuantasRevisar > 0 && <span className="chip ambar" style={{ marginLeft: 8 }}>{cuantasRevisar} por revisar</span>}
          </p>
        </div>
        <button type="button" className={`boton${abierta ? " fantasma" : ""}`} aria-expanded={abierta} aria-controls={`${id}-e`} onClick={() => setAbierta(!abierta)}>
          {abierta ? "Cerrar" : <><Icon name="pencil" size={15} /> Editar</>}
        </button>
      </div>

      {abierta && (
        <div id={`${id}-e`} className="semana-tipo-editor">
          <dl className="que-es">
            <div><dt><span className="ley-bloque" aria-hidden="true" /> Bloque</dt><dd>Un tramo de tu semana para un sombrero (Trabajo de 8 a 12). Ahí caen sus tareas.</dd></div>
            <div><dt><Icon name="bell" size={14} /> Recordatorio</dt><dd>Un momento fijo que te avisa (Proverbios a las 11:45), aunque caiga dentro de un bloque.</dd></div>
          </dl>

          {cuantasRevisar > 0 && (
            <div className="revisar">
              <h3 className="sub-semana">Por revisar ({cuantasRevisar})</h3>
              <ul className="lista-revisar">
                {revisar.sinSombrero.map((e) => {
                  const sugerido = sombreroPorTitulo(e.titulo, sombreros);
                  return (
                    <li key={`s:${e.id}`}>
                      <span><strong>{e.titulo}</strong> <small>{cuando(e)} · ¿de qué sombrero es?</small></span>
                      <span className="botones">
                        {sugerido && (
                          <button type="button" className="boton" style={estiloDe(sugerido, sombreros)} onClick={() => aplicar({ accion: "cambiar", id: e.id, sombrero: sugerido }, (b) => `«${b.titulo}» es de ${nombreDe(sugerido, sombreros)}.`)}>
                            <span className="punto" /> {nombreDe(sugerido, sombreros)}
                          </button>
                        )}
                        <label className="solo-lector" htmlFor={`${id}-s-${e.id}`}>Sombrero de {e.titulo}</label>
                        <select id={`${id}-s-${e.id}`} className="campo campo-chico" value="" onChange={(ev) => ev.target.value && aplicar({ accion: "cambiar", id: e.id, sombrero: ev.target.value }, (b) => `«${b.titulo}» es de ${nombreDe(ev.target.value, sombreros)}.`)}>
                          <option value="">{sugerido ? "Otro…" : "Escoger…"}</option>
                          {sombreros.filter((s) => s.id !== sugerido).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                      </span>
                    </li>
                  );
                })}
                {revisar.choques.map(({ a, b, dias }) => (
                  <li key={`c:${a.id}:${b.id}`}>
                    <span>
                      <strong>Se cruzan</strong> <small>los {dias.map((d) => DIAS[d]).join(", ")}: «{a.titulo}» ({rangoCorto(a.inicio, a.fin)}) y «{b.titulo}» ({rangoCorto(b.inicio, b.fin)})</small>
                    </span>
                    <span className="botones">
                      {[a, b].map((x) => (
                        <button key={x.id} type="button" className="boton fantasma" onClick={() => aplicar({ accion: "quitar", id: x.id }, (q) => `Quité «${q.titulo}» (${rangoCorto(q.inicio, q.fin)}).`)}>
                          {a.titulo.trim().toLowerCase() === b.titulo.trim().toLowerCase() ? `Quitar el de ${rangoCorto(x.inicio, x.fin)}` : `Quitar «${x.titulo.trim()}»`}
                        </button>
                      ))}
                    </span>
                  </li>
                ))}
                {revisar.porConfirmar.map((e) => (
                  <li key={`p:${e.id}`}>
                    <span><strong>{e.titulo}</strong> <small>{cuando(e)} · lo puse de ejemplo al principio. ¿Sigue?</small></span>
                    <span className="botones">
                      <button type="button" className="boton" onClick={() => aplicar({ accion: "cambiar", id: e.id }, (b) => `«${b.titulo}» se queda.`)}>Sí</button>
                      <button type="button" className="boton fantasma" onClick={() => aplicar({ accion: "quitar", id: e.id }, (b) => `Quité «${b.titulo}».`)}>Quitar</button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h3 className="sub-semana">Bloques</h3>
          {bloques.length ? <ul className="lista-bloques">{bloques.map(fila)}</ul> : <p className="vacio">Todavía no hay bloques.</p>}
          <h3 className="sub-semana">Recordatorios</h3>
          {recordatorios.length ? <ul className="lista-bloques">{recordatorios.map(fila)}</ul> : <p className="vacio">Ninguno. Ejemplo: «Lectura de Proverbios», de lunes a viernes a las 11:45, que te avise 15 min antes.</p>}

          <div className="botones" style={{ marginTop: "var(--sp-4)" }}>
            <button type="button" className="boton" onClick={() => setEditando({ clase: "bloque", sombrero: sombreros[0]?.id ?? null })}><Icon name="plus" size={16} /> Bloque</button>
            <button type="button" className="boton" onClick={() => setEditando({ clase: "recordatorio", inicio: "11:45" })}><Icon name="plus" size={16} /> Recordatorio</button>
            {deGoogle.nuevos.length > 0 && (
              <button type="button" className="boton" onClick={traer}><Icon name="download" size={16} /> Traer {deGoogle.nuevos.length} de Google Calendar</button>
            )}
          </div>

          {servidor && google.length > 0 && (
            <div className="fila-ajuste" style={{ marginTop: "var(--sp-4)" }}>
              <span style={{ fontSize: "var(--fs-sm)" }}>
                {publicada ? "Se ve en tu Google Calendar, en el calendario «Kairos · Bloques»." : "¿La quieres ver en tu Google Calendar? Va en un calendario aparte, «Kairos · Bloques»."}
              </span>
              <button type="button" className="boton fantasma" disabled={ocupado} onClick={() => publicar(!publicada)}>
                {ocupado ? "Un momento…" : publicada ? "Dejar de publicar" : "Publicar en Google"}
              </button>
            </div>
          )}
        </div>
      )}

      {editando && <EditarBloque item={editando} sombreros={sombreros} onGuardar={guardar} onBorrar={editando.id ? borrar : null} onCerrar={() => setEditando(null)} />}
    </section>
  );
}
