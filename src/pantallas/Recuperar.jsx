import { useId, useState } from "react";
import * as api from "../lib/api.js";

/**
 * Lo que abre el enlace que llega por Telegram (/recuperar?t=…): poner una contraseña nueva. El enlace sirve una vez y
 * vale 15 minutos; al cambiarla se cierran todas las sesiones y se entra con la nueva.
 */
export default function Recuperar({ servidor }) {
  const id = useId();
  const token = new URLSearchParams(window.location.search).get("t") ?? "";
  const [nueva, setNueva] = useState("");
  const [otra, setOtra] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    if (nueva !== otra) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    setEnviando(true);
    setError("");
    try {
      const r = await api.recuperarConEnlace(token, nueva);
      if (r.ok) window.location.replace("/");
      else setError(r.error ?? "No se pudo.");
    } catch {
      setError("No hay conexión con el servidor.");
    } finally {
      setEnviando(false);
    }
  };

  if (!servidor) return <main className="pantalla-entrada"><p>Para cambiar la contraseña hace falta el servidor.</p></main>;

  return (
    <main className="pantalla-entrada">
      <form className="entrada tarjeta" onSubmit={enviar}>
        <h1>Contraseña nueva</h1>
        <p className="subtitulo">Al guardarla se cierran las sesiones abiertas en tus otros aparatos y entras con la nueva.</p>
        <label className="etiqueta" htmlFor={`${id}-nueva`}>Contraseña nueva (10 caracteres o más)</label>
        <input id={`${id}-nueva`} className="campo" type="password" autoComplete="new-password" required minLength={10} value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <label className="etiqueta" htmlFor={`${id}-otra`}>Repítela</label>
        <input id={`${id}-otra`} className="campo" type="password" autoComplete="new-password" required minLength={10} value={otra} onChange={(e) => setOtra(e.target.value)} />
        {error && <p role="alert" className="aviso rojo" style={{ marginTop: "var(--sp-4)" }}>{error}</p>}
        <button type="submit" className="boton grande primario" style={{ width: "100%", marginTop: "var(--sp-5)" }} disabled={enviando || !token}>
          {enviando ? "Un momento…" : "Guardar y entrar"}
        </button>
        {!token && <p className="aviso rojo" style={{ marginTop: "var(--sp-4)" }}>A este enlace le falta su código. Pide otro desde «¿Olvidaste tu contraseña?».</p>}
      </form>
    </main>
  );
}
