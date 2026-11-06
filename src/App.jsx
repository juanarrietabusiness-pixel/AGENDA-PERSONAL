import { useCallback, useEffect, useState } from "react";
import Icon from "./componentes/Icon.jsx";
import Aclarar from "./componentes/Aclarar.jsx";
import Editar from "./componentes/Editar.jsx";
import EventoGoogle from "./componentes/EventoGoogle.jsx";
import Burbuja from "./componentes/Burbuja.jsx";
import Hoy from "./pantallas/Hoy.jsx";
import Plan from "./pantallas/Plan.jsx";
import Mentor from "./pantallas/Mentor.jsx";
import Ajustes from "./pantallas/Ajustes.jsx";
import Entrar from "./pantallas/Entrar.jsx";
import Autorizar from "./pantallas/Autorizar.jsx";
import Recuperar from "./pantallas/Recuperar.jsx";
import { useAlmacen } from "./hooks/useAlmacen.js";
import { hoyEn, horaEn, sumarDias, textoLargo } from "./lib/fechas.js";
import { completar, posponer, soltar } from "./lib/metodo.js";
import { sombrerosDe } from "./lib/sombreros.js";
import { claveDeGoogle, CLASES_GOOGLE, convertir, QUE_ES } from "./lib/agenda.js";
import { tema as temaDe } from "./lib/temas.js";

const PANTALLAS = [
  { id: "hoy", nombre: "Hoy", icono: "sun" },
  { id: "plan", nombre: "Plan", icono: "calendar" },
  { id: "mentor", nombre: "Mentor", icono: "brain" },
];
// Las direcciones de antes siguen llevando a algún sitio.
const ANTES = { semana: "plan", sombreros: "plan", asistente: "hoy" };

const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const pantallaDeLaDireccion = () => {
  const h = window.location.hash.replace("#", "").split("?")[0];
  if (ANTES[h]) return ANTES[h];
  return [...PANTALLAS.map((p) => p.id), "ajustes"].includes(h) ? h : "hoy";
};

function useReloj() {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return ahora;
}

export default function App() {
  const reloj = useReloj();
  const hoy = hoyEn(undefined, reloj);
  const hora = horaEn(undefined, reloj);
  const almacen = useAlmacen(hoy);
  const { estado, cambiar, reiniciar, modo } = almacen;
  const [pantalla, setPantalla] = useState(pantallaDeLaDireccion);
  const [aclarando, setAclarando] = useState(null);
  const [editando, setEditando] = useState(null);
  const [asistente, setAsistente] = useState(false);
  // Al volver de dar un permiso (Juancito Ads, Google), el servidor dice qué pasó en ?aviso=…
  const [mensaje, setMensaje] = useState(() => {
    const aviso = new URLSearchParams(window.location.search).get("aviso");
    return aviso && window.location.pathname === "/" ? { texto: aviso } : null;
  });
  const autorizando = window.location.pathname === "/autorizar";

  useEffect(() => {
    const alCambiar = () => setPantalla(pantallaDeLaDireccion());
    window.addEventListener("hashchange", alCambiar);
    return () => window.removeEventListener("hashchange", alCambiar);
  }, []);

  const avisar = useCallback((texto, extra = {}) => {
    setMensaje({ texto, ...extra });
    setTimeout(() => setMensaje((m) => (m?.texto === texto ? null : m)), extra.accion ? 9000 : 4500);
  }, []);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).get("aviso") || autorizando) return undefined;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
    const t = setTimeout(() => setMensaje(null), 8000);
    return () => clearTimeout(t);
  }, [autorizando]);

  const tema = temaDe(estado?.ajustes?.tema);
  useEffect(() => {
    document.documentElement.style.setProperty("--acento", tema.acento);
    document.documentElement.style.setProperty("--sobre-acento", tema.sobreAcento);
    document.title = tema.nombre;
  }, [tema]);

  const conAcciones = useCallback((fn) => cambiar((e) => ({ ...e, acciones: fn(e.acciones) })), [cambiar]);

  if (modo === "cargando") return <div className="pantalla-entrada" role="status">Cargando…</div>;
  // El enlace de «¿Olvidaste tu contraseña?» se abre sin sesión.
  if (window.location.pathname === "/recuperar") return <Recuperar servidor={modo !== "prototipo"} />;
  if (modo === "acceso" || modo === "alta") return <Entrar modo={modo} almacen={almacen} />;
  if (autorizando) return modo === "servidor" ? <Autorizar /> : <div className="pantalla-entrada">El permiso de Claude necesita el servidor.</div>;

  const sombreros = sombrerosDe(estado.ajustes);
  const servidor = modo === "servidor";

  /** Marcar hecha (o reabrir) una acción. Si se repite, nace la siguiente. */
  /** Marcar hecha (o reabrir). Con `fijar`, queda también en tus 3 de hoy (lo hecho desde el enfoque sigue a la vista). */
  const onHecha = (id, { fijar = false } = {}) => {
    const a = estado.acciones.find((x) => x.id === id);
    if (!a) return;
    if (a.estado !== "abierta") {
      conAcciones((lista) => lista.map((x) => (x.id === id ? { ...x, estado: "abierta", hechaEl: null } : x)));
      avisar(`Reabierta: «${a.titulo}».`);
      return;
    }
    const { hecha, siguiente } = completar(fijar ? { ...a, enfoque: hoy } : a, hoy);
    conAcciones((lista) => [...lista.map((x) => (x.id === id ? hecha : x)), ...(siguiente ? [siguiente] : [])]);
    avisar(siguiente ? `Hecha. La siguiente queda para ${textoLargo(siguiente.cuando ?? siguiente.limite)}.` : `Hecha: «${a.titulo}».`, {
      accion: "Deshacer",
      alPulsar: () => conAcciones((lista) => lista.filter((x) => x.id !== siguiente?.id).map((x) => (x.id === id ? a : x))),
    });
  };

  /** ★: una de tus 3 de hoy (o ya no). */
  const onEnfoque = (id) => {
    const a = estado.acciones.find((x) => x.id === id);
    if (!a) return;
    const fija = a.enfoque === hoy;
    conAcciones((lista) => lista.map((x) => (x.id === id ? { ...x, enfoque: fija ? null : hoy, noHoy: null } : x)));
    avisar(fija ? `Quité «${a.titulo}» de tus 3 de hoy.` : `«${a.titulo}» es una de tus 3 de hoy.`);
  };

  /** «Hoy no»: la agenda deja de proponerla para el enfoque de hoy (sigue en su lista). */
  const onNoHoy = (id) => conAcciones((lista) => lista.map((x) => (x.id === id ? { ...x, noHoy: hoy, enfoque: x.enfoque === hoy ? null : x.enfoque } : x)));

  const onDecidir = (id, opcion) =>
    conAcciones((lista) => lista.map((x) => {
      if (x.id !== id) return x;
      if (opcion === "hoy") return posponer(x, hoy);
      if (opcion === "manana") return posponer(x, sumarDias(hoy, 1));
      if (opcion === "algun-dia") return { ...x, lista: "algun-dia", cuando: null };
      return soltar(x, hoy);
    }));

  const onAbrir = (tipo, obj) => setEditando({ tipo, obj });

  /** Qué es un evento de Google para la agenda (reunión, rutina, especial): vale para toda su serie. */
  const claseGoogle = (evento, clase) => {
    cambiar((e) => ({ ...e, ajustes: { ...e.ajustes, clasesGoogle: { ...(e.ajustes.clasesGoogle ?? {}), [claveDeGoogle(evento)]: clase } } }));
    avisar(`«${evento.titulo}»: ${CLASES_GOOGLE[clase].toLowerCase()}${evento.serie ? ", todas las veces que se repite" : ""}.`);
  };

  const guardarEdicion = (obj, { como } = {}) => {
    if (como) {
      // Cambia de tipo (tarea ↔ reunión, etc.): se crea lo nuevo y se quita lo de antes, también en Google y Juancito Ads.
      const de = editando.tipo === "accion" ? "acciones" : "eventos";
      const r = convertir(obj, editando.tipo, como, hoy);
      const a = r.tipo === "accion" ? "acciones" : "eventos";
      cambiar((e) => {
        const sinViejo = { ...e, [de]: e[de].filter((x) => x.id !== obj.id) };
        return { ...sinViejo, [a]: [...sinViejo[a], r.obj] };
      });
      setEditando(null);
      avisar(`«${obj.titulo}» ahora es ${QUE_ES[como].toLowerCase()}.`);
      return;
    }
    const lista = editando.tipo === "accion" ? "acciones" : "eventos";
    cambiar((e) => ({ ...e, [lista]: e[lista].map((x) => (x.id === obj.id ? obj : x)) }));
    setEditando(null);
    avisar("Guardado.");
  };

  const borrarEdicion = (id) => {
    const lista = editando.tipo === "accion" ? "acciones" : "eventos";
    cambiar((e) => ({ ...e, [lista]: e[lista].filter((x) => x.id !== id) }));
    setEditando(null);
    avisar("Borrado.");
  };

  const enPrototipo = (texto) => {
    cambiar((e) => ({ ...e, bandeja: [{ id: `c-${Date.now()}`, texto, canal: "app", creada: hoy }, ...e.bandeja] }));
    avisar("Guardado en la Bandeja: en el prototipo la IA no está conectada. Lo aclaras tú.");
  };

  const terminarAclarar = (accion) => {
    const captura = aclarando;
    cambiar((e) => ({ ...e, bandeja: e.bandeja.filter((c) => c.id !== captura.id), acciones: accion ? [...e.acciones, accion] : e.acciones }));
    setAclarando(null);
    avisar(accion ? `Listo: «${accion.titulo}».` : "Borrado.");
  };

  const comunes = { estado, hoy, onHecha, onAbrir, avisar };

  return (
    <div className={`app${asistente ? " con-asistente" : ""}`}>
      <header className="cabecera">
        <div className="marca"><span className="marca-punto" aria-hidden="true" />{tema.nombre}</div>
        {modo === "prototipo" && <span className="chip">Prototipo</span>}
        <span className="cabecera-fecha">{mayuscula(textoLargo(hoy))}</span>
      </header>
      <div className="cuerpo">
        <nav className="nav" aria-label="Secciones">
          {PANTALLAS.map((p) => (
            <a key={p.id} href={`#${p.id}`} aria-current={pantalla === p.id ? "page" : undefined}>
              <Icon name={p.icono} size={22} />
              {p.nombre}
            </a>
          ))}
          <a href="#ajustes" aria-current={pantalla === "ajustes" ? "page" : undefined}>
            <Icon name="settings" size={22} /> Ajustes
          </a>
        </nav>
        <main className="contenido" id="contenido">
          {pantalla === "hoy" && <Hoy {...comunes} cambiar={cambiar} hora={hora} onDecidir={onDecidir} onEnfoque={onEnfoque} onNoHoy={onNoHoy} onAsistente={() => (servidor ? setAsistente(true) : estado.bandeja[0] && setAclarando(estado.bandeja[0]))} />}
          {pantalla === "plan" && <Plan {...comunes} cambiar={cambiar} />}
          {pantalla === "mentor" && <Mentor {...comunes} cambiar={cambiar} recargar={almacen.recargar} servidor={servidor} />}
          {pantalla === "ajustes" && (
            <Ajustes estado={estado} cambiar={cambiar} reiniciar={modo === "prototipo" ? reiniciar : null} salir={servidor ? almacen.salir : null} servidor={servidor} recargar={almacen.recargar} avisar={avisar} />
          )}
        </main>
      </div>

      <Burbuja estado={estado} servidor={servidor} recargar={almacen.recargar} avisar={avisar} abierta={asistente} setAbierta={setAsistente} onPrototipo={enPrototipo} />

      <div role="status" aria-live="polite" className={mensaje ? "aviso toast" : "solo-lector"}>
        {mensaje && (
          <>
            <span>{mensaje.texto}</span>
            {mensaje.accion && (
              <button type="button" className="boton" onClick={() => { mensaje.alPulsar?.(); setMensaje(null); }}>{mensaje.accion}</button>
            )}
          </>
        )}
      </div>

      {almacen.fallo && (
        <div role="alert" className="aviso rojo" style={{ position: "fixed", left: 16, right: 16, bottom: 140, zIndex: 60 }}>
          <span>{almacen.fallo}</span>
          <button type="button" className="boton fantasma" onClick={almacen.limpiarFallo}>Cerrar</button>
        </div>
      )}
      {aclarando && <Aclarar captura={aclarando} hoy={hoy} onListo={terminarAclarar} onCerrar={() => setAclarando(null)} />}
      {editando?.tipo === "google" && <EventoGoogle evento={editando.obj} ajustes={estado.ajustes} onCambiar={claseGoogle} onCerrar={() => setEditando(null)} />}
      {editando && editando.tipo !== "google" && (
        <Editar
          tipo={editando.tipo}
          obj={editando.obj}
          sombreros={sombreros}
          proyectos={estado.proyectos}
          hoy={hoy}
          onGuardar={guardarEdicion}
          onBorrar={editando.obj.fuente === "google" ? null : borrarEdicion}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  );
}
