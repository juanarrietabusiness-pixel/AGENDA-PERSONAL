import { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { useDialogo } from "../hooks/useDialogo.js";

const Reconocimiento = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/**
 * Capturar: sacarlo de la cabeza en tres segundos. Se guarda TAL CUAL en la Bandeja antes de que nadie lo lea; en la
 * aplicación de verdad, el agente lo aclara y lo deja en su sitio. Aquí (el prototipo) se aclara a mano.
 */
export default function Capturar({ onGuardar, onDeshacer, onCerrar }) {
  const ref = useDialogo(onCerrar);
  const titulo = useId();
  const [texto, setTexto] = useState("");
  const [escuchando, setEscuchando] = useState(false);
  const [dictado, setDictado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const rec = useRef(null);

  useEffect(() => () => rec.current?.stop?.(), []);

  const dictar = () => {
    if (!Reconocimiento) return;
    if (escuchando) {
      rec.current?.stop();
      return;
    }
    const r = new Reconocimiento();
    r.lang = "es-PA";
    r.continuous = true;
    r.interimResults = false;
    setDictado(true);
    r.onresult = (e) => {
      const nuevo = Array.from(e.results).slice(e.resultIndex).filter((x) => x.isFinal).map((x) => x[0].transcript).join(" ");
      if (nuevo) setTexto((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}${nuevo.trim()}`);
    };
    r.onend = () => setEscuchando(false);
    r.onerror = () => setEscuchando(false);
    rec.current = r;
    r.start();
    setEscuchando(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t || enviando) return;
    rec.current?.stop?.();
    setEnviando(true);
    try {
      setResultado(await onGuardar(t, dictado ? "voz" : "app"));
    } catch {
      setResultado({ tarjeta: "No se pudo guardar. Revisa la conexión y vuelve a intentarlo.", error: true });
    } finally {
      setEnviando(false);
    }
  };

  const deshacer = async () => {
    const ok = await onDeshacer(resultado.capturaId);
    setResultado({ tarjeta: ok ? "Deshecho. No quedó nada guardado." : "No se pudo deshacer.", error: !ok });
  };

  const otra = () => {
    setResultado(null);
    setTexto("");
    setDictado(false);
  };

  if (resultado) {
    return (
      <div className="capa" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
        <div ref={ref} className="dialogo" role="dialog" aria-modal="true" aria-labelledby={titulo}>
          <h2 id={titulo}>{resultado.error ? "No quedó ordenado" : "Esto hice"}</h2>
          <p role="status" className="tarjeta-resultado">{resultado.tarjeta}</p>
          <div className="botones" style={{ justifyContent: "flex-end", marginTop: "var(--sp-4)" }}>
            {resultado.capturaId && !resultado.error && (
              <button type="button" className="boton grande fantasma" onClick={deshacer}>
                <Icon name="undo" size={18} /> Deshacer
              </button>
            )}
            <button type="button" className="boton grande" onClick={otra}>Capturar otra</button>
            <button type="button" className="boton grande primario" onClick={onCerrar}>Listo</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="capa" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <form ref={ref} className="dialogo" role="dialog" aria-modal="true" aria-labelledby={titulo} onSubmit={guardar}>
        <h2 id={titulo}>¿Qué tienes en mente?</h2>
        <p className="subtitulo" style={{ margin: 0 }}>Escríbelo o díctalo como te salga. Una reunión, un recordatorio, una idea, lo que te pidió un cliente.</p>
        <label className="solo-lector" htmlFor={`${titulo}-texto`}>Lo que quieres capturar</label>
        <textarea
          id={`${titulo}-texto`}
          className="campo"
          style={{ marginTop: "var(--sp-4)" }}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Agenda una reunión con mi hermano Adolfo de la iglesia el sábado a las 10"
        />
        <p role="status" style={{ color: "var(--texto-3)", fontSize: "var(--fs-xs)" }}>
          {enviando ? "El asistente lo está ordenando…" : escuchando ? "Escuchando… vuelve a pulsar el micrófono para terminar." : ""}
        </p>
        <div className="botones" style={{ justifyContent: "space-between" }}>
          {Reconocimiento ? (
            <button type="button" className="boton grande" onClick={dictar} aria-pressed={escuchando}>
              <Icon name="mic" size={18} /> {escuchando ? "Terminar" : "Dictar"}
            </button>
          ) : <span />}
          <div className="botones">
            <button type="button" className="boton grande fantasma" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="boton grande primario" disabled={!texto.trim() || enviando}>{enviando ? "Ordenando…" : "Guardar"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
