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
  const guardar = async (c, datos, texto) => {
    const r = await api.googleAjustes(c.cuenta, datos).catch(() => null);
    if (!r?.ok) avisar(r?.error ?? "No se pudo guardar.");
    else if (texto) avisar(texto);
    await recargar();
  };
  const alternar = (c, que, sid) => {
    const lista = c.ajustes?.[que] ?? [];
    return guardar(c, { [que]: lista.includes(sid) ? lista.filter((x) => x !== sid) : [...lista, sid] });
  };
  return (
    <section className="tarjeta seccion" aria-labelledby={`${id}-t`}>
      <div className="seccion-cabeza">
        <h2 id={`${id}-t`}><Icon name="calendar" size={14} /> Google Calendar y Google Tasks</h2>
        <span className="nota">Con una cuenta basta</span>
      </div>
      {!configurado ? (
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--texto-2)" }}>
          Falta configurar Google: pon <strong>GOOGLE_CLIENT_ID</strong> y <strong>GOOGLE_CLIENT_SECRET</strong> como Secret en Cloudflare (los pasos están en DEPLOY.md). Después vuelve aquí y conecta tu cuenta.
        </p>
      ) : (
        <>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--texto-2)" }}>
            Conecta la cuenta que usas a diario. La agenda lee todos los calendarios que ves en ella —también los que otra cuenta te comparte— y lo que agendes aquí se guarda en el calendario que escojas para cada sombrero.
          </p>
          {cuentas.map((c) => <CuentaGoogle key={c.servicio} c={c} sombreros={sombreros} guardar={guardar} alternar={alternar} recargar={recargar} />)}
          <div className="botones" style={{ marginTop: "var(--sp-3)" }}>
            {cuentas.length === 0 && <button type="button" className="boton primario" onClick={() => irA(api.googleConectar, avisar)}><Icon name="plus" size={16} /> Conectar Google</button>}
            {cuentas.length > 0 && (
              <>
                <button type="button" className="boton" disabled={ocupado} onClick={async () => { setOcupado(true); await api.googleSincronizar().catch(() => null); setOcupado(false); await recargar(); avisar("Google al día."); }}>
                  <Icon name="refresh" size={16} /> {ocupado ? "Leyendo…" : "Poner al día ahora"}
                </button>
                <button type="button" className="boton fantasma" onClick={() => irA(api.googleConectar, avisar)}><Icon name="plus" size={16} /> Conectar otra cuenta</button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Una cuenta de Google: qué calendarios se ven, dónde se guarda cada sombrero y qué tareas van a Google Tasks. */
function CuentaGoogle({ c, sombreros, guardar, alternar, recargar }) {
  const cals = c.calendarios ?? [];
  const leer = Array.isArray(c.ajustes?.leer) ? c.ajustes.leer : cals.filter((k) => k.visible).map((k) => k.id);
  const escribibles = cals.filter((k) => k.escribir);
  const principal = cals.find((k) => k.principal);
  const eventosDe = c.ajustes?.eventosDe ?? [];
  const tareasDe = c.ajustes?.tareasDe ?? [];
  const destino = (sid) => {
    const g = c.ajustes?.guardarEn?.[sid];
    return g && escribibles.some((k) => k.id === g) ? g : principal?.id ?? "primary";
  };
  const alternarLeer = (calId) => guardar(c, { leer: leer.includes(calId) ? leer.filter((x) => x !== calId) : [...leer, calId] }, "Listo: lo vuelvo a leer.");
  const ponerEventos = (sid, valor) => {
    if (valor === "") return alternar(c, "eventosDe", sid);
    return guardar(c, { eventosDe: eventosDe.includes(sid) ? eventosDe : [...eventosDe, sid], guardarEn: { [sid]: valor } });
  };
  return (
    <div className="cuenta-google">
      <div className="cuenta-google-cabeza">
        <strong>{c.cuenta}</strong>
        <span className="nota">al día: {cuando(c.sincronizado)}</span>
        <button type="button" className="boton fantasma" onClick={async () => { await api.googleDesconectar(c.cuenta); await recargar(); }}>Desconectar</button>
      </div>
      {c.error && <p className="aviso rojo">{c.error}</p>}

      <div className="fila-ajuste" style={{ gridTemplateColumns: "1fr" }}>
        <span style={{ fontSize: "var(--fs-sm)" }}><strong>Calendarios que se ven en Hoy</strong></span>
        {cals.length ? (
          <div className="filtro-sombreros" role="group" aria-label="Calendarios que se ven en Hoy">
            {cals.map((k) => (
              <button key={k.id} type="button" className="chip-boton" style={k.color ? { "--s": k.color } : undefined} aria-pressed={leer.includes(k.id)} onClick={() => alternarLeer(k.id)}>
                <span className="punto" /> {k.nombre}{k.principal ? " (principal)" : ""}
              </button>
            ))}
          </div>
        ) : (
          <span className="nota">Leyendo tus calendarios… pulsa «Poner al día ahora» si no salen.</span>
        )}
      </div>

      <div className="fila-ajuste" style={{ gridTemplateColumns: "1fr" }}>
        <span style={{ fontSize: "var(--fs-sm)" }}><strong>Dónde se guarda lo que agendas de cada sombrero</strong></span>
        <div className="destinos">
          {sombreros.map((s) => (
            <label key={s.id} className="destino" style={{ "--s": s.color }}>
              <span><span className="punto" /> {s.nombre}</span>
              <select className="campo" value={eventosDe.includes(s.id) ? destino(s.id) : ""} onChange={(e) => ponerEventos(s.id, e.target.value)}>
                <option value="">No guardar en Google</option>
                {(escribibles.length ? escribibles : [{ id: "primary", nombre: "Calendario principal" }]).map((k) => (
                  <option key={k.id} value={k.id}>{k.nombre}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="fila-ajuste" style={{ gridTemplateColumns: "1fr" }}>
        <span style={{ fontSize: "var(--fs-sm)" }}><strong>Tareas que van a Google Tasks</strong> (salen en tu Google Calendar el día que tocan)</span>
        <div className="filtro-sombreros" role="group" aria-label="Tareas que van a Google Tasks">
          {sombreros.filter((s) => s.fuente !== "juancito-ads").map((s) => (
            <button key={s.id} type="button" className="chip-boton" style={estiloDe(s.id, sombreros)} aria-pressed={tareasDe.includes(s.id)} onClick={() => alternar(c, "tareasDe", s.id)}>
              <span className="punto" /> {s.nombre}
            </button>
          ))}
        </div>
        {sombreros.some((s) => s.fuente === "juancito-ads") && <span className="nota">Las tareas de {sombreros.find((s) => s.fuente === "juancito-ads").nombre} van a Juancito Ads; sus reuniones sí van a Google Calendar.</span>}
      </div>
    </div>
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
