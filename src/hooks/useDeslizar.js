import { useRef } from "react";

/** ¿El toque empezó en algo que ya se desplaza de lado (una fila de chips) o en un campo? Entonces no es para nosotros. */
function empiezaEnOtroLado(el, hasta) {
  for (let n = el; n && n !== hasta; n = n.parentElement) {
    if (n.matches?.("input, textarea, select, [data-sin-deslizar]")) return true;
    if (n.scrollWidth > n.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(n).overflowX)) return true;
  }
  return false;
}

/**
 * Deslizar con el dedo para pasar a la pestaña de al lado (Hoy en el teléfono, como las columnas de Tareas). Mientras
 * el dedo va de lado, el panel lo sigue un poco; si pasa del umbral, `onPaso(+1)` (a la siguiente, deslizando a la
 * izquierda) o `onPaso(-1)`. Lo vertical sigue siendo de la página (el panel lleva `touch-action: pan-y`).
 * `activo()` dice si ahora toca (en la computadora no hay pestañas).
 */
export function useDeslizar(onPaso, activo = () => true) {
  const t = useRef(null);
  const quieto = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const soltar = (el) => {
    el.style.transition = "";
    el.style.transform = "";
    el.style.opacity = "";
  };
  return {
    onTouchStart: (e) => {
      t.current = e.touches.length === 1 && activo() && !empiezaEnOtroLado(e.target, e.currentTarget) ? { x: e.touches[0].clientX, y: e.touches[0].clientY, el: e.currentTarget, eje: null } : null;
    },
    onTouchMove: (e) => {
      const s = t.current;
      if (!s) return;
      const dx = e.touches[0].clientX - s.x;
      const dy = e.touches[0].clientY - s.y;
      if (!s.eje && Math.hypot(dx, dy) > 10) s.eje = Math.abs(dx) > Math.abs(dy) * 1.3 ? "x" : "y";
      if (s.eje === "x" && !quieto()) {
        s.el.style.transition = "none";
        s.el.style.transform = `translateX(${dx * 0.35}px)`;
        s.el.style.opacity = String(1 - Math.min(Math.abs(dx) / 600, 0.3));
      }
    },
    onTouchEnd: (e) => {
      const s = t.current;
      t.current = null;
      if (!s) return;
      soltar(s.el);
      const dx = (e.changedTouches?.[0]?.clientX ?? s.x) - s.x;
      if (s.eje === "x" && Math.abs(dx) > 60) onPaso(dx < 0 ? 1 : -1);
    },
    onTouchCancel: () => {
      if (t.current) soltar(t.current.el);
      t.current = null;
    },
  };
}
