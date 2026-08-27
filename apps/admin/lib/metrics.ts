import { maintenancePool } from "@db-web/db";
import { databaseStats, hasStatStatements, listActivity, topStatements } from "@db-web/sql";
import { meta } from "./meta-db";

const RETENTION = "7 days";
const TOP_STATEMENTS = 20;

interface StatRow {
  datname: string;
  numbackends: number;
  xact_commit: string;
  xact_rollback: string;
  blks_read: string;
  blks_hit: string;
  tup_returned: string;
  tup_fetched: string;
  tup_inserted: string;
  tup_updated: string;
  tup_deleted: string;
  deadlocks: string;
  size_bytes: string;
}

interface StatementRow {
  datname: string;
  queryid: string;
  query: string;
  calls: string;
  total_exec_time: number;
  mean_exec_time: number;
  rows: string;
}

export async function statStatementsAvailable(): Promise<boolean> {
  const { rows } = await maintenancePool().query<{ n: number }>(hasStatStatements);
  return (rows[0]?.n ?? 0) > 0;
}

export async function sampleOnce(): Promise<{ databases: number; statements: number }> {
  const pool = maintenancePool();
  const m = await meta();
  const ts = new Date();
  const stats = (await pool.query<StatRow>(databaseStats)).rows;
  for (const r of stats) {
    await m.query(
      `INSERT INTO metric_sample (ts, database, connections, xact_commit, xact_rollback, blks_hit,
         blks_read, tup_returned, tup_fetched, tup_inserted, tup_updated, tup_deleted, deadlocks, size_bytes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT DO NOTHING`,
      [
        ts,
        r.datname,
        r.numbackends,
        r.xact_commit,
        r.xact_rollback,
        r.blks_hit,
        r.blks_read,
        r.tup_returned,
        r.tup_fetched,
        r.tup_inserted,
        r.tup_updated,
        r.tup_deleted,
        r.deadlocks,
        r.size_bytes,
      ],
    );
  }
  let statements = 0;
  if (await statStatementsAvailable()) {
    const rows = (await pool.query<StatementRow>(topStatements, [TOP_STATEMENTS])).rows;
    for (const s of rows) {
      await m.query(
        `INSERT INTO statement_sample (ts, database, queryid, query, calls, total_exec_time, mean_exec_time, rows)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
        [ts, s.datname, s.queryid, s.query, s.calls, s.total_exec_time, s.mean_exec_time, s.rows],
      );
    }
    statements = rows.length;
  }
  await m.query(`DELETE FROM metric_sample WHERE ts < now() - interval '${RETENTION}'`);
  await m.query(`DELETE FROM statement_sample WHERE ts < now() - interval '${RETENTION}'`);
  return { databases: stats.length, statements };
}

export type Window = "1h" | "24h" | "7d";
export const WINDOWS: Window[] = ["1h", "24h", "7d"];
const WINDOW_INTERVAL: Record<Window, string> = {
  "1h": "1 hour",
  "24h": "24 hours",
  "7d": "7 days",
};

export interface Point {
  ts: string;
  connections: number;
  commits: number;
  rollbacks: number;
  cache_hit: number | null;
  rows_read: number;
  rows_written: number;
  size_bytes: number;
}

export async function getSeries(database: string, window: Window): Promise<Point[]> {
  const m = await meta();
  const { rows } = await m.query<{
    ts: string;
    connections: number;
    commits: string | null;
    rollbacks: string | null;
    hit: string | null;
    read: string | null;
    returned: string | null;
    written: string | null;
    size_bytes: string;
  }>(
    `SELECT ts::text, connections,
            xact_commit - lag(xact_commit) OVER w AS commits,
            xact_rollback - lag(xact_rollback) OVER w AS rollbacks,
            blks_hit - lag(blks_hit) OVER w AS hit,
            blks_read - lag(blks_read) OVER w AS read,
            (tup_returned + tup_fetched) - lag(tup_returned + tup_fetched) OVER w AS returned,
            (tup_inserted + tup_updated + tup_deleted)
              - lag(tup_inserted + tup_updated + tup_deleted) OVER w AS written,
            size_bytes
     FROM metric_sample
     WHERE database = $1 AND ts > now() - interval '${WINDOW_INTERVAL[window]}'
     WINDOW w AS (ORDER BY ts)
     ORDER BY ts`,
    [database],
  );
  return rows
    .filter((r) => r.commits !== null)
    .map((r) => {
      const hit = Number(r.hit ?? 0);
      const read = Number(r.read ?? 0);
      return {
        ts: r.ts,
        connections: r.connections,
        commits: Math.max(0, Number(r.commits)),
        rollbacks: Math.max(0, Number(r.rollbacks)),
        cache_hit: hit + read > 0 ? hit / (hit + read) : null,
        rows_read: Math.max(0, Number(r.returned)),
        rows_written: Math.max(0, Number(r.written)),
        size_bytes: Number(r.size_bytes),
      };
    });
}

export interface StatementSummary {
  queryid: string;
  query: string;
  calls: number;
  total_exec_time: number;
  mean_exec_time: number;
  rows: number;
}

export async function getTopStatements(database: string): Promise<StatementSummary[]> {
  const m = await meta();
  const { rows } = await m.query<StatementSummary>(
    `SELECT queryid, query, calls::int, total_exec_time, mean_exec_time, rows::int
     FROM statement_sample
     WHERE database = $1 AND ts = (SELECT max(ts) FROM statement_sample WHERE database = $1)
     ORDER BY total_exec_time DESC`,
    [database],
  );
  return rows;
}

export interface ActivityRow {
  pid: number;
  usename: string | null;
  application_name: string;
  client_addr: string | null;
  state: string | null;
  wait_event_type: string | null;
  backend_start: string;
  query_start: string | null;
  state_change: string | null;
  query: string;
}

export async function getActivity(database: string): Promise<ActivityRow[]> {
  const { rows } = await maintenancePool().query<ActivityRow>(listActivity, [database]);
  return rows;
}

export async function lastSampleAt(): Promise<string | null> {
  const m = await meta();
  const { rows } = await m.query<{ ts: string | null }>(
    "SELECT max(ts)::text AS ts FROM metric_sample",
  );
  return rows[0]?.ts ?? null;
}
