// ============================================================
// Lo que se guarda en D1, siempre acotado por dueño
//
// D1 no tiene RLS: una consulta a la que se le olvide el `owner_id` no
// falla, devuelve datos ajenos (lección del calendario de marketing). Por eso
// las consultas de datos viven SÓLO aquí, y el dueño entra al construir el
// almacén, no en cada llamada, que es donde se olvidaría.
// `tests/servidor.test.js` falla si aparece un `prepare(` fuera de este
// archivo y de sesion.js.
// ============================================================

import { AJUSTES_BASE } from "../../src/lib/ajustes.js";
import { RITMO_BASE } from "../../src/lib/ritmo.js";
import { AJUSTES_IA_BASE } from "../../src/lib/ia.js";

export const TIPOS_ELEMENTO = Object.freeze({ accion: "acciones", proyecto: "proyectos", evento: "eventos", persona: "personas" });
const MAX_JSON = 200_000;

const ahora = () => new Date().toISOString();
const leerJSON = (t, respaldo) => {
  try {
    return JSON.parse(t);
  } catch {
    return respaldo;
  }
};

/** Los ajustes de partida de una persona nueva. */
export const perfilInicial = (nombre = "") => ({
  ajustes: { ...structuredClone(AJUSTES_BASE), nombre: nombre || AJUSTES_BASE.nombre, ia: AJUSTES_IA_BASE },
  ritmo: structuredClone(RITMO_BASE),
});

/** El id de una persona es su nombre en minúsculas y sin tildes. */
export const idDePersona = (nombre) => String(nombre ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function crearAlmacen(db, ownerId) {
  if (!ownerId) throw new Error("El almacén necesita un dueño.");

  const sentenciaElemento = (tipo, obj) => {
    const id = tipo === "persona" ? idDePersona(obj.nombre) : String(obj.id ?? "");
    const datos = JSON.stringify(obj);
    if (!id || datos.length > MAX_JSON) throw new Error("Elemento sin id o demasiado grande.");
    return db
      .prepare(
        "insert into elementos (owner_id, tipo, id, datos, actualizado) values (?, ?, ?, ?, ?) " +
          "on conflict (owner_id, tipo, id) do update set datos = excluded.datos, actualizado = excluded.actualizado",
      )
      .bind(ownerId, tipo, id, datos, ahora());
  };

  return {
    ownerId,

    async perfil() {
      const fila = await db.prepare("select ajustes, ritmo from perfil where owner_id = ?").bind(ownerId).first();
      if (!fila) return null;
      return { ajustes: leerJSON(fila.ajustes, null), ritmo: leerJSON(fila.ritmo, []) };
    },

    sentenciaPerfil({ ajustes, ritmo }) {
      return db
        .prepare(
          "insert into perfil (owner_id, ajustes, ritmo, actualizado) values (?, ?, ?, ?) " +
            "on conflict (owner_id) do update set ajustes = excluded.ajustes, ritmo = excluded.ritmo, actualizado = excluded.actualizado",
        )
        .bind(ownerId, JSON.stringify(ajustes), JSON.stringify(ritmo), ahora());
    },

    async guardarPerfil(perfil) {
      await this.sentenciaPerfil(perfil).run();
    },

    async estado() {
      const [perfil, filas, bandeja] = await Promise.all([
        this.perfil(),
        db.prepare("select tipo, datos from elementos where owner_id = ?").bind(ownerId).all(),
        db
          .prepare("select id, texto, canal, estado, error, creada from capturas where owner_id = ? and estado in ('pendiente', 'error') order by creada desc limit 100")
          .bind(ownerId)
          .all(),
      ]);
      const base = perfil ?? perfilInicial();
      const salida = { ajustes: base.ajustes, ritmo: base.ritmo, acciones: [], proyectos: [], eventos: [], personas: [] };
      for (const f of filas.results ?? []) {
        const lista = TIPOS_ELEMENTO[f.tipo];
        const obj = leerJSON(f.datos, null);
        if (lista && obj) salida[lista].push(obj);
      }
      salida.bandeja = (bandeja.results ?? []).map((c) => ({ ...c }));
      return salida;
    },

    sentenciaElemento,

    async guardarElemento(tipo, obj) {
      await sentenciaElemento(tipo, obj).run();
    },

    sentenciaBorrar(tipo, id) {
      return db.prepare("delete from elementos where owner_id = ? and tipo = ? and id = ?").bind(ownerId, tipo, String(id));
    },

    async borrarElemento(tipo, id) {
      const r = await this.sentenciaBorrar(tipo, id).run();
      return (r.meta?.changes ?? 0) > 0;
    },

    /** Varias escrituras de una vez (D1: un lote). */
    async lote(sentencias) {
      if (sentencias.length) await db.batch(sentencias);
    },

    async crearCaptura({ id, texto, canal }) {
      await db.prepare("insert into capturas (id, owner_id, texto, canal) values (?, ?, ?, ?)").bind(id, ownerId, texto, canal).run();
      return { id, texto, canal, estado: "pendiente", creada: ahora() };
    },

    async captura(id) {
      const f = await db.prepare("select id, texto, canal, estado, resultado, error, creada from capturas where owner_id = ? and id = ?").bind(ownerId, id).first();
      return f ? { ...f, resultado: f.resultado ? leerJSON(f.resultado, null) : null } : null;
    },

    sentenciaMarcarCaptura(id, { estado, resultado = null, error = null }) {
      return db
        .prepare("update capturas set estado = ?, resultado = ?, error = ? where owner_id = ? and id = ?")
        .bind(estado, resultado ? JSON.stringify(resultado) : null, error, ownerId, id);
    },

    async marcarCaptura(id, cambios) {
      await this.sentenciaMarcarCaptura(id, cambios).run();
    },

    async borrarCaptura(id) {
      const r = await db.prepare("delete from capturas where owner_id = ? and id = ?").bind(ownerId, id).run();
      return (r.meta?.changes ?? 0) > 0;
    },

    /** La última captura ordenada en los últimos `minutos`, para que el asistente siga la conversación. */
    async ultimaReciente(minutos = 15) {
      const desde = new Date(Date.now() - minutos * 60_000).toISOString();
      const f = await db
        .prepare("select id, texto, resultado from capturas where owner_id = ? and estado = 'ordenada' and creada > ? order by creada desc limit 1")
        .bind(ownerId, desde)
        .first();
      return f ? { ...f, resultado: f.resultado ? leerJSON(f.resultado, null) : null } : null;
    },

    async registrarConsumo({ modelo, funcion, entrada, salida, costo }) {
      try {
        await db
          .prepare("insert into consumo_ia (id, owner_id, modelo, funcion, entrada, salida, costo) values (?, ?, ?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(), ownerId, modelo, funcion, entrada ?? 0, salida ?? 0, costo ?? 0)
          .run();
      } catch {
        /* perder un apunte no puede tumbar la respuesta */
      }
    },
  };
}
