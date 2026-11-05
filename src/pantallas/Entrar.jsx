import { useId, useState } from "react";

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
      </form>
    </main>
  );
}
