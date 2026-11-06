import { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { useDialogo } from "../hooks/useDialogo.js";
import { crearDictado, unirDictado } from "../lib/dictado.js";
import * as api from "../lib/api.js";

const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const CANAL = { telegram: "Telegram", voz: "Voz", app: "", claude: "Claude" };
const SUGERENCIAS = ["¿Qué tengo mañana?", "¿Qué puedo delegar esta semana?", "Acuérdame el viernes llamar a…", "¿Qué me aconsejas para hoy?"];

const anchoGrande = () => typeof window !== "undefined" && window.matchMedia?.("(min-width: 900px)").matches;

/**
 * El asistente, como en el calendario de marketing: una burbuja que flota en todas las pantallas. Lo que le dices
 * (escribiendo o dictando) se ordena, y te contesta qué hizo con «Deshacer». La conversación es una sola: lo que le
 * dijiste por Telegram o por Claude también sale aquí.
 *
 * No hace esperar: tu mensaje sale al momento, puedes cerrar la burbuja mientras ordena, y la respuesta llega con un
 * aviso si no estabas mirando.
 */
export default function Burbuja({ estado, servidor, recargar, avisar, abierta, setAbierta, onPrototipo }) {
  const [texto, setTexto] = useState("");
  const [provisional, setProvisional] = useState("");
  const [escuchando, setEscuchando] = useState(false);
  const [dictado, setDictado] = useState(false);
  const [error, setError] = useState("");
  const [pendientes, setPendientes] = useState([]);
  const [nuevas, setNuevas] = useState(0);
  const [segundos, setSegundos] = useState(0);
  const dict = useRef(null);
  const lista = useRef(null);
  const entrada = useRef(null);
  const abiertaRef = useRef(abierta);
  const id = useId();
  const [grande, setGrande] = useState(anchoGrande);
  const ref = useDialogo(() => setAbierta(false), { activo: abierta && !grande });

  useEffect(() => {
    abiertaRef.current = abierta;
    if (abierta) setTimeout(() => entrada.current?.focus({ preventScroll: true }), 0);
  }, [abierta]);

  const abrir = () => {
    setNuevas(0);
    setAbierta(true);
  };

  useEffect(() => {
    const m = window.matchMedia?.("(min-width: 900px)");
    const alCambiar = () => setGrande(Boolean(m?.matches));
    m?.addEventListener?.("change", alCambiar);
    return () => m?.removeEventListener?.("change", alCambiar);
  }, []);

  useEffect(() => {
    if (!pendientes.length) return undefined;
    const t = setInterval(() => setSegundos(Math.round((Date.now() - pendientes[0].inicio) / 1000)), 1000);
    return () => clearInterval(t);
  }, [pendientes]);

  const conversacion = estado.conversacion ?? [];
  useEffect(() => {
    lista.current?.scrollTo?.({ top: lista.current.scrollHeight });
  }, [conversacion.length, pendientes.length, abierta]);

  useEffect(() => () => dict.current?.cortar(), []);

  const dictar = () => {
    if (!SR) return;
    if (!dict.current) {
      dict.current = crearDictado({
        SR,
        alFinal: (t) => setTexto((x) => unirDictado(x, t)),
        alProvisional: setProvisional,
        alEstado: setEscuchando,
        alError: setError,
      });
    }
    if (dict.current.escuchando) dict.current.parar();
    else {
      setError("");
      setDictado(true);
      dict.current.empezar();
    }
  };

  const enviar = async (contenido) => {
    const t = unirDictado(contenido ?? texto, contenido ? "" : provisional).trim();
    if (!t) return;
    dict.current?.cortar();
    setTexto("");
    setProvisional("");
    if (!servidor) {
      onPrototipo(t);
      return;
    }
    const canal = dictado ? "voz" : "app";
    setDictado(false);
    const local = { id: `local-${Date.now()}`, texto: t, inicio: Date.now() };
    setPendientes((p) => [...p, local]);
    setSegundos(0);
    try {
      const r = await api.capturar(t, canal);
      await recargar();
      if (!abiertaRef.current) {
        setNuevas((n) => n + 1);
        const linea = r.ok ? (r.resultado?.tarjeta ?? "").split("\n").slice(0, 2).join(" ") : `No pude ordenarlo: ${r.error}`;
        avisar(linea, { accion: "Ver", alPulsar: abrir });
      }
    } catch {
      setError("No hay conexión: tu mensaje no salió. Vuelve a intentarlo.");
      setTexto(t);
    } finally {
      setPendientes((p) => p.filter((x) => x.id !== local.id));
    }
  };

  const deshacer = async (cid) => {
    const r = await api.deshacer(cid);
    if (!r.ok) setError(r.error ?? "No se pudo deshacer.");
    await recargar();
  };

  const reintentar = async (cid) => {
    setPendientes((p) => [...p, { id: `r-${cid}`, texto: "", inicio: Date.now(), reintento: true }]);
    try {
      await api.reordenar(cid);
      await recargar();
    } finally {
      setPendientes((p) => p.filter((x) => x.id !== `r-${cid}`));
    }
  };

  return (
    <>
      {!abierta && (
        <button type="button" className="burbuja-boton" onClick={abrir} aria-label={`Abrir el asistente${nuevas ? `: ${nuevas} respuesta${nuevas === 1 ? "" : "s"} nueva${nuevas === 1 ? "" : "s"}` : ""}`}>
          <Icon name="messageCircle" size={24} />
          <span className="burbuja-etiqueta">Asistente</span>
          {(nuevas > 0 || pendientes.length > 0) && <span className="burbuja-insignia" aria-hidden="true">{pendientes.length ? "…" : nuevas}</span>}
        </button>
      )}
      {abierta && (
        <div className={grande ? "panel-asistente acoplado" : "capa capa-asistente"} onClick={(e) => !grande && e.target === e.currentTarget && setAbierta(false)}>
          <div ref={ref} className="panel-asistente-caja" role={grande ? "complementary" : "dialog"} aria-modal={grande ? undefined : "true"} aria-labelledby={`${id}-t`}>
            <header className="panel-asistente-cabeza">
              <h2 id={`${id}-t`}><Icon name="sparkles" size={18} /> Asistente</h2>
              <button type="button" className="boton fantasma" aria-label="Cerrar el asistente" onClick={() => setAbierta(false)}><Icon name="close" size={18} /></button>
            </header>

            <div className="panel-asistente-mensajes mensajes" ref={lista} aria-live="polite">
              {!conversacion.length && !pendientes.length && (
                <div className="vacio-asistente">
                  <p>Cuéntame lo que tienes en mente, como te salga: una reunión, un recordatorio, una idea, lo que te pidió alguien. O pregúntame qué tienes, qué delegar o qué soltar.</p>
                  <div className="botones">
                    {SUGERENCIAS.map((s) => (
                      <button key={s} type="button" className="chip-boton" onClick={() => (s.endsWith("…") ? setTexto(s.replace("…", " ")) : enviar(s))}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {conversacion.map((c) => (
                <div key={c.id} className="intercambio">
                  <div className="burbuja tu">
                    {CANAL[c.canal] && <div className="etiqueta-canal">{CANAL[c.canal]}</div>}
                    {c.texto}
                  </div>
                  {c.estado === "error" || c.estado === "pendiente" ? (
                    <div className="burbuja agente error">
                      {c.error ? `No pude ordenarlo: ${c.error}` : "Quedó guardado, sin ordenar."}
                      <div className="botones">
                        <button type="button" className="boton" onClick={() => reintentar(c.id)}>Volver a intentarlo</button>
                      </div>
                    </div>
                  ) : c.tarjeta ? (
                    <div className={`burbuja agente${c.deshecha ? " deshecha" : ""}`}>
                      {c.tarjeta}
                      {c.deshecha ? (
                        <div className="etiqueta-canal" style={{ marginTop: "var(--sp-2)" }}>Deshecho</div>
                      ) : c.puedeDeshacer && /^•/m.test(c.tarjeta) ? (
                        <div className="botones">
                          <button type="button" className="boton fantasma" onClick={() => deshacer(c.id)}><Icon name="undo" size={14} /> Deshacer</button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
              {pendientes.map((p) => (
                <div key={p.id} className="intercambio">
                  {!p.reintento && <div className="burbuja tu">{p.texto}</div>}
                  <div className="burbuja agente escribiendo" role="status">
                    <span className="puntos" aria-hidden="true"><span /><span /><span /></span> Ordenando{segundos > 2 ? ` · ${segundos} s` : ""}… puedes cerrar, te aviso.
                  </div>
                </div>
              ))}
            </div>

            {error && <p role="alert" className="aviso rojo" style={{ margin: "0 var(--sp-3)" }}>{error}</p>}
            <form className="panel-asistente-entrada" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
              <label className="solo-lector" htmlFor={`${id}-texto`}>Lo que le dices al asistente</label>
              <div className="caja-texto">
                <textarea
                  id={`${id}-texto`}
                  ref={entrada}
                  className="campo"
                  rows={2}
                  value={texto}
                  placeholder={escuchando ? "Te escucho…" : "Escribe o dicta…"}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviar();
                    }
                  }}
                />
                {provisional && <div className="provisional" aria-hidden="true">{provisional}</div>}
              </div>
              <div className="botones">
                {SR && (
                  <button type="button" className={`boton grande${escuchando ? " escuchando" : ""}`} onClick={dictar} aria-pressed={escuchando} aria-label={escuchando ? "Terminar de dictar" : "Dictar"}>
                    <Icon name={escuchando ? "pause" : "mic"} size={20} />
                  </button>
                )}
                <button type="submit" className="boton grande primario" aria-label="Enviar" disabled={!texto.trim() && !provisional.trim()}>
                  <Icon name="send" size={20} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
