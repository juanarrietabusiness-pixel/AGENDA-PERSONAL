import { useId, useState } from "react";
import * as api from "../lib/api.js";
import Icon from "../componentes/Icon.jsx";
import { TEMAS, OTROS_NOMBRES } from "../lib/temas.js";
import { MODELOS, FUNCIONES, PROVEEDORES, modeloEscogido, advertencias, costo } from "../lib/ia.js";
import { FUERA_DE_CONTEXTO, ATRIBUCION } from "../lib/versiculos.js";
import Telegram from "../componentes/Telegram.jsx";
import Conexiones from "../componentes/Conexiones.jsx";
import { PARTES_SEGUIMIENTO, seguimientoDe, DIAS_BORRAR, diasParaBorrar } from "../lib/ajustes.js";
import { sombrerosDe } from "../lib/sombreros.js";
import { DIAS } from "../lib/fechas.js";

const FRECUENCIAS = [
  { id: "normal", texto: "Normal" },
  { id: "poco", texto: "Poco" },
  { id: "nunca", texto: "Nunca" },
];

const mensual = (m) => 900 * costo(m, { entrada: 6000, salida: 1000 });

export default function Ajustes({ estado, cambiar, reiniciar, salir, servidor = false, recargar, avisar }) {
  const id = useId();
  const { ajustes } = estado;
  const ia = ajustes.ia;
  const poner = (fn) => cambiar((e) => ({ ...e, ajustes: fn(e.ajustes) }));
  const avisos = advertencias(ia);

  return (
    <>
      <h1 className="titulo-pantalla">Ajustes</h1>
      <p className="subtitulo">Todo se puede cambiar después.</p>

      <section className="tarjeta" aria-labelledby={`${id}-tema`}>
        <div className="seccion-cabeza"><h2 id={`${id}-tema`}>Nombre y color (pruébalos)</h2></div>
        <div className="opciones-tema">
          {TEMAS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="opcion-tema"
              aria-pressed={ajustes.tema === t.id}
              style={{ "--t": t.acento }}
              onClick={() => poner((a) => ({ ...a, tema: t.id }))}
            >
              <span className="muestra" aria-hidden="true" />
              <span>
                <strong>{t.nombre}</strong>
                <span>{t.idea}</span>
              </span>
            </button>
          ))}
        </div>
        <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--fs-xs)", color: "var(--texto-3)" }}>Otros nombres posibles: {OTROS_NOMBRES.join(", ")}.</p>
      </section>

      {servidor && <Seguimiento ajustes={ajustes} poner={poner} />}

      <section className="tarjeta seccion" aria-labelledby={`${id}-hechas`}>
        <div className="seccion-cabeza">
          <h2 id={`${id}-hechas`}><Icon name="trash" size={14} /> Lo que ya hiciste</h2>
          <span className="nota">Se borra solo de la agenda; en Google Tasks y Juancito Ads se queda</span>
        </div>
        <div className="fila-ajuste" style={{ borderTop: 0 }}>
          <label htmlFor={`${id}-borrar`}>Borrar lo hecho (y lo que «ya no aplica»)</label>
          <select id={`${id}-borrar`} className="campo" style={{ width: "auto" }} value={diasParaBorrar(ajustes)} onChange={(e) => poner((a) => ({ ...a, borrarHechas: Number(e.target.value) }))}>
            {[1, 7, 30, 90, 0].map((d) => <option key={d} value={d}>{DIAS_BORRAR[d]}</option>)}
          </select>
        </div>
      </section>
      {servidor && <Telegram />}
      {servidor && <Conexiones estado={estado} sombreros={sombrerosDe(ajustes)} recargar={recargar} avisar={avisar} />}

      <section className="tarjeta seccion" aria-labelledby={`${id}-ia`}>
        <div className="seccion-cabeza"><h2 id={`${id}-ia`}>Quién piensa: Claude o Meta</h2></div>
        <div className="segmentado" role="group" aria-label="Proveedor de IA">
          {Object.entries(PROVEEDORES).map(([pid, p]) => (
            <button key={pid} type="button" aria-pressed={ia.proveedor === pid} onClick={() => poner((a) => ({ ...a, ia: { proveedor: pid, modelos: {} } }))}>
              {p.nombre}
            </button>
          ))}
        </div>
        {Object.entries(FUNCIONES).map(([fid, f]) => {
          const actual = modeloEscogido(fid, ia);
          return (
            <div key={fid} className="fila-ajuste">
              <div>
                <label htmlFor={`${id}-${fid}`}><strong>{f.nombre}</strong></label>
                <br />
                <small>{f.detalle}</small>
              </div>
              <select
                id={`${id}-${fid}`}
                className="campo"
                value={actual}
                onChange={(e) => poner((a) => ({ ...a, ia: { ...a.ia, modelos: { ...a.ia.modelos, [fid]: e.target.value } } }))}
              >
                {Object.entries(MODELOS).map(([mid, m]) => (
                  <option key={mid} value={mid}>
                    {m.nombre}{m.entrena ? " (entrena con lo que recibe)" : ""}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
        {avisos.map((t) => (
          <p key={t} className="aviso rojo" role="alert" style={{ marginTop: "var(--sp-3)" }}>
            <Icon name="alert" size={18} /> <span>{t}</span>
          </p>
        ))}
        <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--fs-xs)", color: "var(--texto-3)" }}>
          Ordenar 30 capturas al día cuesta al mes, más o menos: {Object.keys(MODELOS).map((m) => `${MODELOS[m].nombre} ${mensual(m).toFixed(2).replace(".", ",")} US$`).join(" · ")}.
        </p>
      </section>

      <section className="tarjeta seccion" aria-labelledby={`${id}-v`}>
        <div className="seccion-cabeza"><h2 id={`${id}-v`}>Versículos</h2></div>
        <div className="fila-ajuste" style={{ borderTop: 0 }}>
          <div>
            <strong>¿Cada cuánto?</strong>
            <br />
            <small>Normal: en el resumen, el cierre, la revisión y al cumplir algo grande. Poco: sólo el resumen y la revisión. Nunca en un recordatorio.</small>
          </div>
          <div className="segmentado" role="group" aria-label="Frecuencia de los versículos">
            {FRECUENCIAS.map((f) => (
              <button key={f.id} type="button" aria-pressed={ajustes.frecuenciaVersiculos === f.id} onClick={() => poner((a) => ({ ...a, frecuenciaVersiculos: f.id }))}>
                {f.texto}
              </button>
            ))}
          </div>
        </div>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--texto-2)" }}>
          El asistente escoge de un banco cerrado y el texto lo pone la aplicación: nunca cita de memoria. No usa como promesa personal: {FUERA_DE_CONTEXTO.map((v) => v.ref).join(", ")}.
        </p>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--texto-2)" }}>
          Escogiste la NVI. Mientras llegan sus textos exactos, el banco enseña la Reina-Valera 1960: no se cita de memoria.
        </p>
        <p style={{ fontSize: "var(--fs-3xs)", color: "var(--texto-3)" }}>{ATRIBUCION}</p>
      </section>

      <section className="tarjeta seccion" aria-labelledby={`${id}-h`}>
        <div className="seccion-cabeza"><h2 id={`${id}-h`}>Tu semana: por confirmar</h2><span className="nota">Díselo al asistente: «madrugo a las 5», «termino de trabajar a las 5:30»</span></div>
        <ul style={{ margin: 0, paddingLeft: "var(--sp-5)", color: "var(--texto-2)", fontSize: "var(--fs-sm)" }}>
          {(ajustes.porConfirmar ?? []).map((p) => <li key={p.clave ?? p}>{p.texto ?? p}</li>)}
          {!(ajustes.porConfirmar ?? []).length && <li>Todo confirmado.</li>}
        </ul>
      </section>

      {servidor && <TuContrasena avisar={avisar} />}

      <div className="botones seccion">
        {reiniciar && <button type="button" className="boton" onClick={reiniciar}><Icon name="refresh" size={16} /> Volver a los datos de ejemplo</button>}
        {salir && <button type="button" className="boton" onClick={salir}><Icon name="logout" size={16} /> Salir</button>}
      </div>
    </>
  );
}

/** Ajustes → Seguimiento: qué te escribe el asistente por Telegram y a qué hora. */
function Seguimiento({ ajustes, poner }) {
  const id = useId();
  const seg = seguimientoDe(ajustes);
  const ponerSeg = (k, v) => poner((a) => ({ ...a, seguimiento: { ...seguimientoDe(a), [k]: v } }));
  const ponerAviso = (fn) => poner((a) => ({ ...a, avisos: fn(structuredClone(a.avisos)) }));
  const hora = (valor, onCambio, etiqueta) => (
    <input type="time" className="campo hora-corta" aria-label={etiqueta} value={valor ?? ""} onChange={(e) => e.target.value && onCambio(e.target.value)} />
  );
  return (
    <section className="tarjeta seccion" aria-labelledby={`${id}-seg`}>
      <div className="seccion-cabeza">
        <h2 id={`${id}-seg`}><Icon name="bell" size={14} /> Seguimiento</h2>
        <span className="nota">Lo que el asistente te escribe por Telegram, sin que se lo pidas</span>
      </div>
      <label className="casilla fuerte">
        <input type="checkbox" checked={seg.activo} onChange={(e) => ponerSeg("activo", e.target.checked)} /> Que me dé seguimiento
      </label>
      {seg.activo && (
        <>
          {Object.entries(PARTES_SEGUIMIENTO).map(([k, texto]) => (
            <label key={k} className="casilla">
              <input type="checkbox" checked={Boolean(seg[k])} onChange={(e) => ponerSeg(k, e.target.checked)} /> {texto}
            </label>
          ))}
          <div className="fila-ajuste">
            <div><strong>Resumen de la mañana</strong><br /><small>Después de tu oración, cada día a su hora.</small></div>
            <div className="horas-semana">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <label key={d}>
                  <span>{DIAS[d].slice(0, 3)}</span>
                  {hora(ajustes.avisos?.resumen?.[d], (v) => ponerAviso((x) => ({ ...x, resumen: { ...x.resumen, [d]: v } })), `Resumen del ${DIAS[d]}`)}
                </label>
              ))}
            </div>
          </div>
          <div className="fila-ajuste">
            <div><strong>Cierre del día</strong><br /><small>Si cae en algo protegido (la célula, un servicio), sale al terminar.</small></div>
            {hora(ajustes.avisos?.cierre, (v) => ponerAviso((x) => ({ ...x, cierre: v })), "Hora del cierre")}
          </div>
          <div className="fila-ajuste">
            <div><strong>Silencio</strong><br /><small>Nada suena en esas horas: va al resumen del día siguiente.</small></div>
            <div className="botones" style={{ alignItems: "center" }}>
              {hora(ajustes.avisos?.silencio?.desde, (v) => ponerAviso((x) => ({ ...x, silencio: { ...x.silencio, desde: v } })), "Silencio desde")}
              <span>a</span>
              {hora(ajustes.avisos?.silencio?.hasta, (v) => ponerAviso((x) => ({ ...x, silencio: { ...x.silencio, hasta: v } })), "Silencio hasta")}
            </div>
          </div>
          <div className="fila-ajuste">
            <div><strong>Avisos al día, como mucho</strong><br /><small>Lo que pase de ahí se junta.</small></div>
            <select className="campo" aria-label="Avisos al día" value={ajustes.avisos?.tope ?? 8} onChange={(e) => ponerAviso((x) => ({ ...x, tope: Number(e.target.value) }))}>
              {[3, 5, 8, 12, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="fila-ajuste">
            <div><strong>Revisión semanal</strong><br /><small>Vaciar la bandeja, mirar cada sombrero y escoger las piedras grandes.</small></div>
            <div className="botones" style={{ alignItems: "center" }}>
              <select className="campo" aria-label="Día de la revisión" value={ajustes.revision?.dia ?? 6} onChange={(e) => poner((a) => ({ ...a, revision: { ...a.revision, dia: Number(e.target.value) } }))}>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{DIAS[d]}</option>)}
              </select>
              {hora(ajustes.revision?.hora, (v) => poner((a) => ({ ...a, revision: { ...a.revision, hora: v } })), "Hora de la revisión")}
            </div>
          </div>
          <p className="vacio">Necesita Telegram conectado (más abajo). Nada suena durante tu oración, la Palabra, los servicios, la célula ni el estudio.</p>
        </>
      )}
    </section>
  );
}

/** Cambiar la contraseña con la sesión abierta: pide la de ahora; las sesiones de tus otros aparatos se cierran. */
function TuContrasena({ avisar }) {
  const id = useId();
  const [abierta, setAbierta] = useState(false);
  const [datos, setDatos] = useState({ actual: "", nueva: "", otra: "" });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const campo = (k) => ({ value: datos[k], onChange: (e) => setDatos((d) => ({ ...d, [k]: e.target.value })) });

  const guardar = async (e) => {
    e.preventDefault();
    if (datos.nueva !== datos.otra) {
      setError("Las dos contraseñas nuevas no coinciden.");
      return;
    }
    setEnviando(true);
    setError("");
    try {
      const r = await api.cambiarContrasena(datos.actual, datos.nueva);
      if (r.ok) {
        setDatos({ actual: "", nueva: "", otra: "" });
        setAbierta(false);
        avisar("Contraseña cambiada. Las sesiones de tus otros aparatos se cerraron.");
      } else setError(r.error ?? "No se pudo.");
    } catch {
      setError("No hay conexión con el servidor.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="tarjeta seccion" aria-labelledby={`${id}-t`}>
      <div className="seccion-cabeza">
        <h2 id={`${id}-t`}>Tu contraseña</h2>
        <span className="nota">Si la olvidas, en la entrada: «¿Olvidaste tu contraseña?» (por Telegram o con tu código de alta)</span>
      </div>
      {!abierta ? (
        <button type="button" className="boton" onClick={() => setAbierta(true)}>Cambiar mi contraseña</button>
      ) : (
        <form onSubmit={guardar}>
          <label className="etiqueta" htmlFor={`${id}-a`}>La de ahora</label>
          <input id={`${id}-a`} className="campo" type="password" autoComplete="current-password" required {...campo("actual")} />
          <div className="campos-2">
            <div>
              <label className="etiqueta" htmlFor={`${id}-n`}>La nueva (10 caracteres o más)</label>
              <input id={`${id}-n`} className="campo" type="password" autoComplete="new-password" required minLength={10} {...campo("nueva")} />
            </div>
            <div>
              <label className="etiqueta" htmlFor={`${id}-o`}>Repítela</label>
              <input id={`${id}-o`} className="campo" type="password" autoComplete="new-password" required minLength={10} {...campo("otra")} />
            </div>
          </div>
          {error && <p role="alert" className="aviso rojo" style={{ marginTop: "var(--sp-3)" }}>{error}</p>}
          <div className="botones" style={{ marginTop: "var(--sp-3)" }}>
            <button type="submit" className="boton primario" disabled={enviando}>{enviando ? "Un momento…" : "Guardar"}</button>
            <button type="button" className="boton fantasma" onClick={() => { setAbierta(false); setError(""); }}>Cancelar</button>
          </div>
        </form>
      )}
    </section>
  );
}
