import { useEffect, useId, useState } from "react";
import Icon from "./Icon.jsx";
import * as api from "../lib/api.js";

/**
 * Ajustes → Telegram: conectar el bot con tu chat. El enlace sirve UNA vez y caduca en 15 minutos; abrirlo en el
 * teléfono y pulsar «Iniciar» ata ese chat a tu cuenta. El bot no le contesta a nadie más.
 */
export default function Telegram() {
  const id = useId();
  const [info, setInfo] = useState(null);
  const [enlace, setEnlace] = useState(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    let vivo = true;
    api
      .telegram()
      .then((r) => vivo && (r.ok ? setInfo(r) : setError(r.error ?? "No se pudo leer.")))
      .catch(() => vivo && setError("No hay conexión con el servidor."));
    return () => {
      vivo = false;
    };
  }, [vuelta]);

  const releer = () => {
    setError("");
    setVuelta((v) => v + 1);
  };

  const accion = async (fn) => {
    setOcupado(true);
    setError("");
    try {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "No se pudo.");
      return r;
    } catch {
      setError("No hay conexión con el servidor.");
      return null;
    } finally {
      setOcupado(false);
    }
  };

  const conectar = async () => {
    const r = await accion(api.conectarTelegram);
    if (r?.ok) setEnlace(r.enlace);
  };

  const desconectar = async () => {
    const r = await accion(api.desconectarTelegram);
    if (r?.ok) {
      setEnlace(null);
      releer();
    }
  };

  return (
    <section className="tarjeta seccion" aria-labelledby={`${id}-t`}>
      <div className="seccion-cabeza">
        <h2 id={`${id}-t`}>Telegram</h2>
        <span className="nota">Captura desde el teléfono, escribiendo o con notas de voz</span>
      </div>
      {!info && !error && <p role="status">Mirando…</p>}
      {info && !info.configurado && (
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--texto-2)" }}>
          Falta el token del bot. Ponlo en Cloudflare (agenda-personal → Settings → Variables and Secrets) como Secret{" "}
          <strong>TELEGRAM_BOT_TOKEN</strong> y vuelve a esta pantalla.
        </p>
      )}
      {info?.configurado && info.vinculado && (
        <>
          <p style={{ fontSize: "var(--fs-sm)" }}>
            <Icon name="checkCircle" size={16} /> Conectado{info.nombre ? ` con ${info.nombre}` : ""}. Escríbele al bot o mándale una nota de voz: lo
            ordena igual que aquí, y te contesta qué hizo.
          </p>
          <div className="botones">
            <button type="button" className="boton" onClick={desconectar} disabled={ocupado}>Desconectar</button>
          </div>
        </>
      )}
      {info?.configurado && !info.vinculado && !enlace && (
        <>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--texto-2)" }}>El bot está listo. Conéctalo con tu chat de Telegram.</p>
          <div className="botones">
            <button type="button" className="boton primario" onClick={conectar} disabled={ocupado}>
              <Icon name="send" size={16} /> {ocupado ? "Un momento…" : "Conectar Telegram"}
            </button>
          </div>
        </>
      )}
      {info?.configurado && !info.vinculado && enlace && (
        <>
          <p style={{ fontSize: "var(--fs-sm)" }}>
            Abre el enlace en el teléfono donde tienes Telegram y pulsa <strong>Iniciar</strong>. Sirve una vez y vale 15 minutos.
          </p>
          <div className="botones">
            <a className="boton primario" href={enlace} target="_blank" rel="noopener noreferrer">
              <Icon name="external" size={16} /> Abrir Telegram
            </a>
            <button type="button" className="boton" onClick={releer}>Ya lo hice</button>
          </div>
        </>
      )}
      {error && <p role="alert" className="aviso rojo" style={{ marginTop: "var(--sp-3)" }}>{error}</p>}
    </section>
  );
}
