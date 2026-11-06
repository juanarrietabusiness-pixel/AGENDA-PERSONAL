import { useId, useState } from "react";
import * as api from "../lib/api.js";

/**
 * Entrar, o crear la primera cuenta (sólo con el código de alta, que es un secreto del Worker: la aplicación es de UNA
 * persona y nadie más puede darse de alta).
 */
export default function Entrar({ modo, almacen }) {
  const id = useId();
  const alta = modo === "alta";
  const [datos, setDatos] = useState({ nombre: "", email: "", contrasena: "", codigo: "" });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [olvido, setOlvido] = useState(false);
  const campo = (k) => ({ value: datos[k], onChange: (e) => setDatos((d) => ({ ...d, [k]: e.target.value })) });

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError("");
    try {
      const r = alta ? await almacen.darDeAlta(datos) : await almacen.entrar(datos.email, datos.contrasena);
      if (!r.ok) setError(r.error ?? "No se pudo.");
    } catch {
      setError("No hay conexión con el servidor.");
    } finally {
      setEnviando(false);
    }
  };

  if (olvido) return <Olvido onVolver={() => setOlvido(false)} />;

  return (
    <main className="pantalla-entrada">
      <form className="entrada tarjeta" onSubmit={enviar}>
        <h1>{alta ? "Crea tu cuenta" : "Entrar"}</h1>
        <p className="subtitulo">{alta ? "Es la primera vez: esta cuenta será la única de la aplicación." : "Tu agenda personal."}</p>
        {alta && (
          <>
            <label className="etiqueta" htmlFor={`${id}-nombre`}>Cómo te llamo</label>
            <input id={`${id}-nombre`} className="campo" autoComplete="given-name" {...campo("nombre")} />
          </>
        )}
        <label className="etiqueta" htmlFor={`${id}-email`}>Correo</label>
        <input id={`${id}-email`} className="campo" type="email" autoComplete="email" required {...campo("email")} />
        <label className="etiqueta" htmlFor={`${id}-clave`}>Contraseña{alta ? " (10 caracteres o más)" : ""}</label>
        <input id={`${id}-clave`} className="campo" type="password" autoComplete={alta ? "new-password" : "current-password"} required minLength={alta ? 10 : undefined} {...campo("contrasena")} />
        {alta && (
          <>
            <label className="etiqueta" htmlFor={`${id}-codigo`}>Código de alta</label>
            <input id={`${id}-codigo`} className="campo" autoComplete="off" required {...campo("codigo")} />
          </>
        )}
        {error && <p role="alert" className="aviso rojo" style={{ marginTop: "var(--sp-4)" }}>{error}</p>}
        <button type="submit" className="boton grande primario" style={{ width: "100%", marginTop: "var(--sp-5)" }} disabled={enviando}>
          {enviando ? "Un momento…" : alta ? "Crear mi cuenta" : "Entrar"}
        </button>
        {!alta && (
          <button type="button" className="boton fantasma" style={{ width: "100%", marginTop: "var(--sp-2)" }} onClick={() => setOlvido(true)}>
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </form>
    </main>
  );
}

/**
 * ¿Olvidaste tu contraseña? La aplicación no manda correos: el enlace va a tu Telegram (el chat atado a la cuenta), o
 * se pone una nueva con el código de alta (el secreto del Worker, que se puede cambiar en Cloudflare).
 */
function Olvido({ onVolver }) {
  const id = useId();
  const [codigo, setCodigo] = useState("");
  const [nueva, setNueva] = useState("");
  const [otra, setOtra] = useState("");
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const porTelegram = async () => {
    setEnviando(true);
    setAviso(null);
    try {
      const r = await api.recuperarPorTelegram();
      setAviso(r.ok ? { tipo: "verde", texto: r.yaEnviado ? "Ya te mandé un enlace hace un momento: búscalo en tu Telegram." : "Listo: te mandé un enlace a tu Telegram. Vale 15 minutos." } : { tipo: "rojo", texto: r.error ?? "No se pudo." });
    } catch {
      setAviso({ tipo: "rojo", texto: "No hay conexión con el servidor." });
    } finally {
      setEnviando(false);
    }
  };

  const conCodigo = async (e) => {
    e.preventDefault();
    if (nueva !== otra) {
      setAviso({ tipo: "rojo", texto: "Las dos contraseñas no coinciden." });
      return;
    }
    setEnviando(true);
    setAviso(null);
    try {
      const r = await api.recuperarConCodigo(codigo, nueva);
      if (r.ok) window.location.assign("/");
      else setAviso({ tipo: "rojo", texto: r.error ?? "No se pudo." });
    } catch {
      setAviso({ tipo: "rojo", texto: "No hay conexión con el servidor." });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="pantalla-entrada">
      <div className="entrada tarjeta">
        <h1>¿Olvidaste tu contraseña?</h1>
        <p className="subtitulo">Te mando un enlace a tu Telegram para poner una nueva.</p>
        <button type="button" className="boton grande primario" style={{ width: "100%" }} onClick={porTelegram} disabled={enviando}>
          Mandarme el enlace por Telegram
        </button>
        {aviso && <p role={aviso.tipo === "rojo" ? "alert" : "status"} className={`aviso ${aviso.tipo}`} style={{ marginTop: "var(--sp-4)" }}>{aviso.texto}</p>}

        <form onSubmit={conCodigo} style={{ marginTop: "var(--sp-6)", borderTop: "1px solid var(--borde)", paddingTop: "var(--sp-4)" }}>
          <p className="subtitulo" style={{ marginTop: 0 }}>¿Sin Telegram? Con tu código de alta (el que pusiste en Cloudflare al crear la agenda).</p>
          <label className="etiqueta" htmlFor={`${id}-codigo`}>Código de alta</label>
          <input id={`${id}-codigo`} className="campo" autoComplete="off" required value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          <label className="etiqueta" htmlFor={`${id}-nueva`}>Contraseña nueva (10 caracteres o más)</label>
          <input id={`${id}-nueva`} className="campo" type="password" autoComplete="new-password" required minLength={10} value={nueva} onChange={(e) => setNueva(e.target.value)} />
          <label className="etiqueta" htmlFor={`${id}-otra`}>Repítela</label>
          <input id={`${id}-otra`} className="campo" type="password" autoComplete="new-password" required minLength={10} value={otra} onChange={(e) => setOtra(e.target.value)} />
          <button type="submit" className="boton grande" style={{ width: "100%", marginTop: "var(--sp-4)" }} disabled={enviando}>Poner la contraseña nueva</button>
        </form>
        <button type="button" className="boton fantasma" style={{ width: "100%", marginTop: "var(--sp-2)" }} onClick={onVolver}>Volver a entrar</button>
      </div>
    </main>
  );
}
