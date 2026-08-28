import { type PoolClient, poolFor } from "@db-web/db";
import { type Filter, filterWhere, orderBy, quoteQualified, type Sort } from "@db-web/sql";
import Cursor from "pg-cursor";
import { csvLine } from "./csv";
import { formatRows } from "./format";

const BATCH = 1000;

function read(cursor: Cursor, n: number): Promise<{ rows: unknown[][]; fields: string[] }> {
  return new Promise((resolve, reject) => {
    cursor.read(n, (err, rows, result) => {
      if (err) reject(err);
      else resolve({ rows: rows as unknown[][], fields: (result.fields ?? []).map((f) => f.name) });
    });
  });
}

export function tableCsvStream(
  database: string,
  schema: string,
  table: string,
  filters: Filter[],
  sort: Sort | null,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const where = filterWhere(filters, 1);
  const sql = `SELECT * FROM ${quoteQualified(schema, table)} ${where.sql} ${orderBy(sort, [])}`;
  let client: PoolClient | null = null;
  let cursor: Cursor | null = null;
  let headerSent = false;

  const close = async () => {
    const c = client;
    const cur = cursor;
    cursor = null;
    client = null;
    if (cur) await cur.close().catch(() => undefined);
    c?.release();
  };

  return new ReadableStream<Uint8Array>({
    async start() {
      const c = await poolFor(database).connect();
      client = c;
      cursor = c.query(new Cursor(sql, where.params, { rowMode: "array" }));
    },
    async pull(controller) {
      if (!cursor) return controller.close();
      try {
        const { rows, fields } = await read(cursor, BATCH);
        let chunk = "";
        if (!headerSent) {
          chunk += csvLine(fields);
          headerSent = true;
        }
        for (const row of formatRows(rows)) chunk += csvLine(row);
        if (chunk) controller.enqueue(encoder.encode(chunk));
        if (rows.length < BATCH) {
          await close();
          controller.close();
        }
      } catch (err) {
        await close();
        controller.error(err);
      }
    },
    cancel: close,
  });
}
