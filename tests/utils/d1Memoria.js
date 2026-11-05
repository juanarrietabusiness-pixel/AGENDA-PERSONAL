// Una D1 de verdad para las pruebas: SQLite de Node con las migraciones del repositorio.
// Así se prueba que las consultas EXISTEN en el esquema, que un doble a mano no ve.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(import.meta.dirname, "..", "..", "migraciones", "d1");

export function d1EnMemoria() {
  const db = new DatabaseSync(":memory:");
  db.exec("pragma foreign_keys = on");
  for (const f of readdirSync(DIR).filter((x) => x.endsWith(".sql")).sort()) db.exec(readFileSync(join(DIR, f), "utf8"));
  const sentencia = (sql, valores = []) => ({
    bind: (...v) => sentencia(sql, v),
    async all() {
      return { results: db.prepare(sql).all(...valores) };
    },
    async first(col) {
      const fila = db.prepare(sql).get(...valores);
      if (!fila) return null;
      return col ? (fila[col] ?? null) : { ...fila };
    },
    async run() {
      const info = db.prepare(sql).run(...valores);
      return { meta: { changes: Number(info.changes) } };
    },
  });
  return {
    prepare: (sql) => sentencia(sql),
    async batch(lista) {
      db.exec("begin");
      try {
        const out = [];
        for (const s of lista) out.push(await s.run());
        db.exec("commit");
        return out;
      } catch (e) {
        db.exec("rollback");
        throw e;
      }
    },
    crudo: db,
  };
}
