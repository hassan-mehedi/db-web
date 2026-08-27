import { meta } from "./meta-db";

const KEEP_PER_DATABASE = 500;

export interface HistoryEntry {
  id: string;
  sql: string;
  row_count: number | null;
  duration_ms: number;
  error: string | null;
  ran_at: string;
}

export async function recordQuery(input: {
  database: string;
  sql: string;
  rowCount: number | null;
  durationMs: number;
  error: string | null;
}): Promise<void> {
  const m = await meta();
  await m.query(
    "INSERT INTO query_history (database, sql, row_count, duration_ms, error) VALUES ($1,$2,$3,$4,$5)",
    [input.database, input.sql, input.rowCount, input.durationMs, input.error],
  );
  await m.query(
    `DELETE FROM query_history WHERE database = $1 AND id NOT IN (
       SELECT id FROM query_history WHERE database = $1 ORDER BY ran_at DESC LIMIT $2)`,
    [input.database, KEEP_PER_DATABASE],
  );
}

export async function listHistory(database: string, limit = 50): Promise<HistoryEntry[]> {
  const m = await meta();
  const { rows } = await m.query<HistoryEntry>(
    `SELECT id::text, sql, row_count, duration_ms, error, ran_at::text
     FROM query_history WHERE database = $1 ORDER BY ran_at DESC LIMIT $2`,
    [database, limit],
  );
  return rows;
}

export async function clearHistory(database: string): Promise<void> {
  await (await meta()).query("DELETE FROM query_history WHERE database = $1", [database]);
}
