import { describe, it, expect } from "vitest";
import { cambiosEntre } from "../src/lib/api.js";

describe("lo que se manda al servidor", () => {
  const base = { acciones: [{ id: "a", t: 1 }, { id: "b", t: 1 }], proyectos: [], eventos: [], personas: [{ nombre: "Adolfo" }], ajustes: { x: 1 }, ritmo: [], bandeja: [{ id: "c1" }, { id: "c2" }] };
  it("sólo lo que cambió", () => {
    const despues = { ...base, acciones: [{ id: "a", t: 2 }, { id: "n", t: 1 }], bandeja: [{ id: "c2" }] };
    expect(cambiosEntre(base, despues)).toEqual([
      { op: "guardar", tipo: "accion", obj: { id: "a", t: 2 } },
      { op: "guardar", tipo: "accion", obj: { id: "n", t: 1 } },
      { op: "borrar", tipo: "accion", id: "b" },
      { op: "borrarCaptura", id: "c1" },
    ]);
  });
  it("los ajustes y el ritmo van juntos en el perfil", () => {
    expect(cambiosEntre(base, { ...base, ajustes: { x: 2 } })).toEqual([{ op: "perfil", perfil: { ajustes: { x: 2 }, ritmo: [] } }]);
    expect(cambiosEntre(base, base)).toEqual([]);
  });
});
