import { maintenancePool, poolFor, withClient } from "@db-web/db";
import {
  completionSchema,
  databaseAccess,
  databaseSizes,
  type Filter,
  filterWhere,
  listAllTables,
  listColumns,
  listConstraints,
  listDatabaseNames,
  listDatabasesWithConnections,
  listIndexes,
  listPolicies,
  listSchemas,
  listTriggers,
  orderBy,
  quoteIdent,
  quoteQualified,
  rowSecurity,
  type Sort,
  singleColumnForeignKeys,
  tableDependencies,
  tableStats,
} from "@db-web/sql";
import { cache } from "react";
import { type Cell, formatRows } from "./format";
import { latestSizes } from "./metrics";
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
  is_identity: "YES" | "NO";
  identity_generation: "ALWAYS" | "BY DEFAULT" | null;
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
export interface ForeignKeyRow {
  column: string;
  refSchema: string;
  refTable: string;
  refColumn: string;
}

export const getDatabaseNames = cache(
  (): Promise<string[]> =>
    timed("database-names", async () => {
      const { rows } = await maintenancePool().query<{ datname: string }>(listDatabaseNames);
      return rows.map((r) => r.datname);
    }),
);

export const getDatabases = cache(
  (): Promise<DatabaseRow[]> =>
    timed("databases", async () => {
      const [{ rows }, sampled] = await Promise.all([
        maintenancePool().query<{ datname: string; connections: number }>(
          listDatabasesWithConnections,
        ),
        latestSizes(),
      ]);
      const missing = rows.filter((r) => !sampled.has(r.datname)).map((r) => r.datname);
      const sizes = new Map(sampled);
      if (missing.length) {
        const fresh = await maintenancePool().query<{ datname: string; size_bytes: string }>(
          databaseSizes,
          [missing],
        );
        for (const r of fresh.rows) sizes.set(r.datname, Number(r.size_bytes));
      }
      return rows.map((r) => {
        const bytes = sizes.get(r.datname) ?? 0;
        return {
          datname: r.datname,
          size: prettyBytes(bytes),
          size_bytes: String(bytes),
          connections: r.connections,
        };
      });
    }),
);

export function prettyBytes(n: number): string {
  if (n < 1024) return `${n} bytes`;
  const units = ["kB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

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
      const rel = quoteQualified(schema, table);
      const [columns, constraints, indexes, fks] = await Promise.all([
        c.query<ColumnRow>(listColumns, [schema, table]),
        c.query<ConstraintRow>(listConstraints, [rel]),
        c.query<IndexRow>(listIndexes, [schema, table]),
        c.query<ForeignKeyRow>(singleColumnForeignKeys, [[rel]]),
      ]);
      return {
        columns: columns.rows,
        constraints: constraints.rows,
        indexes: indexes.rows,
        foreignKeys: fks.rows.map(({ column, refSchema, refTable, refColumn }) => ({
          column,
          refSchema,
          refTable,
          refColumn,
        })),
      };
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

export interface TableDataOptions {
  after?: string[] | undefined;
  before?: string[] | undefined;
  page?: number | undefined;
  exact?: boolean | undefined;
  sort?: Sort | null | undefined;
  filters?: Filter[] | undefined;
}

export interface TableData {
  columns: string[];
  rows: Cell[][];
  primaryKey: string[];
  total: number | null;
  estimated: boolean;
  hasNext: boolean;
  hasPrev: boolean;
  firstKey: string[] | null;
  lastKey: string[] | null;
}

export async function getTableData(
  database: string,
  schema: string,
  table: string,
  opts: TableDataOptions = {},
): Promise<TableData> {
  return timed("table-data", () =>
    withClient(database, async (c) => {
      const rel = quoteQualified(schema, table);
      const pk = (await c.query<{ attname: string }>(primaryKeyColumns, [rel])).rows.map(
        (r) => r.attname,
      );
      const filters = opts.filters ?? [];
      const sort = opts.sort ?? null;
      const exact = opts.exact || filters.length > 0;
      const filtered = filterWhere(filters, 1);
      const countSql = exact
        ? `SELECT count(*)::text AS n FROM ${rel} ${filtered.sql}`
        : "SELECT reltuples::bigint::text AS n FROM pg_class WHERE oid = $1::regclass";
      const countPromise = c.query<{ n: string }>(countSql, exact ? filtered.params : [rel]);

      if (pk.length === 0 || sort || filters.length > 0) {
        const page = opts.page ?? 0;
        const n = filtered.params.length;
        const [data, count] = await Promise.all([
          c.query({
            text: `SELECT * FROM ${rel} ${filtered.sql} ${orderBy(sort, pk)} LIMIT $${n + 1} OFFSET $${n + 2}`,
            values: [...filtered.params, PAGE_SIZE + 1, page * PAGE_SIZE],
            rowMode: "array",
          }),
          countPromise,
        ]);
        const rows = data.rows as unknown[][];
        const empty = rows.length === 0 && page === 0;
        return {
          columns: data.fields.map((f) => f.name),
          rows: formatRows(rows.slice(0, PAGE_SIZE)),
          primaryKey: pk,
          total: empty ? 0 : totalOf(count.rows[0]?.n, exact),
          estimated: !exact && !empty,
          hasNext: rows.length > PAGE_SIZE,
          hasPrev: page > 0,
          firstKey: null,
          lastKey: null,
        };
      }

      const keyCols = pk.map(quoteIdent).join(", ");
      const cursor = opts.after ?? opts.before;
      const backwards = !opts.after && !!opts.before;
      const params: unknown[] = [PAGE_SIZE + 1];
      let where = "";
      if (cursor && cursor.length === pk.length) {
        const placeholders = cursor.map((_, i) => `$${i + 2}`).join(", ");
        where = `WHERE (${keyCols}) ${backwards ? "<" : ">"} (${placeholders})`;
        params.push(...cursor);
      }
      const keyText = pk.map((k, i) => `${quoteIdent(k)}::text AS __k${i}`).join(", ");
      const order = `ORDER BY ${pk.map((k) => `${quoteIdent(k)}${backwards ? " DESC" : ""}`).join(", ")}`;
      const [data, count] = await Promise.all([
        c.query({
          text: `SELECT t.*, ${keyText} FROM ${rel} t ${where} ${order} LIMIT $1`,
          values: params,
          rowMode: "array",
        }),
        countPromise,
      ]);
      const width = data.fields.length - pk.length;
      let rows = data.rows as unknown[][];
      const more = rows.length > PAGE_SIZE;
      rows = rows.slice(0, PAGE_SIZE);
      if (backwards) rows.reverse();
      const keyOf = (row: unknown[]) => row.slice(width).map((v) => String(v));
      const first = rows[0];
      const last = rows.at(-1);
      const empty = rows.length === 0 && !cursor;
      return {
        columns: data.fields.slice(0, width).map((f) => f.name),
        rows: formatRows(rows.map((r) => r.slice(0, width))),
        primaryKey: pk,
        total: empty ? 0 : totalOf(count.rows[0]?.n, opts.exact),
        estimated: !opts.exact && !empty,
        hasNext: backwards ? true : more,
        hasPrev: backwards ? more : !!opts.after,
        firstKey: first ? keyOf(first) : null,
        lastKey: last ? keyOf(last) : null,
      };
    }),
  );
}

function totalOf(n: string | undefined, exact: boolean | undefined): number | null {
  const v = Number(n ?? -1);
  if (exact) return Math.max(0, v);
  return v < 0 ? null : v;
}

export interface DatabaseAccess {
  owner: string;
  user: string;
  canCreateInPublic: boolean;
}

export function getDatabaseAccess(database: string): Promise<DatabaseAccess> {
  return timed("access", async () => {
    const { rows } = await poolFor(database).query<DatabaseAccess>(databaseAccess);
    return rows[0] ?? { owner: "?", user: "?", canCreateInPublic: false };
  });
}

export type CompletionSchema = Record<string, Record<string, string[]>>;

export function getCompletionSchema(database: string): Promise<CompletionSchema> {
  return timed("completion", async () => {
    const { rows } = await poolFor(database).query<{
      schema: string;
      table: string;
      columns: string[];
    }>(completionSchema);
    const out: CompletionSchema = {};
    for (const r of rows) {
      const tables = out[r.schema] ?? {};
      tables[r.table] = r.columns;
      out[r.schema] = tables;
    }
    return out;
  });
}

export interface TriggerRow {
  name: string;
  enabled: boolean;
  definition: string;
}

export interface PolicyRow {
  name: string;
  cmd: string;
  permissive: boolean;
  roles: string[];
  using: string | null;
  withCheck: string | null;
}

export interface DependencyRow {
  kind: "fk" | "view" | "matview";
  schema: string;
  name: string;
  detail: string | null;
}

export interface TableStatsRow {
  live: string;
  dead: string;
  seq_scan: string;
  idx_scan: string;
  last_vacuum: string | null;
  last_autovacuum: string | null;
  last_analyze: string | null;
  last_autoanalyze: string | null;
  total_bytes: string;
  table_bytes: string;
  index_bytes: string;
}

export async function getTableExtras(database: string, schema: string, table: string) {
  return timed("table-extras", () =>
    withClient(database, async (c) => {
      const rel = quoteQualified(schema, table);
      const [triggers, policies, rls, deps, stats] = await Promise.all([
        c.query<TriggerRow>(listTriggers, [rel]),
        c.query<PolicyRow>(listPolicies, [schema, table]),
        c.query<{ enabled: boolean; forced: boolean }>(rowSecurity, [rel]),
        c.query<DependencyRow>(tableDependencies, [rel]),
        c.query<TableStatsRow>(tableStats, [rel]),
      ]);
      return {
        triggers: triggers.rows,
        policies: policies.rows,
        rowSecurity: rls.rows[0] ?? { enabled: false, forced: false },
        dependencies: deps.rows,
        stats: stats.rows[0] ?? null,
      };
    }),
  );
}
