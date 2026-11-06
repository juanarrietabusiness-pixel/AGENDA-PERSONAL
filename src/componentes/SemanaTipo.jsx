import { useId, useMemo, useState } from "react";
import Icon from "./Icon.jsx";
import EditarBloque from "./EditarBloque.jsx";
import { aplicarRitmo } from "../lib/ritmo.js";
import { claseDeRitmo, textoDias, diasDe, avisa, rutinaDeGoogle } from "../lib/semana.js";
import { claseDeGoogle } from "../lib/agenda.js";
import { estiloDe, nombreDe } from "../lib/sombreros.js";
import { textoHora } from "../lib/fechas.js";
import * as api from "../lib/api.js";

const primerDia = (e) => Math.min(...diasDe(e).map((d) => (d + 6) % 7), 7);

/**
 * Tu semana tipo: los bloques de cada sombrero y los recordatorios fijos. Se edita aquí (o se le dice al asistente), se
 * puede traer de una vez la rutina que tenías en Google Calendar, y se publica en un calendario aparte de Google para
 * verla en el teléfono.
 */
export default function SemanaTipo({ estado, sombreros, cambiar, avisar, servidor, recargar }) {
  const id = useId();
  const ritmo = useMemo(() => estado.ritmo ?? [], [estado.ritmo]);
  const [editando, setEditando] = useState(null);
  const [abierta, setAbierta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const google = (estado.conexiones ?? []).filter((c) => c.servicio?.startsWith("google:"));
  const publicada = google.some((c) => c.semana);
  const deGoogle = useMemo(
    () => rutinaDeGoogle(estado.externos ?? [], ritmo, { ajustes: estado.ajustes, esRutina: (x) => claseDeGoogle(x, estado.ajustes) === "rutina" }),
    [estado.externos, ritmo, estado.ajustes],
  );
  const orden = [...ritmo].sort((a, b) => primerDia(a) - primerDia(b) || a.inicio.localeCompare(b.inicio));
  const bloques = orden.filter((e) => claseDeRitmo(e) === "bloque");
  const recordatorios = orden.filter((e) => claseDeRitmo(e) === "recordatorio");

  const guardar = (datos) => {
    try {
      const r = editando.id ? aplicarRitmo(ritmo, { accion: "cambiar", id: editando.id, ...datos }) : aplicarRitmo(ritmo, { accion: "agregar", ...datos });
      cambiar((e) => ({ ...e, ritmo: r.ritmo }));
      setEditando(null);
      avisar(`Guardado en tu semana: «${r.bloque.titulo}».`);
      return null;
    } catch (err) {
      return err.message;
    }
  };

  const borrar = () => {
    const r = aplicarRitmo(ritmo, { accion: "quitar", id: editando.id });
    cambiar((e) => ({ ...e, ritmo: r.ritmo }));
    setEditando(null);
    avisar(`Quité «${r.bloque.titulo}» de tu semana.`);
  };

  const traer = () => {
    const { nuevos, quitar } = deGoogle;
    cambiar((e) => ({ ...e, ritmo: [...(e.ritmo ?? []).filter((x) => !quitar.includes(x.id)), ...nuevos] }));
    avisar(`Traje ${nuevos.length} de tu Google Calendar. Revisa el sombrero de cada uno.`);
    setAbierta(true);
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
        <span className="punto" />
        <span className="bloque-fila-texto">
          <strong>{e.titulo}</strong>
          <small>
            {textoDias(e)} · {textoHora(e.inicio)}
            {claseDeRitmo(e) === "bloque" ? `–${textoHora(e.fin)}` : ""}
            {e.sombrero ? ` · ${nombreDe(e.sombrero, sombreros)}` : ""}
          </small>
        </span>
        <span className="bloque-fila-chips">
          {avisa(e) ? <span className="chip"><Icon name="bell" size={11} /> {claseDeRitmo(e) === "recordatorio" && e.antes ? `${e.antes} min antes` : "Avisa"}</span> : null}
          {e.protegido && <span className="chip"><Icon name="lock" size={11} /> Protegido</span>}
          {e.porConfirmar && <span className="chip ambar">Por confirmar</span>}
        </span>
        <Icon name="pencil" size={15} />
      </button>
    </li>
  );

  return (
    <section className="tarjeta seccion semana-tipo" aria-labelledby={`${id}-t`}>
      <div className="seccion-cabeza">
        <h2 id={`${id}-t`}><Icon name="clock" size={14} /> Tu semana tipo</h2>
        <span className="nota">{bloques.length} bloques · {recordatorios.length} recordatorios</span>
      </div>
      <p className="nota">Los bloques de cada sombrero (Reino de 6 a 8, Trabajo de 8 a 12) y los recordatorios fijos dentro. Con esto Hoy te dice qué toca ahora y el asistente te avisa al empezar cada bloque.</p>

      <div className="botones" style={{ marginTop: "var(--sp-3)" }}>
        <button type="button" className="boton" aria-expanded={abierta} onClick={() => setAbierta((x) => !x)}>
          <Icon name={abierta ? "chevronUp" : "chevronDown"} size={16} /> {abierta ? "Ocultar" : "Ver y editar"}
        </button>
        <button type="button" className="boton" onClick={() => setEditando({ clase: "bloque", sombrero: sombreros[0]?.id ?? null })}><Icon name="plus" size={16} /> Bloque</button>
        <button type="button" className="boton" onClick={() => setEditando({ clase: "recordatorio", inicio: "11:45" })}><Icon name="plus" size={16} /> Recordatorio</button>
        {deGoogle.nuevos.length > 0 && (
          <button type="button" className="boton primario" onClick={traer}><Icon name="download" size={16} /> Traer {deGoogle.nuevos.length} de Google Calendar</button>
        )}
      </div>

      {abierta && (
        <>
          <h3 className="sub-semana">Bloques</h3>
          {bloques.length ? <ul className="lista-bloques">{bloques.map(fila)}</ul> : <p className="vacio">Todavía no hay bloques.</p>}
          <h3 className="sub-semana">Recordatorios</h3>
          {recordatorios.length ? <ul className="lista-bloques">{recordatorios.map(fila)}</ul> : <p className="vacio">Ningún recordatorio fijo. Ejemplo: «Lectura de Proverbios», de lunes a viernes a las 11:45, que te avise 15 min antes.</p>}
        </>
      )}

      {servidor && google.length > 0 && (
        <div className="fila-ajuste" style={{ marginTop: "var(--sp-3)" }}>
          <span style={{ fontSize: "var(--fs-sm)" }}>
            {publicada ? "Tu semana se ve en tu Google Calendar, en el calendario «Kairos · Bloques»." : "¿La quieres ver en tu Google Calendar? Se publica en un calendario aparte, «Kairos · Bloques»."}
          </span>
          <button type="button" className={`boton${publicada ? " fantasma" : " primario"}`} disabled={ocupado} onClick={() => publicar(!publicada)}>
            {ocupado ? "Un momento…" : publicada ? "Dejar de publicar" : "Publicar en Google"}
          </button>
        </div>
      )}

      {editando && <EditarBloque item={editando} sombreros={sombreros} onGuardar={guardar} onBorrar={editando.id ? borrar : null} onCerrar={() => setEditando(null)} />}
    </section>
  );
}
