import { useEffect, useId, useState } from "react";
import Icon from "./Icon.jsx";
import * as api from "../lib/api.js";
import { estiloDe } from "../lib/sombreros.js";

const cuando = (iso) => (iso ? new Date(iso).toLocaleString("es-PA", { dateStyle: "short", timeStyle: "short", timeZone: "America/Panama" }) : "nunca");

/** Ajustes → Conexiones: Juancito Ads, Google (una o varias cuentas) y Claude. */
export default function Conexiones({ estado, sombreros, recargar, avisar }) {
  const conexiones = estado.conexiones ?? [];
  const juancito = conexiones.find((c) => c.servicio === "juancito");
  const googles = conexiones.filter((c) => c.servicio.startsWith("google:"));
  return (
    <>
      <Juancito c={juancito} recargar={recargar} avisar={avisar} />
      <Google cuentas={googles} configurado={estado.servicios?.google} sombreros={sombreros} recargar={recargar} avisar={avisar} />
      <Claude avisar={avisar} />
    </>
  );
}

/** Ir a dar un permiso (Juancito Ads o Google): el servidor da la dirección y se vuelve a /?aviso=… */
async function irA(fn, avisar) {
  try {
    const r = await fn();
    if (r.ok && r.url) window.location.assign(r.url);
    else avisar(r.error ?? "No se pudo empezar la conexión.");
  } catch {
    avisar("No hay conexión con el servidor.");
  }
}

function Juancito({ c, recargar, avisar }) {
  const id = useId();
  const conectada = Boolean(c?.conectada);
  const [ocupado, setOcupado] = useState(false);
  const sincronizar = async () => {
    setOcupado(true);
    const r = await api.juancitoSincronizar().catch(() => null);
    setOcupado(false);
    avisar(r?.ok ? `Al día con Juancito Ads${r.cambios ? `: ${r.cambios} cambio${r.cambios === 1 ? "" : "s"}` : ""}.` : r?.motivo ?? r?.error ?? "No se pudo.");
    await recargar();
  };
  return (
    <section className="tarjeta seccion" aria-labelledby={`${id}-t`}>
      <div className="seccion-cabeza">
        <h2 id={`${id}-t`}><Icon name="building" size={14} /> Juancito Ads</h2>
        <span className="nota">Tu trabajo vive allá; se crea, se marca y se ve aquí</span>
      </div>
      {conectada ? (
        <>
          <p style={{ fontSize: "var(--fs-sm)" }}>
            <Icon name="checkCircle" size={16} /> Conectado. Lo que agendes en el sombrero de Juancito Ads se crea allá al momento, y lo que marques hecho allá se marca aquí. Última vez al día: {cuando(c.sincronizado)}.
          </p>
          {c.error && <p className="aviso rojo">{c.error}</p>}
          <label className="casilla">
            <input type="checkbox" checked={Boolean(c.ajustes?.todas)} onChange={async (e) => { await api.juancitoAjustes({ todas: e.target.checked }); await recargar(); }} />
            Traer TODAS las tareas de la agencia (si no, sólo las tuyas y las que no tienen a nadie asignado)
          </label>
          <div className="botones" style={{ marginTop: "var(--sp-3)" }}>
            <button type="button" className="boton" onClick={sincronizar} disabled={ocupado}><Icon name="refresh" size={16} /> {ocupado ? "Leyendo…" : "Poner al día ahora"}</button>
            <button type="button" className="boton fantasma" onClick={async () => { await api.juancitoDesconectar(); await recargar(); }}>Desconectar</button>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--texto-2)" }}>
            La agenda se conecta como lo hace Claude: Juancito Ads te pregunta si la dejas entrar (con tu sesión de allá) y listo. No hay llaves que crear.
          </p>
          {c?.error && <p className="aviso rojo">{c.error}</p>}
          <button type="button" className="boton primario" onClick={() => irA(api.juancitoConectar, avisar)}><Icon name="plug" size={16} /> Conectar Juancito Ads</button>
        </>
      )}
    </section>
  );
}

function Google({ cuentas, configurado, sombreros, recargar, avisar }) {
  const id = useId();
  const [ocupado, setOcupado] = useState(false);
  const alternar = async (c, que, sid) => {
    const lista = c.ajustes?.[que] ?? [];
    const nueva = lista.includes(sid) ? lista.filter((x) => x !== sid) : [...lista, sid];
    await api.googleAjustes(c.cuenta, { [que]: nueva });
    await recargar();
  };
  return (
    <section className="tarjeta seccion" aria-labelledby={`${id}-t`}>
      <div className="seccion-cabeza">
        <h2 id={`${id}-t`}><Icon name="calendar" size={14} /> Google Calendar y Google Tasks</h2>
        <span className="nota">Tus dos cuentas en un solo sitio</span>
      </div>
      {!configurado ? (
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--texto-2)" }}>
          Falta configurar Google: pon <strong>GOOGLE_CLIENT_ID</strong> y <strong>GOOGLE_CLIENT_SECRET</strong> como Secret en Cloudflare (los pasos están en DEPLOY.md). Después vuelve aquí y conecta tus cuentas.
        </p>
      ) : (
        <>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--texto-2)" }}>
            Conecta la personal y la de la agencia: sus eventos salen en «Hoy». Escoge qué sombreros llevan sus eventos y sus tareas a cada cuenta: lo que se agende ahí se crea allá, y lo que marques hecho allá se marca aquí.
          </p>
          {cuentas.map((c) => (
            <div key={c.servicio} className="cuenta-google">
              <div className="cuenta-google-cabeza">
                <strong>{c.cuenta}</strong>
                <span className="nota">al día: {cuando(c.sincronizado)}</span>
                <button type="button" className="boton fantasma" onClick={async () => { await api.googleDesconectar(c.cuenta); await recargar(); }}>Desconectar</button>
              </div>
              {c.error && <p className="aviso rojo">{c.error}</p>}
              {[["eventosDe", "Sus eventos van a esta cuenta"], ["tareasDe", "Sus tareas van a Google Tasks de esta cuenta"]].map(([que, texto]) => (
                <div key={que} className="fila-ajuste" style={{ gridTemplateColumns: "1fr" }}>
                  <span style={{ fontSize: "var(--fs-sm)" }}>{texto}</span>
                  <div className="filtro-sombreros" role="group" aria-label={texto}>
                    {sombreros.filter((s) => que === "eventosDe" || s.fuente !== "juancito-ads").map((s) => (
                      <button key={s.id} type="button" className="chip-boton" style={estiloDe(s.id, sombreros)} aria-pressed={(c.ajustes?.[que] ?? []).includes(s.id)} onClick={() => alternar(c, que, s.id)}>
                        <span className="punto" /> {s.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div className="botones" style={{ marginTop: "var(--sp-3)" }}>
            <button type="button" className="boton primario" onClick={() => irA(api.googleConectar, avisar)}><Icon name="plus" size={16} /> {cuentas.length ? "Conectar otra cuenta" : "Conectar Google"}</button>
            {cuentas.length > 0 && (
              <button type="button" className="boton" disabled={ocupado} onClick={async () => { setOcupado(true); await api.googleSincronizar().catch(() => null); setOcupado(false); await recargar(); avisar("Google al día."); }}>
                <Icon name="refresh" size={16} /> {ocupado ? "Leyendo…" : "Poner al día ahora"}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Claude({ avisar }) {
  const id = useId();
  const [conexiones, setConexiones] = useState(null);
  const [vuelta, setVuelta] = useState(0);
  const url = typeof window !== "undefined" ? `${window.location.origin}/mcp` : "/mcp";
  useEffect(() => {
    let vivo = true;
    api.mcpConexiones().then((r) => vivo && setConexiones(r.conexiones ?? [])).catch(() => vivo && setConexiones([]));
    return () => {
      vivo = false;
    };
  }, [vuelta]);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      avisar("Dirección copiada.");
    } catch {
      avisar(url);
    }
  };
  return (
    <section className="tarjeta seccion" aria-labelledby={`${id}-t`}>
      <div className="seccion-cabeza">
        <h2 id={`${id}-t`}><Icon name="sparkles" size={14} /> Claude</h2>
        <span className="nota">Agendar y preguntar desde Claude</span>
      </div>
      <p style={{ fontSize: "var(--fs-sm)", color: "var(--texto-2)" }}>
        En claude.ai: <strong>Ajustes → Conectores → Añadir conector personalizado</strong>, pega esta dirección y entra con tu cuenta de la agenda cuando te lo pida. Después, en cualquier chat: «agéndame la reunión con Adolfo el sábado a las 10».
      </p>
      <div className="botones" style={{ alignItems: "center" }}>
        <code className="codigo">{url}</code>
        <button type="button" className="boton" onClick={copiar}><Icon name="copy" size={16} /> Copiar</button>
      </div>
      {conexiones?.length > 0 && (
        <>
          <p style={{ fontSize: "var(--fs-sm)", marginTop: "var(--sp-3)" }}>
            <Icon name="checkCircle" size={16} /> Conectado: {conexiones.map((c) => c.nombre || "Claude").join(", ")}. Último uso: {cuando(conexiones[0].usado ?? conexiones[0].creado)}.
          </p>
          <button type="button" className="boton fantasma" onClick={async () => { await api.mcpDesconectar(); setVuelta((v) => v + 1); }}>Desconectar Claude</button>
        </>
      )}
    </section>
  );
}
