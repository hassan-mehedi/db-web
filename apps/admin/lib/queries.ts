import { maintenancePool, withClient } from "@db-web/db";
import {
  listAllTables,
  listColumns,
  listConstraints,
  listDatabases,
  listIndexes,
  listSchemas,
  quoteIdent,
  quoteQualified,
} from "@db-web/sql";
import { cache } from "react";
import { type Cell, formatRows } from "./format";
import { timed } from "./timing";

export interface DatabaseRow {
  datname: string;
  size: string;
  size_bytes: string;
  connections: number;
}
export interface TableRow {
  relname: string;
  nspname: string;
  est_rows: string;
  size: string;
}
export interface ColumnRow {
  column_name: string;
  data_type: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
}
export interface ConstraintRow {
  conname: string;
  contype: string;
  definition: string;
}
export interface IndexRow {
  indexname: string;
  indexdef: string;
}

export const getDatabases = cache(
  (): Promise<DatabaseRow[]> =>
    timed("databases", async () => {
      const { rows } = await maintenancePool().query<DatabaseRow>(listDatabases);
      return rows;
    }),
);

export async function getSchemasWithTables(database: string) {
  return timed("tables", () =>
    withClient(database, async (c) => {
      const [schemas, tables] = await Promise.all([
        c.query<{ nspname: string }>(listSchemas),
        c.query<TableRow>(listAllTables),
      ]);
      return schemas.rows.map(({ nspname }) => ({
        schema: nspname,
        tables: tables.rows.filter((t) => t.nspname === nspname),
      }));
    }),
  );
}

export async function getTableDetails(database: string, schema: string, table: string) {
  return timed("table-details", () =>
    withClient(database, async (c) => {
      const [columns, constraints, indexes] = await Promise.all([
        c.query<ColumnRow>(listColumns, [schema, table]),
        c.query<ConstraintRow>(listConstraints, [quoteQualified(schema, table)]),
        c.query<IndexRow>(listIndexes, [schema, table]),
      ]);
      return { columns: columns.rows, constraints: constraints.rows, indexes: indexes.rows };
    }),
  );
}

export const PAGE_SIZE = 50;

const primaryKeyColumns = `
SELECT a.attname
FROM pg_index i
JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
WHERE i.indrelid = $1::regclass AND i.indisprimary
ORDER BY array_position(i.indkey, a.attnum)`;

export async function getTableData(
  database: string,
  schema: string,
  table: string,
  page: number,
): Promise<{ columns: string[]; rows: Cell[][]; total: number; primaryKey: string[] }> {
  return timed("table-data", () =>
    withClient(database, async (c) => {
      const rel = quoteQualified(schema, table);
      const pk = (await c.query<{ attname: string }>(primaryKeyColumns, [rel])).rows.map(
        (r) => r.attname,
      );
      const orderBy = pk.length ? `ORDER BY ${pk.map(quoteIdent).join(", ")}` : "";
      const [data, count] = await Promise.all([
        c.query({
          text: `SELECT * FROM ${rel} ${orderBy} LIMIT $1 OFFSET $2`,
          values: [PAGE_SIZE, page * PAGE_SIZE],
          rowMode: "array",
        }),
        c.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${rel}`),
      ]);
      return {
        columns: data.fields.map((f) => f.name),
        rows: formatRows(data.rows as unknown[][]),
        total: Number(count.rows[0]?.n ?? 0),
        primaryKey: pk,
      };
    }),
  );
}
