import { useCallback, useEffect, useState } from "react";
import Icon from "./componentes/Icon.jsx";
import Capturar from "./componentes/Capturar.jsx";
import Aclarar from "./componentes/Aclarar.jsx";
import Hoy from "./pantallas/Hoy.jsx";
import Semana from "./pantallas/Semana.jsx";
import Sombreros from "./pantallas/Sombreros.jsx";
import Asistente from "./pantallas/Asistente.jsx";
import Ajustes from "./pantallas/Ajustes.jsx";
import { useAlmacen } from "./hooks/useAlmacen.js";
import { hoyEn, horaEn, sumarDias, textoLargo } from "./lib/fechas.js";
import { completar, posponer, soltar } from "./lib/metodo.js";
import { tema as temaDe } from "./lib/temas.js";

const PANTALLAS = [
  { id: "hoy", nombre: "Hoy", icono: "sun" },
  { id: "semana", nombre: "Semana", icono: "calendar" },
  { id: "sombreros", nombre: "Sombreros", icono: "layers" },
  { id: "asistente", nombre: "Asistente", icono: "messageCircle" },
];

const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const pantallaDeLaDireccion = () => {
  const h = window.location.hash.replace("#", "");
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
  const { estado, cambiar, reiniciar } = useAlmacen(hoy);
  const [pantalla, setPantalla] = useState(pantallaDeLaDireccion);
  const [capturando, setCapturando] = useState(false);
  const [aclarando, setAclarando] = useState(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const alCambiar = () => setPantalla(pantallaDeLaDireccion());
    window.addEventListener("hashchange", alCambiar);
    return () => window.removeEventListener("hashchange", alCambiar);
  }, []);

  const tema = temaDe(estado.ajustes.tema);
  useEffect(() => {
    document.documentElement.style.setProperty("--acento", tema.acento);
    document.documentElement.style.setProperty("--sobre-acento", tema.sobreAcento);
    document.title = tema.nombre;
  }, [tema]);

  const conAcciones = useCallback((fn) => cambiar((e) => ({ ...e, acciones: fn(e.acciones) })), [cambiar]);
  const avisar = (texto) => {
    setMensaje(texto);
    setTimeout(() => setMensaje(""), 4000);
  };

  const accionesUI = {
    hecha: (id) => {
      const a = estado.acciones.find((x) => x.id === id);
      if (!a) return;
      const { hecha, siguiente } = completar(a, hoy);
      conAcciones((lista) => [...lista.map((x) => (x.id === id ? hecha : x)), ...(siguiente ? [siguiente] : [])]);
      avisar(siguiente ? `Hecha. La siguiente queda para ${textoLargo(siguiente.cuando ?? siguiente.limite)}.` : `Hecha: «${a.titulo}».`);
    },
    deshacer: (id) => conAcciones((lista) => lista.map((x) => (x.id === id ? { ...x, estado: "abierta", hechaEl: null } : x))),
    escoger: (id) => conAcciones((lista) => {
      const yaSon = lista.filter((x) => x.enfoque === hoy).length;
      if (yaSon >= 3) {
        avisar("Ya tienes tus 3 de hoy. Si cambias una, quita otra primero.");
        return lista;
      }
      return lista.map((x) => (x.id === id ? { ...x, enfoque: hoy } : x));
    }),
    decidir: (id, opcion) => conAcciones((lista) => lista.map((x) => {
      if (x.id !== id) return x;
      if (opcion === "hoy") return posponer(x, hoy);
      if (opcion === "manana") return posponer(x, sumarDias(hoy, 1));
      if (opcion === "algun-dia") return { ...x, lista: "algun-dia", cuando: null };
      return soltar(x, hoy);
    })),
    aceptarBloque: (b) => {
      conAcciones((lista) => lista.map((x) => (x.id === b.accionId ? { ...x, cuando: hoy, hora: b.inicio } : x)));
      avisar(`«${b.titulo}» quedó agendada a las ${b.inicio}.`);
    },
  };

  const guardarCaptura = (texto) => {
    cambiar((e) => ({ ...e, bandeja: [{ id: `c-${Date.now()}`, texto, canal: "app", creada: hoy }, ...e.bandeja] }));
    setCapturando(false);
    avisar("Guardado en la Bandeja.");
  };

  const terminarAclarar = (accion) => {
    const captura = aclarando;
    cambiar((e) => ({
      ...e,
      bandeja: e.bandeja.filter((c) => c.id !== captura.id),
      acciones: accion ? [...e.acciones, accion] : e.acciones,
    }));
    setAclarando(null);
    avisar(accion ? `Listo: «${accion.titulo}».` : "Borrado.");
  };

  const props = { estado, hoy, hora, acciones: accionesUI };

  return (
    <div className="app">
      <header className="cabecera">
        <div className="marca"><span className="marca-punto" aria-hidden="true" />{tema.nombre}</div>
        <span className="chip">Prototipo</span>
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
          <a className="nav-ajustes" href="#ajustes" aria-current={pantalla === "ajustes" ? "page" : undefined}>
            <Icon name="settings" size={22} /> Ajustes
          </a>
        </nav>
        <main className="contenido" id="contenido">
          {pantalla === "hoy" && <Hoy {...props} />}
          {pantalla === "semana" && <Semana {...props} />}
          {pantalla === "sombreros" && <Sombreros {...props} />}
          {pantalla === "asistente" && <Asistente {...props} onAclarar={setAclarando} />}
          {pantalla === "ajustes" && <Ajustes estado={estado} cambiar={cambiar} reiniciar={reiniciar} />}
          {pantalla !== "ajustes" && (
            <p style={{ marginTop: "var(--sp-6)", textAlign: "center" }}>
              <a href="#ajustes" style={{ color: "var(--texto-3)", fontSize: "var(--fs-sm)" }}>Ajustes: nombre, color, IA y versículos</a>
            </p>
          )}
        </main>
      </div>

      <button type="button" className="capturar-boton" onClick={() => setCapturando(true)}>
        <Icon name="plus" size={22} strokeWidth={2.5} /> Capturar
      </button>

      <div role="status" aria-live="polite" className={mensaje ? "aviso" : "solo-lector"} style={mensaje ? { position: "fixed", left: "50%", transform: "translateX(-50%)", top: 72, zIndex: 60, boxShadow: "var(--elev-2)" } : undefined}>
        {mensaje}
      </div>

      {capturando && <Capturar onGuardar={guardarCaptura} onCerrar={() => setCapturando(false)} />}
      {aclarando && <Aclarar captura={aclarando} hoy={hoy} onListo={terminarAclarar} onCerrar={() => setAclarando(null)} />}
    </div>
  );
}
