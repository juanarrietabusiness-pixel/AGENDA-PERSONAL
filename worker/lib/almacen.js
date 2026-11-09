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
export const MAX_APRENDIDOS = 300;
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

    /**
     * Todo lo de la persona. Con `completo`, también el cerebro, la conversación, las conexiones (sin sus llaves) y
     * los eventos de Google del rango: lo que pide la pantalla.
     */
    async estado({ completo = false, desde = null, hasta = null } = {}) {
      const [perfil, filas, bandeja, extra] = await Promise.all([
        this.perfil(),
        db.prepare("select tipo, datos from elementos where owner_id = ?").bind(ownerId).all(),
        db
          .prepare("select id, texto, canal, estado, error, creada from capturas where owner_id = ? and estado in ('pendiente', 'error') order by creada desc limit 100")
          .bind(ownerId)
          .all(),
        completo
          ? Promise.all([this.cerebro(), this.conversacion(30), this.conexiones(), desde && hasta ? this.externosEntre(desde, hasta) : []])
          : null,
      ]);
      const base = perfil ?? perfilInicial();
      const salida = { ajustes: base.ajustes, ritmo: base.ritmo, acciones: [], proyectos: [], eventos: [], personas: [] };
      for (const f of filas.results ?? []) {
        const lista = TIPOS_ELEMENTO[f.tipo];
        const obj = leerJSON(f.datos, null);
        if (lista && obj) salida[lista].push(obj);
      }
      salida.bandeja = (bandeja.results ?? []).map((c) => ({ ...c }));
      if (extra) {
        const [cerebro, conversacion, conexiones, externos] = extra;
        Object.assign(salida, { cerebro, conversacion, conexiones: conexiones.map(({ servicio, sincronizado, error, datos }) => ({ servicio, sincronizado, error, conectada: Boolean(datos?.conectada || datos?.renovacion), cuenta: datos?.cuenta ?? null, ajustes: datos?.ajustes ?? {}, calendarios: (datos?.lista ?? []).filter((k) => k.id !== datos?.semana?.calendario), semana: Boolean(datos?.semana?.calendario) })), externos });
      }
      return salida;
    },

    async elemento(tipo, id) {
      const f = await db.prepare("select datos from elementos where owner_id = ? and tipo = ? and id = ?").bind(ownerId, tipo, String(id)).first();
      return f ? leerJSON(f.datos, null) : null;
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

    // ── Telegram ──
    async telegram() {
      const f = await db.prepare("select chat_id, nombre, vinculado from telegram where owner_id = ?").bind(ownerId).first();
      return { vinculado: Boolean(f?.chat_id), nombre: f?.chat_id ? f.nombre : "", desde: f?.chat_id ? f.vinculado : null };
    },

    /** Guarda la HUELLA del código para atar un chat (el código no se guarda). */
    async codigoTelegram(huellaCodigo, caduca) {
      await db
        .prepare(
          "insert into telegram (owner_id, codigo, caduca) values (?, ?, ?) " +
            "on conflict (owner_id) do update set codigo = excluded.codigo, caduca = excluded.caduca",
        )
        .bind(ownerId, huellaCodigo, caduca)
        .run();
    },

    async desvincularTelegram() {
      await db.prepare("delete from telegram where owner_id = ?").bind(ownerId).run();
    },

    /** Lo último que se habló con el asistente (por cualquier canal), lo más viejo primero. */
    async conversacion(n = 30) {
      const r = await db
        .prepare("select id, texto, canal, estado, resultado, error, creada from capturas where owner_id = ? order by creada desc limit ?")
        .bind(ownerId, n)
        .all();
      return (r.results ?? []).reverse().map((c) => {
        const res = c.resultado ? leerJSON(c.resultado, null) : null;
        return { id: c.id, texto: c.texto, canal: c.canal, estado: c.estado, error: c.error, creada: c.creada, tarjeta: res?.tarjeta ?? null, deshecha: Boolean(res?.deshecha), puedeDeshacer: c.estado === "ordenada" && Boolean(res?.deshacer) };
      });
    },

    /** Las últimas capturas ordenadas en `minutos`, para que el asistente siga la conversación. */
    async historial(minutos = 180, n = 6) {
      const desde = new Date(Date.now() - minutos * 60_000).toISOString();
      const r = await db
        .prepare("select id, texto, resultado from capturas where owner_id = ? and estado = 'ordenada' and creada > ? order by creada desc limit ?")
        .bind(ownerId, desde, n)
        .all();
      return (r.results ?? []).reverse().map((f) => ({ ...f, resultado: f.resultado ? leerJSON(f.resultado, null) : null }));
    },

    // ── El cerebro ──
    async cerebro() {
      const r = await db.prepare("select id, tipo, titulo, texto, sombrero, origen, usos, creado, actualizado from cerebro where owner_id = ? order by tipo, actualizado desc").bind(ownerId).all();
      return (r.results ?? []).map((x) => ({ ...x }));
    },

    sentenciaNota({ id, tipo, titulo, texto, sombrero = null, origen = "yo" }) {
      return db
        .prepare(
          "insert into cerebro (owner_id, id, tipo, titulo, texto, sombrero, origen, actualizado) values (?, ?, ?, ?, ?, ?, ?, ?) " +
            "on conflict (owner_id, id) do update set tipo = excluded.tipo, titulo = excluded.titulo, texto = excluded.texto, sombrero = excluded.sombrero, actualizado = excluded.actualizado",
        )
        .bind(ownerId, id, tipo, titulo, texto, sombrero, origen, ahora());
    },

    async guardarNota(nota) {
      await this.sentenciaNota(nota).run();
    },

    sentenciaBorrarNota(id) {
      return db.prepare("delete from cerebro where owner_id = ? and id = ?").bind(ownerId, String(id));
    },

    async borrarNota(id) {
      const r = await this.sentenciaBorrarNota(id).run();
      return (r.meta?.changes ?? 0) > 0;
    },

    /** Lo aprendido de más se va (lo menos usado y más viejo primero): el cerebro no crece sin fin. */
    async recortarAprendidos(max = MAX_APRENDIDOS) {
      await db
        .prepare(
          "delete from cerebro where owner_id = ? and tipo = 'aprendido' and id in (select id from cerebro where owner_id = ? and tipo = 'aprendido' order by usos asc, actualizado asc limit max(0, (select count(*) from cerebro where owner_id = ? and tipo = 'aprendido') - ?))",
        )
        .bind(ownerId, ownerId, ownerId, max)
        .run();
    },

    async sumarUsos(ids) {
      if (!ids?.length) return;
      await db.batch(ids.map((id) => db.prepare("update cerebro set usos = usos + 1 where owner_id = ? and id = ?").bind(ownerId, id)));
    },

    // ── Lo que ya se avisó ──
    /** Reserva un aviso antes de mandarlo: true si nadie lo había mandado (dos vueltas a la vez no lo mandan dos veces). */
    async reclamarAviso(clave) {
      const r = await db.prepare("insert or ignore into avisos_enviados (owner_id, clave) values (?, ?)").bind(ownerId, clave).run();
      return (r.meta?.changes ?? 0) > 0;
    },

    async soltarAviso(clave) {
      await db.prepare("delete from avisos_enviados where owner_id = ? and clave = ?").bind(ownerId, clave).run();
    },

    /** Borra lo hecho o soltado antes de `antesDe` (AAAA-MM-DD). Sólo aquí: no toca Google ni Juancito Ads. */
    async purgarHechas(antesDe) {
      const r = await db
        .prepare(
          // Los pasos de un proyecto con fecha que sigue activo no se borran: son su progreso.
          "delete from elementos where owner_id = ? and tipo = 'accion' and json_extract(datos, '$.estado') in ('hecha', 'soltada') and json_extract(datos, '$.hechaEl') < ? " +
            "and not exists (select 1 from elementos p where p.owner_id = elementos.owner_id and p.tipo = 'proyecto' and p.id = json_extract(elementos.datos, '$.proyectoId') " +
            "and json_extract(p.datos, '$.limite') is not null and coalesce(json_extract(p.datos, '$.estado'), 'activo') != 'terminado')",
        )
        .bind(ownerId, antesDe)
        .run();
      return r.meta?.changes ?? 0;
    },

    async purgarAvisos(dias = 21) {
      await db.prepare("delete from avisos_enviados where owner_id = ? and enviado < ?").bind(ownerId, new Date(Date.now() - dias * 86_400_000).toISOString()).run();
    },

    // ── Conexiones (Juancito Ads, Google) ──
    async conexiones() {
      const r = await db.prepare("select servicio, datos, sincronizado, error from conexiones where owner_id = ? order by servicio").bind(ownerId).all();
      return (r.results ?? []).map((c) => ({ ...c, datos: leerJSON(c.datos, {}) }));
    },

    async conexion(servicio) {
      const c = await db.prepare("select servicio, datos, sincronizado, error from conexiones where owner_id = ? and servicio = ?").bind(ownerId, servicio).first();
      return c ? { ...c, datos: leerJSON(c.datos, {}) } : null;
    },

    async guardarConexion(servicio, datos, { sincronizado, error } = {}) {
      await db
        .prepare(
          "insert into conexiones (owner_id, servicio, datos, sincronizado, error, actualizado) values (?, ?, ?, ?, ?, ?) " +
            "on conflict (owner_id, servicio) do update set datos = excluded.datos, sincronizado = coalesce(excluded.sincronizado, conexiones.sincronizado), error = excluded.error, actualizado = excluded.actualizado",
        )
        .bind(ownerId, servicio, JSON.stringify(datos), sincronizado ?? null, error ?? null, ahora())
        .run();
    },

    async marcarConexion(servicio, { sincronizado = null, error = null }) {
      await db.prepare("update conexiones set sincronizado = coalesce(?, sincronizado), error = ? where owner_id = ? and servicio = ?").bind(sincronizado, error, ownerId, servicio).run();
    },

    async borrarConexion(servicio) {
      await db.batch([
        db.prepare("delete from conexiones where owner_id = ? and servicio = ?").bind(ownerId, servicio),
        db.prepare("delete from externos where owner_id = ? and fuente = ?").bind(ownerId, servicio),
      ]);
    },

    // ── El «state» de un permiso a medio dar ──
    async crearPendiente({ estadoHash, servicio, verificador, caduca }) {
      await db.prepare("insert into oauth_pendientes (estado_hash, owner_id, servicio, verificador, caduca) values (?, ?, ?, ?, ?)").bind(estadoHash, ownerId, servicio, verificador, caduca).run();
    },

    /** Lee y BORRA (sirve una vez); null si no es de esta persona o caducó. */
    async tomarPendiente(estadoHash) {
      const f = await db.prepare("select servicio, verificador, caduca from oauth_pendientes where owner_id = ? and estado_hash = ?").bind(ownerId, estadoHash).first();
      await db.prepare("delete from oauth_pendientes where owner_id = ? and (estado_hash = ? or caduca < ?)").bind(ownerId, estadoHash, ahora()).run();
      return f && f.caduca > ahora() ? { servicio: f.servicio, verificador: f.verificador } : null;
    },

    // ── Lo leído de Google Calendar ──
    async externosEntre(desde, hasta) {
      const r = await db.prepare("select fuente, id, tipo, dia, datos from externos where owner_id = ? and dia >= ? and dia <= ? order by dia").bind(ownerId, desde, hasta).all();
      return (r.results ?? []).map((x) => ({ ...leerJSON(x.datos, {}), fuente: x.fuente, id: x.id, tipo: x.tipo, dia: x.dia }));
    },

    /** Repone lo de una fuente en un rango: borra lo que había y escribe lo nuevo, de una vez. */
    async reemplazarExternos(fuente, { desde, hasta }, filas) {
      await db.batch([
        db.prepare("delete from externos where owner_id = ? and fuente = ? and dia >= ? and dia <= ?").bind(ownerId, fuente, desde, hasta),
        ...filas.map((x) =>
          db
            .prepare("insert or replace into externos (owner_id, fuente, id, tipo, dia, datos) values (?, ?, ?, ?, ?, ?)")
            .bind(ownerId, fuente, String(x.id), x.tipo ?? "evento", x.dia, JSON.stringify(x)),
        ),
      ]);
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
