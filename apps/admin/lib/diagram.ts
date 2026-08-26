import { withClient } from "@db-web/db";

export interface DiagramTable {
  schema: string;
  name: string;
  columns: { name: string; type: string; pk: boolean }[];
}
export interface DiagramEdge {
  from: { schema: string; table: string; columns: string[] };
  to: { schema: string; table: string; columns: string[] };
  name: string;
}

const tablesSql = `
SELECT n.nspname AS schema, c.relname AS name,
       a.attname AS column, format_type(a.atttypid, a.atttypmod) AS type,
       COALESCE((SELECT true FROM pg_index i WHERE i.indrelid = c.oid AND i.indisprimary AND a.attnum = ANY(i.indkey)), false) AS pk
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE c.relkind IN ('r','p') AND n.nspname NOT LIKE 'pg\\_%' AND n.nspname <> 'information_schema'
ORDER BY n.nspname, c.relname, a.attnum`;

const edgesSql = `
SELECT con.conname AS name,
       ns.nspname AS from_schema, src.relname AS from_table,
       ARRAY(SELECT a.attname FROM unnest(con.conkey) k JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k) AS from_columns,
       nt.nspname AS to_schema, tgt.relname AS to_table,
       ARRAY(SELECT a.attname FROM unnest(con.confkey) k JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k) AS to_columns
FROM pg_constraint con
JOIN pg_class src ON src.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = src.relnamespace
JOIN pg_class tgt ON tgt.oid = con.confrelid
JOIN pg_namespace nt ON nt.oid = tgt.relnamespace
WHERE con.contype = 'f'`;

export async function getDiagram(database: string) {
  return withClient(database, async (c) => {
    const t = await c.query<{
      schema: string;
      name: string;
      column: string;
      type: string;
      pk: boolean;
    }>(tablesSql);
    const tables = new Map<string, DiagramTable>();
    for (const r of t.rows) {
      const key = `${r.schema}.${r.name}`;
      const entry = tables.get(key) ?? { schema: r.schema, name: r.name, columns: [] };
      entry.columns.push({ name: r.column, type: r.type, pk: r.pk });
      tables.set(key, entry);
    }
    const e = await c.query<{
      name: string;
      from_schema: string;
      from_table: string;
      from_columns: string[];
      to_schema: string;
      to_table: string;
      to_columns: string[];
    }>(edgesSql);
    const edges: DiagramEdge[] = e.rows.map((r) => ({
      name: r.name,
      from: { schema: r.from_schema, table: r.from_table, columns: r.from_columns },
      to: { schema: r.to_schema, table: r.to_table, columns: r.to_columns },
    }));
    return { tables: [...tables.values()], edges };
  });
}
