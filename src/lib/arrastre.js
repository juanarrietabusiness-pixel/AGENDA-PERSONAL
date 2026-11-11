// ============================================================
// Arrastrar y soltar entre pantallas (una tarea a un día, a un bloque, a otro sombrero)
//
// Lo que viaja es { tipo: "accion" | "evento", id }, con su propio tipo MIME: así una zona sólo acepta lo que es de la
// agenda (no un texto ni un archivo que alguien arrastre desde fuera).
// ============================================================

export const TIPO_ARRASTRE = "application/x-kairos";

/** Empieza a arrastrar algo de la agenda. */
export function empezarArrastre(e, datos) {
  e.dataTransfer.setData(TIPO_ARRASTRE, JSON.stringify(datos));
  e.dataTransfer.setData("text/plain", datos.titulo ?? "");
  e.dataTransfer.effectAllowed = "move";
}

/** ¿Lo que se arrastra es de la agenda? (en `dragover` no se puede leer, sólo saber el tipo) */
export const esDeLaAgenda = (e) => Array.from(e.dataTransfer?.types ?? []).includes(TIPO_ARRASTRE);

/** Lo que se soltó, o null si no es de la agenda. */
export function leerArrastre(e) {
  try {
    const d = JSON.parse(e.dataTransfer.getData(TIPO_ARRASTRE));
    return d && (d.tipo === "accion" || d.tipo === "evento") && d.id ? d : null;
  } catch {
    return null;
  }
}

/** Las props de una zona donde se suelta: marca `soltando` mientras algo de la agenda pasa por encima. */
export function zonaDeSoltar(onSoltar, setEncima) {
  return {
    onDragOver: (e) => {
      if (!esDeLaAgenda(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setEncima?.(true);
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setEncima?.(false);
    },
    onDrop: (e) => {
      const d = leerArrastre(e);
      setEncima?.(false);
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      onSoltar(d, e);
    },
  };
}
