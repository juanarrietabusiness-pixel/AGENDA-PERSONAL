import { useCallback, useEffect, useState } from "react";
import { datosDemo } from "../datos/demo.js";
import { AJUSTES_BASE } from "../lib/ajustes.js";
import { AJUSTES_IA_BASE } from "../lib/ia.js";
import { TEMA_BASE } from "../lib/temas.js";

// El estado del PROTOTIPO, guardado en este navegador. En producción esto es
// D1 detrás del Worker; aquí sirve para probar sin servidor.

const CLAVE = "agenda-prototipo-v1";

function inicial(hoy) {
  return {
    ...datosDemo(hoy),
    ajustes: { ...AJUSTES_BASE, tema: TEMA_BASE, ia: AJUSTES_IA_BASE, frecuenciaVersiculos: "normal" },
    historialVersiculos: [],
  };
}

function leer(hoy) {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? "null");
    if (guardado?.acciones) return guardado;
  } catch {
    /* sin almacenamiento o dañado: se empieza de cero */
  }
  return inicial(hoy);
}

export function useAlmacen(hoy) {
  const [estado, setEstado] = useState(() => leer(hoy));

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
    } catch {
      /* sin almacenamiento: el prototipo funciona igual, sólo no recuerda */
    }
  }, [estado]);

  const cambiar = useCallback((fn) => setEstado((e) => fn(e)), []);
  const reiniciar = useCallback(() => setEstado(inicial(hoy)), [hoy]);
  return { estado, cambiar, reiniciar };
}
