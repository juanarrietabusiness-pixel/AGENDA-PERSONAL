import { useCallback, useEffect, useRef, useState } from "react";
import { datosDemo } from "../datos/demo.js";
import { AJUSTES_BASE } from "../lib/ajustes.js";
import { AJUSTES_IA_BASE } from "../lib/ia.js";
import { TEMA_BASE } from "../lib/temas.js";
import { RITMO_BASE } from "../lib/ritmo.js";
import { conReino } from "../lib/semana.js";
import * as api from "../lib/api.js";

// ============================================================
// El estado de la aplicación, en dos modos:
//
//   · SERVIDOR: con el Worker detrás (`npm run dev:worker` o publicada). Cada
//     cambio se manda a la API (`cambiosEntre`); D1 es la verdad.
//   · PROTOTIPO: sin servidor (`npm run dev`). Datos de ejemplo guardados en
//     este navegador, para probar sin nada más.
//
// Las pantallas no saben en qué modo están: reciben `estado` y `cambiar`.
// ============================================================

const CLAVE = "agenda-prototipo-v2";

function inicial(hoy) {
  return {
    ...datosDemo(hoy),
    ajustes: { ...structuredClone(AJUSTES_BASE), tema: TEMA_BASE, ia: AJUSTES_IA_BASE },
    ritmo: structuredClone(RITMO_BASE),
    historialVersiculos: [],
  };
}

/** Reino como primer sombrero, una vez (lo mismo hace el servidor). */
const conReinoPrototipo = (e) => ({ ...e, ...conReino(e).perfil });

function leerPrototipo(hoy) {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? "null");
    if (guardado?.acciones) return conReinoPrototipo(guardado);
  } catch {
    /* sin almacenamiento o dañado: se empieza de cero */
  }
  return conReinoPrototipo(inicial(hoy));
}

const delServidor = (e) => ({
  ...e,
  ajustes: { tema: TEMA_BASE, ...e.ajustes, ia: e.ajustes?.ia ?? AJUSTES_IA_BASE },
  historialVersiculos: e.historialVersiculos ?? [],
});

export function useAlmacen(hoy) {
  const [modo, setModo] = useState("cargando"); // cargando | prototipo | acceso | alta | servidor
  const [estado, setEstado] = useState(null);
  const [fallo, setFallo] = useState("");
  const ref = useRef(null);
  // Escrituras en camino: mientras haya alguna, no se relee (la lectura traería lo de antes y lo pisaría en pantalla).
  const enCamino = useRef(0);

  const poner = (e) => {
    ref.current = e;
    setEstado(e);
  };

  const cargar = useCallback(async () => {
    if (enCamino.current > 0) return;
    const r = await api.estado();
    if (r.estado === 401) {
      setModo("acceso");
      return;
    }
    poner(delServidor(r));
    setModo("servidor");
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await api.arranque();
        if (!vivo) return;
        if (r.usuario) await cargar();
        else setModo(r.alta ? "alta" : "acceso");
      } catch {
        if (!vivo) return;
        poner(leerPrototipo(hoy));
        setModo("prototipo");
      }
    })();
    return () => {
      vivo = false;
    };
    // Sólo al abrir: `hoy` cambia a medianoche y no hay que volver a arrancar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (modo !== "prototipo" || !estado) return;
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
    } catch {
      /* sin almacenamiento: el prototipo funciona igual, sólo no recuerda */
    }
  }, [estado, modo]);

  /** Cambia el estado. En modo servidor, lo que cambió se manda a la API. */
  const cambiar = useCallback(
    (fn) => {
      const antes = ref.current;
      if (!antes) return;
      const despues = fn(antes);
      poner(despues);
      if (modo !== "servidor") return;
      const ops = api.cambiosEntre(antes, despues);
      if (!ops.length) return;
      enCamino.current++;
      api.aplicarCambios(ops).then((fallos) => {
        enCamino.current--;
        if (fallos.length) setFallo(`No se guardó todo: ${fallos[0]}`);
      });
    },
    [modo],
  );

  // Lo que entra por Telegram, Claude, Juancito Ads o Google aparece sin recargar: cada minuto, si se está mirando.
  useEffect(() => {
    if (modo !== "servidor") return undefined;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") cargar().catch(() => {});
    }, 60_000);
    const alVolver = () => document.visibilityState === "visible" && cargar().catch(() => {});
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [modo, cargar]);

  const reiniciar = useCallback(() => {
    if (modo === "prototipo") poner(inicial(hoy));
  }, [modo, hoy]);

  const entrar = useCallback(async (email, contrasena) => {
    const r = await api.entrar(email, contrasena);
    if (r.ok) await cargar();
    return r;
  }, [cargar]);

  const darDeAlta = useCallback(async (datos) => {
    const r = await api.alta(datos);
    if (r.ok) await cargar();
    return r;
  }, [cargar]);

  const salir = useCallback(async () => {
    await api.salir();
    poner(null);
    setModo("acceso");
  }, []);

  return { modo, estado, cambiar, reiniciar, recargar: cargar, entrar, darDeAlta, salir, fallo, limpiarFallo: () => setFallo("") };
}
