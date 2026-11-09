import { useId, useState } from "react";
import Icon from "../componentes/Icon.jsx";
import Fila from "../componentes/Fila.jsx";
import * as api from "../lib/api.js";
import { sombrerosDe, estiloDe } from "../lib/sombreros.js";
import { ordenarPor, porDelegar, bajoValor, repartoAbierto } from "../lib/agenda.js";
import { nuevaAccion } from "../lib/metodo.js";
import { sumarDias, textoCorto } from "../lib/fechas.js";

/**
 * La revisión semanal guiada (GTD), en pasos: lo que quedó, la bandeja, los proyectos sin siguiente paso, lo que
 * esperas de otros, qué delegar o soltar, y la semana que viene (cómo va cada sombrero y sus piedras grandes), con el
 * consejo del mentor. Diez minutos; al terminar queda apuntada. Aquí vive lo que antes era la pantalla Mentor.
 */
export default function Revision({ estado, hoy, cambiar, onHecha, onAbrir, onDecidir, onAsistente, recargar, servidor, avisar }) {
  const id = useId();
  const { acciones, proyectos, ajustes, bandeja = [] } = estado;
  const sombreros = sombrerosDe(ajustes);
  const ctx = { hoy, proyectos, sombreros };
  const [pidiendo, setPidiendo] = useState(false);
  const [pasos, setPasos] = useState({});
  const abiertas = acciones.filter((a) => a.estado === "abierta");
  const siguientes = abiertas.filter((a) => a.lista === "siguientes");

  // 1. Lo que quedó: planeado para antes de hoy o con la fecha límite pasada.
  const quedo = ordenarPor(siguientes.filter((a) => (a.cuando && a.cuando < hoy) || (a.limite && a.limite < hoy)), "prioridad", ctx);
  // 3. Proyectos activos sin ninguna siguiente acción.
  const sinPaso = proyectos.filter((p) => p.estado !== "terminado" && p.estado !== "pausado" && !siguientes.some((a) => a.proyectoId === p.id));
  // 4. Lo que esperas de otros.
  const espera = abiertas.filter((a) => a.lista === "espera");
  // 5. Delegar o soltar.
  const delegables = porDelegar(acciones);
  const bajas = bajoValor(acciones, ctx);
  // 6. La semana que viene.
  const reparto = repartoAbierto(acciones, sombreros);
  const maximo = Math.max(1, ...reparto.map((r) => r.abiertas));
  const piedras = siguientes.filter((a) => a.importante);
  const candidatas = ordenarPor(siguientes.filter((a) => !a.importante && !a.delegable?.a), "prioridad", ctx).slice(0, 6);
  const consejo = ajustes.consejo;
  const hecha = ajustes.ultimaRevision && ajustes.ultimaRevision > sumarDias(hoy, -7);

  const conAccion = (aid, fn) => cambiar((e) => ({ ...e, acciones: e.acciones.map((a) => (a.id === aid ? fn(a) : a)) }));
  const delegar = (a) => conAccion(a.id, (x) => ({ ...x, lista: "espera", delegable: null, espera: { persona: a.delegable.a, desde: hoy, preguntar: sumarDias(hoy, 3) } }));
  const anadirPaso = (p) => {
    const titulo = String(pasos[p.id] ?? "").trim();
    if (!titulo) return;
    cambiar((e) => ({ ...e, acciones: [...e.acciones, nuevaAccion({ titulo, sombrero: p.sombrero, proyectoId: p.id, lista: "siguientes", origen: "app" }, hoy)] }));
    setPasos((x) => ({ ...x, [p.id]: "" }));
    avisar(`Siguiente paso de «${p.nombre}»: ${titulo}.`);
  };
  const terminar = () => {
    cambiar((e) => ({ ...e, ajustes: { ...e.ajustes, ultimaRevision: hoy } }));
    avisar("Revisión hecha. Buena semana.");
  };
  const pedirConsejo = async () => {
    setPidiendo(true);
    try {
      const r = await api.mentor();
      if (!r.ok) avisar(r.error ?? "El mentor no pudo contestar.");
      await recargar();
    } catch {
      avisar("No hay conexión con el servidor.");
    } finally {
      setPidiendo(false);
    }
  };

  const fila = (a, botones) => (
    <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={proyectos} onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)}>
      {botones && <div className="botones decidir">{botones}</div>}
    </Fila>
  );

  const paso = (n, titulo, cuenta, nota, cuerpo) => (
    <section className={`tarjeta paso-revision${cuenta === 0 ? " listo" : ""}`} aria-labelledby={`${id}-p${n}`}>
      <div className="paso-cabeza">
        <span className="paso-num" aria-hidden="true">{cuenta === 0 ? <Icon name="check" size={14} strokeWidth={3} /> : n}</span>
        <h2 id={`${id}-p${n}`}>{titulo}</h2>
        {cuenta > 0 && <span className="cuenta">{cuenta}</span>}
      </div>
      {nota && <p className="nota">{nota}</p>}
      {cuerpo}
    </section>
  );

  return (
    <>
      <h1 className="titulo-pantalla">Tu revisión semanal</h1>
      <p className="subtitulo">
        Diez minutos para cerrar la semana y escoger lo importante de la que viene.{hecha ? ` La hiciste el ${textoCorto(ajustes.ultimaRevision, hoy)}.` : ""}
      </p>

      <div className="revision">
        {paso(1, "Lo que quedó", quedo.length, quedo.length ? "Decide qué hacer con cada una: sin culpa, sólo decidir." : "Nada se quedó atrás.", quedo.length > 0 && (
          <ul className="lista">
            {quedo.map((a) => fila(a, (
              <>
                <button type="button" className="boton" onClick={() => onDecidir(a.id, "manana")}>Mañana</button>
                <button type="button" className="boton" onClick={() => onDecidir(a.id, "semana")}>La semana que viene</button>
                <button type="button" className="boton fantasma" onClick={() => onDecidir(a.id, "algun-dia")}>Algún día</button>
                <button type="button" className="boton fantasma" onClick={() => onDecidir(a.id, "soltar")}>Ya no aplica</button>
              </>
            )))}
          </ul>
        ))}

        {paso(2, "Lo que no se ordenó", bandeja.length, bandeja.length ? "Capturas que el asistente no pudo ordenar." : "La bandeja está vacía.", bandeja.length > 0 && (
          <button type="button" className="boton" onClick={onAsistente}><Icon name="inbox" size={16} /> Aclarar {bandeja.length}</button>
        ))}

        {paso(3, "Proyectos sin siguiente paso", sinPaso.length, sinPaso.length ? "Un proyecto sin siguiente paso no avanza. ¿Cuál es el próximo, concreto?" : "Todos tus proyectos tienen su siguiente paso.", sinPaso.length > 0 && (
          <ul className="lista-revision">
            {sinPaso.map((p) => (
              <li key={p.id} style={estiloDe(p.sombrero, sombreros)}>
                <strong><span className="punto" /> {p.nombre}{p.limite ? <small> · hasta {textoCorto(p.limite, hoy)}</small> : null}</strong>
                <form className="anadir-rapido" onSubmit={(e) => { e.preventDefault(); anadirPaso(p); }}>
                  <label className="solo-lector" htmlFor={`${id}-sp-${p.id}`}>Siguiente paso de {p.nombre}</label>
                  <input id={`${id}-sp-${p.id}`} className="campo" placeholder="El siguiente paso, con un verbo…" value={pasos[p.id] ?? ""} onChange={(e) => setPasos((x) => ({ ...x, [p.id]: e.target.value }))} />
                  <button type="submit" className="boton" aria-label={`Añadir el siguiente paso de ${p.nombre}`} disabled={!String(pasos[p.id] ?? "").trim()}><Icon name="plus" size={16} /></button>
                </form>
              </li>
            ))}
          </ul>
        ))}

        {paso(4, "Lo que esperas de otros", espera.length, espera.length ? "¿Ya llegó? Márcala. Si no, ábrela para recordarle o mover la fecha." : "No esperas nada de nadie.", espera.length > 0 && (
          <ul className="lista">{espera.map((a) => fila(a))}</ul>
        ))}

        {paso(5, "Delegar o soltar", delegables.length + bajas.length, delegables.length + bajas.length ? "Lo que otra persona puede hacer, y lo de poco valor que te quita tiempo." : "Nada que delegar ni soltar.", delegables.length + bajas.length > 0 && (
          <ul className="lista">
            {delegables.map((a) => fila(a, (
              <>
                <button type="button" className="boton" onClick={() => delegar(a)}>Delegar a {a.delegable.a}</button>
                <button type="button" className="boton fantasma" onClick={() => conAccion(a.id, (x) => ({ ...x, delegable: null }))}>La hago yo</button>
              </>
            )))}
            {bajas.map((a) => fila(a, (
              <>
                <button type="button" className="boton" onClick={() => onDecidir(a.id, "soltar")}>Soltar</button>
                <button type="button" className="boton fantasma" onClick={() => onDecidir(a.id, "algun-dia")}>Algún día</button>
                <button type="button" className="boton fantasma" onClick={() => conAccion(a.id, (x) => ({ ...x, valor: "medio" }))}>Sí vale</button>
              </>
            )))}
          </ul>
        ))}

        {paso(6, "La semana que viene", null, "Cómo va cada sombrero frente a su prioridad y tus piedras grandes (lo importante que va primero en Tus 3).", (
          <>
            <div className="reparto-lista">
              {reparto.map((r) => (
                <div key={r.id} className="reparto" style={estiloDe(r.id, sombreros)}>
                  <span className="reparto-nombre"><span className="prioridad-num">{r.prioridad}</span> {r.nombre}</span>
                  <span className="reparto-barra" aria-hidden="true"><span style={{ width: `${(r.abiertas / maximo) * 100}%` }} /></span>
                  <span className="reparto-num">{r.abiertas}</span>
                </div>
              ))}
            </div>
            <h3 className="sub-seccion">Tus piedras grandes ({piedras.length})</h3>
            {piedras.length ? <ul className="lista">{piedras.map((a) => fila(a, <button type="button" className="boton fantasma" onClick={() => conAccion(a.id, (x) => ({ ...x, importante: false }))}>Ya no es piedra grande</button>))}</ul> : <p className="vacio">Ninguna todavía. Escoge dos o tres de abajo.</p>}
            {piedras.length < 3 && candidatas.length > 0 && (
              <>
                <h3 className="sub-seccion">Te propongo</h3>
                <ul className="lista">{candidatas.map((a) => fila(a, <button type="button" className="boton" onClick={() => conAccion(a.id, (x) => ({ ...x, importante: true }))}><Icon name="star" size={14} /> Piedra grande</button>))}</ul>
              </>
            )}
          </>
        ))}

        <section className="tarjeta consejo" aria-labelledby={`${id}-consejo`}>
          <div className="seccion-cabeza">
            <h2 id={`${id}-consejo`}><Icon name="sparkles" size={14} /> El consejo del mentor</h2>
            {consejo?.fecha && <span className="nota">del {consejo.fecha}</span>}
          </div>
          {consejo?.texto ? <p className="texto-largo">{consejo.texto}</p> : <p className="vacio">Mira tu semana con tus prioridades y lo que sabe de ti, y te dice qué hacer primero, qué delegar y qué soltar.</p>}
          <div className="botones" style={{ marginTop: "var(--sp-3)" }}>
            <button type="button" className="boton" onClick={pedirConsejo} disabled={!servidor || pidiendo}>
              <Icon name="sparkles" size={16} /> {pidiendo ? "Pensando…" : consejo?.texto ? "Pedir otro consejo" : "Pedir consejo"}
            </button>
          </div>
        </section>

        <div className="botones" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="boton grande primario" onClick={terminar}><Icon name="check" size={18} /> Terminé mi revisión</button>
        </div>
      </div>
    </>
  );
}
