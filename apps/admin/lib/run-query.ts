import { poolFor } from "@db-web/db";
import type { FieldDef, PoolClient, QueryResult } from "pg";
import Cursor from "pg-cursor";
import { type Cell, formatRows } from "./format";

export interface ResultSource {
  schema: string;
  table: string;
  primaryKey: string[];
  columns: (string | null)[];
}

export interface QueryOutcome {
  columns: string[];
  rows: Cell[][];
  truncated: boolean;
  rowCount: number | null;
  command: string | null;
  durationMs: number;
  source: ResultSource | null;
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

const relationInfo = `
SELECT n.nspname AS schema, c.relname AS table,
  (SELECT array_agg(a.attnum ORDER BY a.attnum) FROM pg_attribute a
     WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS attnums,
  (SELECT array_agg(a.attname::text ORDER BY a.attnum) FROM pg_attribute a
     WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS attnames,
  (SELECT i.indkey::int[] FROM pg_index i WHERE i.indrelid = c.oid AND i.indisprimary) AS pk
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.oid = $1 AND c.relkind IN ('r', 'p')`;

interface RelationInfoRow {
  schema: string;
  table: string;
  attnums: number[];
  attnames: string[];
  pk: number[] | null;
}

async function resolveSource(client: PoolClient, fields: FieldDef[]): Promise<ResultSource | null> {
  const tables = new Set(fields.map((f) => f.tableID).filter((id) => id !== 0));
  if (tables.size !== 1) return null;
  const [oid] = tables;
  const { rows } = await client.query<RelationInfoRow>(relationInfo, [oid]);
  const info = rows[0];
  if (!info?.pk || info.pk.length === 0) return null;
  const names = new Map(info.attnums.map((n, i) => [n, info.attnames[i] ?? null]));
  const columns = fields.map((f) => (f.tableID === oid ? (names.get(f.columnID) ?? null) : null));
  const primaryKey = info.pk.map((n) => names.get(n) ?? null);
  if (primaryKey.some((k) => k === null || !columns.includes(k))) return null;
  return { schema: info.schema, table: info.table, primaryKey: primaryKey as string[], columns };
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
      let read: { rows: unknown[][]; fields: FieldDef[] };
      try {
        read = await readCursor(cursor, limit + 1);
      } finally {
        await cursor.close();
      }
      const { rows, fields } = read;
      const truncated = rows.length > limit;
      const source = await resolveSource(client, fields).catch(() => null);
      return {
        columns: fields.map((f) => f.name),
        rows: formatRows(truncated ? rows.slice(0, limit) : rows),
        truncated,
        rowCount: null,
        command: null,
        durationMs: Math.round(performance.now() - started),
        source,
      };
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
      source: null,
    };
  } finally {
    client.release();
  }
}
