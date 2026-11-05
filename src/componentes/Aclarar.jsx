import { useId, useState } from "react";
import { useDialogo } from "../hooks/useDialogo.js";
import { PREGUNTAS_ACLARAR, aclarar, listaDeDestino, nuevaAccion } from "../lib/metodo.js";
import { SOMBREROS } from "../lib/sombreros.js";
import { sumarDias } from "../lib/fechas.js";

const SI_NO = [
  { valor: true, texto: "Sí" },
  { valor: false, texto: "No" },
];
const OPCIONES = {
  noAccionable: [
    { valor: "referencia", texto: "Información para guardar" },
    { valor: "algun-dia", texto: "Algo para algún día" },
    { valor: "basura", texto: "Nada: borrarlo" },
  ],
  minutos: [
    { valor: 2, texto: "Menos de 2 minutos" },
    { valor: 15, texto: "Unos 15 minutos" },
    { valor: 30, texto: "Media hora" },
    { valor: 60, texto: "Una hora o más" },
  ],
};

const DESTINOS = {
  basura: "Se borra.",
  referencia: "Se guarda como referencia, sin avisos.",
  "algun-dia": "Va a «Algún día»: sale en la revisión semanal.",
  "hazla-ya": "Cuesta menos de dos minutos: hazla ahora y márcala hecha.",
  espera: "Va a «En espera»: te recordaré preguntar.",
  calendario: "Tiene día u hora fija: va a tu agenda.",
  siguientes: "Va a tus siguientes acciones.",
};

/**
 * Aclarar a mano una captura, con las preguntas de GTD. Es lo que hará el agente solo; aquí sirve cuando la IA falla, y
 * en el prototipo, para ver el método.
 */
export default function Aclarar({ captura, hoy, onListo, onCerrar }) {
  const ref = useDialogo(onCerrar);
  const id = useId();
  const [r, setR] = useState({});
  const [titulo, setTitulo] = useState(captura.texto);
  const [sombreroId, setSombrero] = useState("personal");
  const [cuando, setCuando] = useState(hoy);
  const [persona, setPersona] = useState("");

  const pendiente = PREGUNTAS_ACLARAR.find((p) => (!p.si || p.si(r)) && r[p.id] === undefined);
  const resultado = pendiente ? null : aclarar(r);

  const terminar = () => {
    if (resultado.destino === "basura") return onListo(null);
    const lista = listaDeDestino(resultado.destino);
    const accion = nuevaAccion(
      {
        titulo,
        sombrero: sombreroId,
        lista,
        cuando: ["siguientes", "calendario", "hazla-ya"].includes(resultado.destino) ? cuando : null,
        minutos: Math.max(5, Number(r.minutos) || 30),
        espera: resultado.destino === "espera" ? { persona: persona || "alguien", desde: hoy, preguntar: sumarDias(hoy, 3) } : null,
        estado: resultado.destino === "hazla-ya" ? "hecha" : "abierta",
        hechaEl: resultado.destino === "hazla-ya" ? hoy : null,
        origen: captura.canal,
      },
      hoy,
    );
    onListo(accion);
  };

  return (
    <div className="capa" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div ref={ref} className="dialogo" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`}>
        <h2 id={`${id}-t`}>Aclarar</h2>
        <p className="subtitulo">«{captura.texto}»</p>

        {pendiente ? (
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="etiqueta" style={{ fontSize: "var(--fs-md)", color: "var(--texto)" }}>{pendiente.texto}</legend>
            <div className="botones">
              {(OPCIONES[pendiente.id] ?? SI_NO).map((o) => (
                <button key={String(o.valor)} type="button" className="boton grande" onClick={() => setR((x) => ({ ...x, [pendiente.id]: o.valor }))}>
                  {o.texto}
                </button>
              ))}
            </div>
          </fieldset>
        ) : (
          <>
            <p className="aviso" role="status">{DESTINOS[resultado.destino]}{resultado.proyecto ? " Y como necesita varios pasos, es un proyecto: anota sólo el siguiente." : ""}</p>
            {resultado.destino !== "basura" && (
              <>
                <label className="etiqueta" htmlFor={`${id}-titulo`}>Como acción (empieza con un verbo)</label>
                <input id={`${id}-titulo`} className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                <label className="etiqueta" htmlFor={`${id}-s`}>Sombrero</label>
                <select id={`${id}-s`} className="campo" value={sombreroId} onChange={(e) => setSombrero(e.target.value)}>
                  {SOMBREROS.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
                {resultado.destino === "espera" ? (
                  <>
                    <label className="etiqueta" htmlFor={`${id}-p`}>¿De quién lo esperas?</label>
                    <input id={`${id}-p`} className="campo" value={persona} onChange={(e) => setPersona(e.target.value)} />
                  </>
                ) : ["siguientes", "calendario"].includes(resultado.destino) && (
                  <>
                    <label className="etiqueta" htmlFor={`${id}-c`}>¿Qué día la haces?</label>
                    <input id={`${id}-c`} className="campo" type="date" value={cuando} onChange={(e) => setCuando(e.target.value)} />
                  </>
                )}
              </>
            )}
          </>
        )}

        <div className="botones" style={{ marginTop: "var(--sp-5)", justifyContent: "flex-end" }}>
          {Object.keys(r).length > 0 && <button type="button" className="boton fantasma grande" onClick={() => setR({})}>Empezar otra vez</button>}
          <button type="button" className="boton fantasma grande" onClick={onCerrar}>Cancelar</button>
          {resultado && <button type="button" className="boton primario grande" onClick={terminar} disabled={resultado.destino !== "basura" && !titulo.trim()}>Listo</button>}
        </div>
      </div>
    </div>
  );
}
