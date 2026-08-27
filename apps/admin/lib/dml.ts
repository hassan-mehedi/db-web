import { withClient } from "@db-web/db";
import { quoteIdent, quoteQualified } from "@db-web/sql";
import type { Cell } from "./format";

export type RowKey = Record<string, Cell>;

const IDENT = /^[^\0]{1,63}$/;

function ident(name: string): string {
  if (!IDENT.test(name)) throw new Error(`invalid identifier: ${name}`);
  return quoteIdent(name);
}

function whereKey(key: RowKey, offset: number): { text: string; values: Cell[] } {
  const entries = Object.entries(key);
  if (entries.length === 0) throw new Error("table has no primary key");
  const parts = entries.map(([col, v], i) =>
    v === null ? `${ident(col)} IS NULL` : `${ident(col)} = $${offset + i}`,
  );
  return { text: parts.join(" AND "), values: entries.map(([, v]) => v).filter((v) => v !== null) };
}

export interface Rel {
  database: string;
  schema: string;
  table: string;
}

export async function updateRow(rel: Rel, key: RowKey, changes: Record<string, Cell>) {
  const cols = Object.entries(changes);
  if (cols.length === 0) throw new Error("nothing to update");
  const set = cols.map(([c], i) => `${ident(c)} = $${i + 1}`).join(", ");
  const where = whereKey(key, cols.length + 1);
  const text = `UPDATE ${quoteQualified(rel.schema, rel.table)} SET ${set} WHERE ${where.text}`;
  const values = [...cols.map(([, v]) => v), ...where.values];
  return withClient(rel.database, async (c) => {
    const r = await c.query(text, values);
    if (r.rowCount !== 1) throw new Error(`expected 1 row, matched ${r.rowCount}`);
    return text;
  });
}

export interface RowChange {
  key: RowKey;
  values: Record<string, Cell>;
}

export function updateStatement(rel: Rel, change: RowChange) {
  const cols = Object.entries(change.values);
  if (cols.length === 0) throw new Error("nothing to update");
  const set = cols.map(([c], i) => `${ident(c)} = $${i + 1}`).join(", ");
  const where = whereKey(change.key, cols.length + 1);
  return {
    text: `UPDATE ${quoteQualified(rel.schema, rel.table)} SET ${set} WHERE ${where.text}`,
    values: [...cols.map(([, v]) => v), ...where.values],
  };
}

export async function updateRows(rel: Rel, changes: RowChange[]) {
  if (changes.length === 0) throw new Error("nothing to update");
  return withClient(rel.database, async (c) => {
    await c.query("BEGIN");
    try {
      const statements: string[] = [];
      for (const change of changes) {
        const { text, values } = updateStatement(rel, change);
        const r = await c.query(text, values);
        if (r.rowCount !== 1) throw new Error(`expected 1 row, matched ${r.rowCount}`);
        statements.push(text);
      }
      await c.query("COMMIT");
      return statements.join(";\n");
    } catch (err) {
      await c.query("ROLLBACK");
      throw err;
    }
  });
}

export async function insertRow(rel: Rel, values: Record<string, Cell>) {
  const cols = Object.entries(values);
  const text =
    cols.length === 0
      ? `INSERT INTO ${quoteQualified(rel.schema, rel.table)} DEFAULT VALUES`
      : `INSERT INTO ${quoteQualified(rel.schema, rel.table)} (${cols.map(([c]) => ident(c)).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`;
  return withClient(rel.database, async (c) => {
    await c.query(
      text,
      cols.map(([, v]) => v),
    );
    return text;
  });
}

export async function deleteRows(rel: Rel, keys: RowKey[]) {
  if (keys.length === 0) throw new Error("nothing to delete");
  return withClient(rel.database, async (c) => {
    await c.query("BEGIN");
    try {
      const statements: string[] = [];
      for (const key of keys) {
        const where = whereKey(key, 1);
        const text = `DELETE FROM ${quoteQualified(rel.schema, rel.table)} WHERE ${where.text}`;
        const r = await c.query(text, where.values);
        if (r.rowCount !== 1) throw new Error(`expected 1 row, matched ${r.rowCount}`);
        statements.push(text);
      }
      await c.query("COMMIT");
      return statements.join(";\n");
    } catch (err) {
      await c.query("ROLLBACK");
      throw err;
    }
  });
}
