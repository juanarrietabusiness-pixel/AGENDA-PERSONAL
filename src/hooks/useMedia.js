import { useSyncExternalStore } from "react";

/** ¿Cumple ahora esta media query? Se vuelve a pintar al cambiar (girar el teléfono, ensanchar la ventana). */
export function useMedia(consulta) {
  return useSyncExternalStore(
    (avisar) => {
      const m = window.matchMedia?.(consulta);
      m?.addEventListener("change", avisar);
      return () => m?.removeEventListener("change", avisar);
    },
    () => Boolean(window.matchMedia?.(consulta).matches),
    () => false,
  );
}
