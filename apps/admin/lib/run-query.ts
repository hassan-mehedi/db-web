import { poolFor } from "@db-web/db";
import type { FieldDef, QueryResult } from "pg";
import Cursor from "pg-cursor";
import { type Cell, formatRows } from "./format";

export interface QueryOutcome {
  columns: string[];
  rows: Cell[][];
  truncated: boolean;
  rowCount: number | null;
  command: string | null;
  durationMs: number;
}

const RETURNS_ROWS = /^\s*(select|with|values|table|show|explain|returning)\b/i;

function readCursor(
  cursor: Cursor,
  limit: number,
): Promise<{ rows: unknown[][]; fields: FieldDef[] }> {
  return new Promise((resolve, reject) => {
    cursor.read(limit, (err, rows, result: QueryResult) => {
      if (err) reject(err);
      else resolve({ rows: rows as unknown[][], fields: result.fields ?? [] });
    });
  });
}

export async function runQuery(
  database: string,
  sql: string,
  limit: number,
): Promise<QueryOutcome> {
  const started = performance.now();
  const client = await poolFor(database).connect();
  try {
    if (
      RETURNS_ROWS.test(sql) &&
      !sql
        .trim()
        .replace(/;+\s*$/, "")
        .includes(";")
    ) {
      const cursor = client.query(new Cursor(sql.replace(/;+\s*$/, ""), [], { rowMode: "array" }));
      try {
        const { rows, fields } = await readCursor(cursor, limit + 1);
        const truncated = rows.length > limit;
        return {
          columns: fields.map((f) => f.name),
          rows: formatRows(truncated ? rows.slice(0, limit) : rows),
          truncated,
          rowCount: null,
          command: null,
          durationMs: Math.round(performance.now() - started),
        };
      } finally {
        await cursor.close();
      }
    }
    const result = await client.query({ text: sql, rowMode: "array" });
    const last = Array.isArray(result) ? result[result.length - 1] : result;
    return {
      columns: last?.fields?.map((f: FieldDef) => f.name) ?? [],
      rows: formatRows(((last?.rows ?? []) as unknown[][]).slice(0, limit)),
      truncated: (last?.rows?.length ?? 0) > limit,
      rowCount: last?.rowCount ?? null,
      command: last?.command ?? null,
      durationMs: Math.round(performance.now() - started),
    };
  } finally {
    client.release();
  }
}
