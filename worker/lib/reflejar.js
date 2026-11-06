// ============================================================
// Reflejar un cambio en Juancito Ads y en Google
//
// Un solo sitio para que todo esté conectado, venga el cambio de donde venga
// (el asistente, la pantalla, Telegram, Claude):
//
//   · una ACCIÓN del sombrero de Juancito Ads: se crea allá; hecha aquí, hecha
//     allá. (Allá no se puede borrar ni reabrir desde aquí: el MCP del
//     calendario no lo ofrece. Borrarla aquí la marca hecha allá.)
//   · una ACCIÓN de un sombrero que va a Google Tasks: se crea, se cambia, se
//     completa, se reabre y se borra allá.
//   · un EVENTO de un sombrero que va a Google Calendar: lo mismo.
//
// Lo que falla aquí NO deshace lo de aquí: la agenda es la verdad, y la vuelta
// del cron vuelve a intentar subir lo que no llegó.
// Devuelve las acciones y eventos que hay que volver a guardar (con su id de
// allá).
// ============================================================

import * as juancito from "./juancito.js";
import * as google from "./google.js";
import { sombrerosDe } from "../../src/lib/sombreros.js";

const CAMPOS_TAREA = ["titulo", "notas", "cuando", "limite", "hora"];
const CAMPOS_EVENTO = ["titulo", "notas", "fecha", "inicio", "fin", "clase"];
const cambio = (a, b, campos) => campos.some((k) => (a?.[k] ?? null) !== (b?.[k] ?? null));

/**
 * cambios: [{ tipo: "accion" | "evento", antes, despues }] (antes null = nuevo; despues null = borrado).
 * Devuelve { guardar: [{ tipo, obj }], errores: [texto] }.
 */
export async function reflejar(env, almacen, cambios, { hoy, ajustes }) {
  const guardar = [];
  const errores = [];
  if (!cambios?.length) return { guardar, errores };
  const sombreroJ = juancito.sombreroDeJuancito(ajustes);
  const conJuancito = sombreroJ && cambios.some((c) => (c.despues ?? c.antes)?.sombrero === sombreroJ) ? await juancito.conectada(almacen) : false;
  const cuentasG = google.hayGoogle(env) ? await google.cuentas(almacen) : [];
  const sombreros = sombrerosDe(ajustes);

  for (const { tipo, antes, despues } of cambios) {
    try {
      if (tipo === "accion") {
        const a = despues ?? antes;
        const esJ = a.sombrero === sombreroJ && sombreros.some((s) => s.id === sombreroJ);
        if (esJ && conJuancito) {
          if (despues && !despues.juancito?.id && !antes && despues.estado === "abierta") {
            guardar.push({ tipo, obj: { ...despues, juancito: { id: await juancito.crearTarea(env, almacen, despues, hoy) } } });
          } else if (a.juancito?.id && ((despues?.estado === "hecha" && antes?.estado !== "hecha") || (!despues && antes?.estado === "abierta"))) {
            await juancito.completarTarea(env, almacen, a.juancito.id);
          }
          continue;
        }
        if (!cuentasG.length || esJ) continue;
        if (!despues && antes?.google?.id) await google.borrarTarea(env, almacen, antes);
        else if (despues && !despues.google?.id && !antes && despues.estado === "abierta" && despues.lista === "siguientes") {
          const g = await google.crearTarea(env, almacen, despues, cuentasG);
          if (g) guardar.push({ tipo, obj: { ...despues, google: g } });
        } else if (despues?.google?.id && (cambio(antes, despues, CAMPOS_TAREA) || antes?.estado !== despues.estado)) {
          await google.actualizarTarea(env, almacen, despues);
        }
      } else if (tipo === "evento") {
        if (!cuentasG.length) continue;
        if (!despues && antes?.google?.id) await google.borrarEvento(env, almacen, antes);
        else if (despues && !despues.google?.id && !antes && despues.fuente !== "google") {
          const g = await google.crearEvento(env, almacen, despues, cuentasG);
          if (g) guardar.push({ tipo, obj: { ...despues, google: g } });
        } else if (despues?.google?.id && cambio(antes, despues, CAMPOS_EVENTO)) {
          await google.actualizarEvento(env, almacen, despues);
        }
      }
    } catch (e) {
      errores.push(e.message);
    }
  }
  if (guardar.length) await almacen.lote(guardar.map(({ tipo, obj }) => almacen.sentenciaElemento(tipo, obj)));
  return { guardar, errores };
}
