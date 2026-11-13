import { useEffect, useId, useState } from "react";
import Icon from "./Icon.jsx";
import * as api from "../lib/api.js";
import { estiloDe, nombreDe, sombreroDeLista } from "../lib/sombreros.js";

const cuando = (iso) => (iso ? new Date(iso).toLocaleString("es-PA", { dateStyle: "short", timeStyle: "short", timeZone: "America/Panama" }) : "nunca");

/** Ajustes → Conexiones: Juancito Ads, Google (una o varias cuentas) y Claude. */
export default function Conexiones({ estado, cambiar, sombreros, recargar, avisar }) {
  const conexiones = estado.conexiones ?? [];
  const juancito = conexiones.find((c) => c.servicio === "juancito");
  const googles = conexiones.filter((c) => c.servicio.startsWith("google:"));
  return (
    <>
      <Juancito c={juancito} recargar={recargar} avisar={avisar} />
      <Google cuentas={googles} configurado={estado.servicios?.google} sombreros={sombreros} recargar={recargar} avisar={avisar} />
      {estado.servicios?.google && googles.length > 0 && cambiar && <KairosPrincipal cuentas={googles} cambiar={cambiar} recargar={recargar} avisar={avisar} />}
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

/**
 * Kairos como principal y Google como copia, en tres pasos: (1) guardar en Kairos lo que hoy viene de Google, tal cual
 * se ve; (2) Juan borra en Google con calma (lo que borre allá no se borra aquí); (3) copiar todo a Google. Después,
 * los dos sentidos: lo que cambia en Google vuelve a Kairos.
 */
function KairosPrincipal({ cuentas, cambiar, recargar, avisar }) {
  const id = useId();
  // Lo que acaba de pasar aquí manda hasta que el servidor lo confirme (la relectura espera a que se guarde todo).
  const [ya, setYa] = useState(null);
  const momento = ya ?? cuentas.find((c) => c.principal)?.principal ?? null;
  const [plan, setPlan] = useState(null);
  const [ocupado, setOcupado] = useState("");
  const [progreso, setProgreso] = useState(null);

  const traer = async () => {
    setOcupado("traer");
    const r = await api.googleTraer().catch(() => null);
    setOcupado("");
    if (!r?.ok) return avisar(r?.error ?? "No pude leer Google.");
    setPlan(r);
  };
  const guardar = async () => {
    const n = plan.ritmo.length + plan.eventos.length;
    cambiar((e) => ({
      ...e,
      ritmo: [...(e.ritmo ?? []), ...plan.ritmo.filter((x) => !(e.ritmo ?? []).some((y) => y.google === x.google))],
      eventos: [...e.eventos, ...plan.eventos.filter((x) => !e.eventos.some((y) => y.google?.id === x.google.id))],
    }));
    setPlan(null);
    const r = await api.googlePrincipal("traspaso").catch(() => null);
    if (!r?.ok) return avisar(r?.error ?? "Se guardó en Kairos, pero no pude pasar al paso 2. Vuelve a intentarlo.");
    setYa("traspaso");
    avisar(n ? `Listo: ${n} cosa${n === 1 ? "" : "s"} de Google ahora viven en Kairos. Sigue con el paso 2.` : "Ya estaba todo en Kairos. Sigue con el paso 2.");
    await recargar();
  };
  const copiar = async () => {
    setOcupado("copiar");
    let desde = 0;
    let creados = 0;
    for (let vuelta = 0; vuelta < 200; vuelta++) {
      const r = await api.googleCopiar(desde).catch(() => null);
      if (!r?.ok) {
        avisar(r?.error ?? "No pude copiar a Google. Vuelve a intentarlo: sigue donde se quedó.");
        break;
      }
      creados += r.creados ?? 0;
      desde = r.siguiente;
      setProgreso({ hechos: r.siguiente, total: r.total });
      if (!r.quedan) {
        setYa("dos");
        avisar(`Listo: Google quedó como copia de Kairos${creados ? ` (${creados} creada${creados === 1 ? "" : "s"} allá)` : ""}. Ya van en los dos sentidos.`);
        break;
      }
    }
    setOcupado("");
    setProgreso(null);
    await recargar();
  };

  return (
    <section className="tarjeta seccion kairos-principal" aria-labelledby={`${id}-t`}>
      <div className="seccion-cabeza">
        <h2 id={`${id}-t`}><Icon name="star" size={14} /> Kairos como principal</h2>
        <span className="nota">{momento === "dos" ? "Listo" : momento === "traspaso" ? "Paso 2 de 3" : "Paso 1 de 3"}</span>
      </div>

      {momento === "dos" ? (
        <>
          <p className="kp-texto">
            Kairos es tu calendario oficial y Google es su copia. Lo que cambias aquí va a Google al momento; lo que cambias o borras en Google vuelve a Kairos en unos 2 minutos, y lo que creas tú allá sin invitados pasa a Kairos. Tu rutina (la semana tipo) se cambia sólo aquí. Las invitaciones de otras personas siguen llegando por Google.
          </p>
          <div className="botones">
            <button type="button" className="boton fantasma" disabled={Boolean(ocupado)} onClick={copiar}>
              <Icon name="refresh" size={16} /> {ocupado === "copiar" ? (progreso ? `Revisando… ${progreso.hechos} de ${progreso.total}` : "Revisando…") : "Copiar todo a Google otra vez"}
            </button>
          </div>
        </>
      ) : momento === "traspaso" ? (
        <ol className="kp-pasos">
          <li className="hecho"><strong>Guardado en Kairos.</strong> Lo que venía de Google ya vive aquí.</li>
          <li>
            <strong>Borra en Google con calma</strong> tus eventos y lo que se repite. Mientras tanto, lo que borres allá <em>no</em> se borra aquí.
            <span className="kp-ojo">No borres: las invitaciones de otras personas, los calendarios que otros te comparten ni el calendario «Kairos · Bloques».</span>
          </li>
          <li>
            <strong>Cuando termines,</strong> copia todo a Google: tu rutina va a «Kairos · Bloques», tus eventos al calendario de su sombrero y tus tareas a Google Tasks.
            <div className="botones">
              <button type="button" className="boton primario" disabled={Boolean(ocupado)} onClick={copiar}>
                <Icon name="refresh" size={16} /> {ocupado === "copiar" ? (progreso ? `Copiando… ${progreso.hechos} de ${progreso.total}` : "Copiando…") : "Copiar todo a Google"}
              </button>
            </div>
          </li>
        </ol>
      ) : plan ? (
        <div className="kp-plan" role="status">
          <p className="kp-texto">
            {plan.ritmo.length + plan.eventos.length === 0 ? (
              "Todo lo tuyo ya está en Kairos."
            ) : (
              <>
                Pasan a Kairos, tal cual se ven: <strong>{plan.ritmo.length}</strong> de tu rutina (a tu semana tipo, en gris) y <strong>{plan.eventos.length}</strong> evento{plan.eventos.length === 1 ? "" : "s"} tuyo{plan.eventos.length === 1 ? "" : "s"}.
              </>
            )}{" "}
            Se quedan en Google: {plan.fuera.conGente} con otras personas, {plan.fuera.ajenos} de calendarios de otros
            {plan.fuera.otros ? ` y ${plan.fuera.otros} especiales de Google (cumpleaños de contactos, fuera de la oficina…)` : ""}.
          </p>
          {plan.ritmo.length + plan.eventos.length > 0 && (
            <details className="kp-lista">
              <summary>Ver la lista</summary>
              <ul>
                {plan.ritmo.map((x) => <li key={x.id}><Icon name="refresh" size={12} /> {x.titulo} <small>cada semana, {x.inicio}</small></li>)}
                {plan.eventos.map((x) => <li key={x.id}><Icon name={x.clase === "especial" ? "star" : "calendar"} size={12} /> {x.titulo} <small>{x.fecha ?? "se repite"}{x.inicio && x.inicio !== "00:00" ? `, ${x.inicio}` : ""}</small></li>)}
              </ul>
            </details>
          )}
          {plan.fallos?.length > 0 && <p className="nota">No pude leer: {plan.fallos.join("; ")}</p>}
          <div className="botones">
            <button type="button" className="boton primario" onClick={guardar}>{plan.ritmo.length + plan.eventos.length ? "Guardarlos en Kairos" : "Seguir al paso 2"}</button>
            <button type="button" className="boton fantasma" onClick={() => setPlan(null)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          <p className="kp-texto">
            Para que Kairos sea tu calendario oficial y Google su copia: primero guarda en Kairos lo que hoy ves y viene de Google (de aquí a un año), tal cual se ve. Lo que es con otras personas y los calendarios de otros se quedan en Google. No se borra nada.
          </p>
          <div className="botones">
            <button type="button" className="boton primario" disabled={Boolean(ocupado)} onClick={traer}>
              <Icon name="download" size={16} /> {ocupado === "traer" ? "Leyendo un año de Google…" : "Guardar en Kairos lo que viene de Google"}
            </button>
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

      {(c.listasTareas ?? []).length > 0 && (
        <div className="fila-ajuste" style={{ gridTemplateColumns: "1fr" }}>
          <span style={{ fontSize: "var(--fs-sm)" }}><strong>Qué sombrero es cada lista de Google Tasks</strong> (lo que escribas en una lista entra en ese sombrero, y al revés)</span>
          <div className="destinos">
            {c.listasTareas.map((l) => {
              const fijado = c.ajustes?.listas?.[l.id] ?? "";
              const auto = sombreroDeLista(l, sombreros, {});
              return (
                <label key={l.id} className="destino" style={estiloDe(fijado && fijado !== "no" ? fijado : auto, sombreros)}>
                  <span><span className="punto" /> {l.nombre || "Mis tareas"}</span>
                  <select className="campo" value={fijado} onChange={(e) => guardar(c, { listas: { [l.id]: e.target.value } }, "Listo: la vuelvo a leer.")}>
                    <option value="">{auto ? `Por el nombre: ${nombreDe(auto, sombreros)}` : "Sin sombrero (lo pone la IA)"}</option>
                    {sombreros.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    <option value="no">No traer esta lista</option>
                  </select>
                </label>
              );
            })}
          </div>
        </div>
      )}
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
