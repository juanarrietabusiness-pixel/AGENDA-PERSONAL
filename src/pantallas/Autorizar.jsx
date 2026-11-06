import { useEffect, useState } from "react";
import Icon from "../componentes/Icon.jsx";
import * as api from "../lib/api.js";

/**
 * El permiso de Claude (/autorizar, el «authorization_endpoint» del MCP). Se ve ya dentro de la cuenta: si no hay
 * sesión, primero sale la pantalla de entrar. Al permitir, vuelve a Claude con un código de un solo uso.
 */
export default function Autorizar() {
  const q = new URLSearchParams(window.location.search);
  const datos = {
    client_id: q.get("client_id") ?? "",
    redirect_uri: q.get("redirect_uri") ?? "",
    code_challenge: q.get("code_challenge") ?? "",
    code_challenge_method: q.get("code_challenge_method") ?? "",
    state: q.get("state") ?? "",
  };
  const [cliente, setCliente] = useState(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.mcpCliente(datos.client_id, datos.redirect_uri)
      .then((r) => (r.ok ? setCliente(r) : setError(r.error ?? "Esa aplicación no está registrada.")))
      .catch(() => setError("No hay conexión con el servidor."));
    // Sólo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const permitir = async () => {
    setEnviando(true);
    const r = await api.mcpAutorizar(datos).catch(() => null);
    if (r?.ok && r.redireccion) window.location.assign(r.redireccion);
    else {
      setError(r?.error ?? "No se pudo dar el permiso.");
      setEnviando(false);
    }
  };

  const cancelar = () => {
    try {
      const u = new URL(datos.redirect_uri);
      u.searchParams.set("error", "access_denied");
      if (datos.state) u.searchParams.set("state", datos.state);
      window.location.assign(u.toString());
    } catch {
      window.location.assign("/");
    }
  };

  return (
    <main className="pantalla-entrada">
      <div className="entrada tarjeta">
        <h1><Icon name="sparkles" size={24} /> Conectar con tu agenda</h1>
        {error && <p role="alert" className="aviso rojo">{error}</p>}
        {!error && !cliente && <p role="status">Comprobando…</p>}
        {cliente && (
          <>
            <p><strong>{cliente.nombre}</strong> ({cliente.vuelta}) quiere conectarse a tu agenda personal.</p>
            <p className="subtitulo">Podrá ver tus tareas, recordatorios, reuniones y proyectos, agendar y cambiar cosas a través de tu asistente, y marcar tareas hechas. Lo desconectas cuando quieras en Ajustes → Claude.</p>
            <div className="botones" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="boton grande fantasma" onClick={cancelar}>No</button>
              <button type="button" className="boton grande primario" onClick={permitir} disabled={enviando}>{enviando ? "Un momento…" : "Permitir"}</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
