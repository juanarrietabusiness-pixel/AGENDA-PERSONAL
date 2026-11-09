import { useId, useState } from "react";
import Icon from "./Icon.jsx";
import * as api from "../lib/api.js";
import { nombreDe, estiloDe } from "../lib/sombreros.js";
import { TIPOS_NOTA, FICHA_INICIAL, fold } from "../lib/cerebro.js";

/** Lo que el asistente sabe de ti: tu ficha (va siempre), tus notas y lo que aprendió. Todo se corrige o se borra. */
export default function Cerebro({ cerebro, sombreros, servidor, recargar, avisar }) {
  const id = useId();
  const ficha = cerebro.find((n) => n.tipo === "ficha");
  const [textoFicha, setTextoFicha] = useState(ficha?.texto ?? FICHA_INICIAL);
  const [nueva, setNueva] = useState(null);
  const [buscar, setBuscar] = useState("");
  const [abierta, setAbierta] = useState(null);
  const notas = cerebro.filter((n) => n.tipo !== "ficha" && (!buscar || fold(`${n.titulo} ${n.texto}`).includes(fold(buscar))));

  const guardar = async (nota) => {
    const r = await api.guardarNota(nota.id ?? `n-${Date.now().toString(36)}`, nota);
    if (!r.ok) {
      avisar(r.error ?? "No se guardó.");
      return false;
    }
    await recargar();
    return true;
  };

  return (
    <section className="seccion" aria-labelledby={`${id}-cerebro`}>
      <div className="seccion-cabeza">
        <h2 id={`${id}-cerebro`}><Icon name="brain" size={14} /> Lo que sé de ti</h2>
        <span className="nota">El asistente lo lee al ordenar lo que le dices: así deja de sonar genérico</span>
      </div>
      {!servidor && <p className="vacio">El cerebro vive en el servidor.</p>}
      {servidor && (
        <>
          <div className="tarjeta">
            <label className="etiqueta" htmlFor={`${id}-ficha`} style={{ marginTop: 0 }}>Tu ficha: quién eres, qué te importa, cómo trabajas (va siempre)</label>
            <textarea id={`${id}-ficha`} className="campo" style={{ minHeight: 160 }} value={textoFicha} onChange={(e) => setTextoFicha(e.target.value)} />
            <div className="botones" style={{ marginTop: "var(--sp-2)" }}>
              <button type="button" className="boton primario" disabled={textoFicha === (ficha?.texto ?? null)} onClick={async () => (await guardar({ id: "ficha", tipo: "ficha", titulo: "Mi ficha", texto: textoFicha })) && avisar("Ficha guardada.")}>Guardar ficha</button>
            </div>
          </div>

          <div className="botones" style={{ margin: "var(--sp-4) 0 var(--sp-2)", alignItems: "center" }}>
            <label className="solo-lector" htmlFor={`${id}-buscar`}>Buscar en lo que sé</label>
            <input id={`${id}-buscar`} className="campo" style={{ flex: 1, minWidth: 180 }} placeholder="Buscar…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
            <button type="button" className="boton" onClick={() => setNueva({ tipo: "nota", titulo: "", texto: "", sombrero: "" })}><Icon name="plus" size={16} /> Nota</button>
          </div>

          {nueva && <EditorNota nota={nueva} sombreros={sombreros} onGuardar={async (n) => (await guardar(n)) && setNueva(null)} onCancelar={() => setNueva(null)} />}

          {notas.length ? (
            <ul className="lista">
              {notas.map((n) => (
                <li key={n.id} className="nota-cerebro" style={estiloDe(n.sombrero, sombreros)}>
                  {abierta === n.id ? (
                    <EditorNota nota={n} sombreros={sombreros} onGuardar={async (x) => (await guardar(x)) && setAbierta(null)} onCancelar={() => setAbierta(null)} onBorrar={async () => { await api.borrarNota(n.id); await recargar(); }} />
                  ) : (
                    <button type="button" className="enlace nota-boton" onClick={() => setAbierta(n.id)}>
                      <strong>{n.titulo}</strong>
                      <span>{n.texto}</span>
                      <small>{TIPOS_NOTA[n.tipo]}{n.sombrero ? ` · ${nombreDe(n.sombrero, sombreros)}` : ""}{n.usos ? ` · usada ${n.usos} ${n.usos === 1 ? "vez" : "veces"}` : ""}</small>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="vacio">{buscar ? "Nada con eso." : "Todavía no hay notas. El asistente irá apuntando lo que aprenda de ti, y tú puedes escribir las tuyas."}</p>}
        </>
      )}
    </section>
  );
}

function EditorNota({ nota, sombreros, onGuardar, onCancelar, onBorrar }) {
  const id = useId();
  const [n, setN] = useState({ ...nota, sombrero: nota.sombrero ?? "" });
  const [seguro, setSeguro] = useState(false);
  return (
    <form className="tarjeta editor-nota" onSubmit={(e) => { e.preventDefault(); onGuardar({ ...n, sombrero: n.sombrero || null, tipo: n.tipo === "ficha" ? "ficha" : n.tipo }); }}>
      <label className="etiqueta" htmlFor={`${id}-t`} style={{ marginTop: 0 }}>Título</label>
      <input id={`${id}-t`} className="campo" value={n.titulo} onChange={(e) => setN((x) => ({ ...x, titulo: e.target.value }))} required maxLength={80} />
      <label className="etiqueta" htmlFor={`${id}-x`}>Qué sé</label>
      <textarea id={`${id}-x`} className="campo" value={n.texto} onChange={(e) => setN((x) => ({ ...x, texto: e.target.value }))} required />
      <label className="etiqueta" htmlFor={`${id}-s`}>Sombrero</label>
      <select id={`${id}-s`} className="campo" value={n.sombrero} onChange={(e) => setN((x) => ({ ...x, sombrero: e.target.value }))}>
        <option value="">Ninguno</option>
        {sombreros.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>
      <div className="botones" style={{ justifyContent: "space-between", marginTop: "var(--sp-3)" }}>
        {onBorrar ? <button type="button" className="boton fantasma" style={{ color: "var(--rojo)" }} onClick={() => (seguro ? onBorrar() : setSeguro(true))}><Icon name="trash" size={16} /> {seguro ? "¿Seguro?" : "Borrar"}</button> : <span />}
        <div className="botones">
          <button type="button" className="boton fantasma" onClick={onCancelar}>Cancelar</button>
          <button type="submit" className="boton primario">Guardar</button>
        </div>
      </div>
    </form>
  );
}
