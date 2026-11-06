import { useId, useState } from "react";
import Icon from "../componentes/Icon.jsx";
import Fila from "../componentes/Fila.jsx";
import * as api from "../lib/api.js";
import { sombrerosDe, estiloDe, nombreDe } from "../lib/sombreros.js";
import { loQueMasVale, porDelegar, bajoValor, repartoAbierto } from "../lib/agenda.js";
import { TIPOS_NOTA, FICHA_INICIAL, fold } from "../lib/cerebro.js";
import { sumarDias } from "../lib/fechas.js";

/**
 * El mentor: no sólo una agenda. Lo que más vale ahora, lo que otra persona puede hacer, lo de poco valor que quita
 * tiempo, cómo va cada sombrero frente a su prioridad, un consejo con toda tu vida delante y lo que el asistente sabe
 * de ti (el cerebro), que puedes corregir.
 */
export default function Mentor({ estado, hoy, cambiar, onHecha, onAbrir, recargar, servidor, avisar }) {
  const id = useId();
  const { acciones, proyectos, ajustes, cerebro = [] } = estado;
  const sombreros = sombrerosDe(ajustes);
  const ctx = { hoy, proyectos, sombreros };
  const altas = loQueMasVale(acciones, ctx);
  const delegables = porDelegar(acciones);
  const bajas = bajoValor(acciones, ctx);
  const reparto = repartoAbierto(acciones, sombreros);
  const maximo = Math.max(1, ...reparto.map((r) => r.abiertas));
  const [pidiendo, setPidiendo] = useState(false);
  const consejo = ajustes.consejo;

  const conAccion = (aid, fn) => cambiar((e) => ({ ...e, acciones: e.acciones.map((a) => (a.id === aid ? fn(a) : a)) }));
  const delegar = (a) => conAccion(a.id, (x) => ({ ...x, lista: "espera", delegable: null, espera: { persona: a.delegable.a, desde: hoy, preguntar: x.limite && x.limite > hoy ? sumarDias(x.limite, -1) : sumarDias(hoy, 3) } }));

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

  return (
    <>
      <h1 className="titulo-pantalla">Mentor</h1>
      <p className="subtitulo">Qué vale más, qué delegar y qué soltar, con lo que el asistente sabe de tu vida y de tus prioridades.</p>

      <section className="tarjeta consejo" aria-labelledby={`${id}-consejo`}>
        <div className="seccion-cabeza">
          <h2 id={`${id}-consejo`}><Icon name="sparkles" size={14} /> El consejo de la semana</h2>
          {consejo?.fecha && <span className="nota">del {consejo.fecha}</span>}
        </div>
        {consejo?.texto ? <p className="texto-largo">{consejo.texto}</p> : <p className="vacio">Pídele al mentor que mire tu semana: lee tus listas, tus prioridades y lo que sabe de ti, y te dice qué hacer primero, qué delegar y qué soltar.</p>}
        <div className="botones" style={{ marginTop: "var(--sp-3)" }}>
          <button type="button" className="boton primario" onClick={pedirConsejo} disabled={!servidor || pidiendo}>
            <Icon name="sparkles" size={16} /> {pidiendo ? "Pensando…" : consejo?.texto ? "Pedir otro consejo" : "Pedir consejo"}
          </button>
          {!servidor && <span className="vacio">Necesita el servidor.</span>}
        </div>
      </section>

      <div className="rejilla-2 seccion">
        <section aria-labelledby={`${id}-altas`}>
          <div className="seccion-cabeza"><h2 id={`${id}-altas`}>Lo que más vale ahora</h2><span className="nota">Valor alto, por prioridad</span></div>
          {altas.length ? (
            <ul className="lista">{altas.map((a) => <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={proyectos} onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)} />)}</ul>
          ) : <p className="vacio">Nada marcado de valor alto todavía. El asistente lo propone al agendar; tú lo cambias al editar.</p>}
        </section>

        <section aria-labelledby={`${id}-reparto`}>
          <div className="seccion-cabeza"><h2 id={`${id}-reparto`}>Cómo va cada sombrero</h2><span className="nota">Lo abierto frente a su prioridad</span></div>
          <div className="tarjeta">
            {reparto.map((r) => (
              <div key={r.id} className="reparto" style={estiloDe(r.id, sombreros)}>
                <span className="reparto-nombre"><span className="prioridad-num">{r.prioridad}</span> {r.nombre}</span>
                <span className="reparto-barra" aria-hidden="true"><span style={{ width: `${(r.abiertas / maximo) * 100}%` }} /></span>
                <span className="reparto-num">{r.abiertas}{r.altos ? ` · ${r.altos} de valor alto` : ""}</span>
              </div>
            ))}
            {reparto[0] && reparto[0].abiertas === 0 && reparto.some((r) => r.abiertas > 3) && (
              <p className="nota-fuente">«{reparto[0].nombre}» es tu prioridad y no tiene nada abierto. ¿Qué paso concreto le darías esta semana?</p>
            )}
          </div>
        </section>
      </div>

      <div className="rejilla-2 seccion">
        <section aria-labelledby={`${id}-delegar`}>
          <div className="seccion-cabeza"><h2 id={`${id}-delegar`}>Puedes delegar</h2><span className="nota">Otra persona puede hacerlo</span></div>
          {delegables.length ? (
            <ul className="lista">
              {delegables.map((a) => (
                <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={proyectos} onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)}>
                  <div className="botones">
                    <button type="button" className="boton primario" onClick={() => delegar(a)}>Delegar a {a.delegable.a}</button>
                    <button type="button" className="boton fantasma" onClick={() => conAccion(a.id, (x) => ({ ...x, delegable: null }))}>La hago yo</button>
                  </div>
                </Fila>
              ))}
            </ul>
          ) : <p className="vacio">Nada por delegar. Cuando el asistente vea que alguien de tu equipo o de tu célula puede hacer algo, sale aquí.</p>}
        </section>

        <section aria-labelledby={`${id}-bajas`}>
          <div className="seccion-cabeza"><h2 id={`${id}-bajas`}>Valor bajo: ¿vale la pena?</h2><span className="nota">Soltar también es decidir</span></div>
          {bajas.length ? (
            <ul className="lista">
              {bajas.map((a) => (
                <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={proyectos} onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)}>
                  <div className="botones">
                    <button type="button" className="boton" onClick={() => conAccion(a.id, (x) => ({ ...x, estado: "soltada", hechaEl: hoy }))}>Soltar</button>
                    <button type="button" className="boton fantasma" onClick={() => conAccion(a.id, (x) => ({ ...x, lista: "algun-dia", cuando: null }))}>Algún día</button>
                    <button type="button" className="boton fantasma" onClick={() => conAccion(a.id, (x) => ({ ...x, valor: "medio" }))}>Sí vale</button>
                  </div>
                </Fila>
              ))}
            </ul>
          ) : <p className="vacio">Nada de valor bajo abierto.</p>}
        </section>
      </div>

      <Cerebro cerebro={cerebro} sombreros={sombreros} servidor={servidor} recargar={recargar} avisar={avisar} />
    </>
  );
}

/** Lo que el asistente sabe de ti: tu ficha (va siempre), tus notas y lo que aprendió. Todo se corrige o se borra. */
function Cerebro({ cerebro, sombreros, servidor, recargar, avisar }) {
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
