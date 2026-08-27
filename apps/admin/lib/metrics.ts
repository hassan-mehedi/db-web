import { maintenancePool } from "@db-web/db";
import { databaseStats, hasStatStatements, listActivity, topStatements } from "@db-web/sql";
import { meta } from "./meta-db";
import { timed } from "./timing";

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

const RETENTION_EVERY_MS = 60 * 60 * 1000;
let lastRetention = 0;

export async function sampleOnce(): Promise<{ databases: number; statements: number }> {
  const pool = maintenancePool();
  const m = await meta();
  const ts = new Date();
  const stats = (await pool.query<StatRow>(databaseStats)).rows;
  if (stats.length) {
    await m.query(
      `INSERT INTO metric_sample (ts, database, connections, xact_commit, xact_rollback, blks_hit,
         blks_read, tup_returned, tup_fetched, tup_inserted, tup_updated, tup_deleted, deadlocks, size_bytes)
       SELECT $1, * FROM unnest(
         $2::text[], $3::int[], $4::bigint[], $5::bigint[], $6::bigint[], $7::bigint[],
         $8::bigint[], $9::bigint[], $10::bigint[], $11::bigint[], $12::bigint[], $13::bigint[], $14::bigint[])
       ON CONFLICT DO NOTHING`,
      [
        ts,
        stats.map((r) => r.datname),
        stats.map((r) => r.numbackends),
        stats.map((r) => r.xact_commit),
        stats.map((r) => r.xact_rollback),
        stats.map((r) => r.blks_hit),
        stats.map((r) => r.blks_read),
        stats.map((r) => r.tup_returned),
        stats.map((r) => r.tup_fetched),
        stats.map((r) => r.tup_inserted),
        stats.map((r) => r.tup_updated),
        stats.map((r) => r.tup_deleted),
        stats.map((r) => r.deadlocks),
        stats.map((r) => r.size_bytes),
      ],
    );
  }
  let statements = 0;
  if (await statStatementsAvailable()) {
    const rows = (await pool.query<StatementRow>(topStatements, [TOP_STATEMENTS])).rows;
    if (rows.length) {
      await m.query(
        `INSERT INTO statement_sample (ts, database, queryid, query, calls, total_exec_time, mean_exec_time, rows)
         SELECT $1, * FROM unnest(
           $2::text[], $3::text[], $4::text[], $5::bigint[], $6::float8[], $7::float8[], $8::bigint[])
         ON CONFLICT DO NOTHING`,
        [
          ts,
          rows.map((r) => r.datname),
          rows.map((r) => r.queryid),
          rows.map((r) => r.query),
          rows.map((r) => r.calls),
          rows.map((r) => r.total_exec_time),
          rows.map((r) => r.mean_exec_time),
          rows.map((r) => r.rows),
        ],
      );
    }
    statements = rows.length;
  }
  if (Date.now() - lastRetention > RETENTION_EVERY_MS) {
    lastRetention = Date.now();
    await m.query(`DELETE FROM metric_sample WHERE ts < now() - interval '${RETENTION}'`);
    await m.query(`DELETE FROM statement_sample WHERE ts < now() - interval '${RETENTION}'`);
  }
  return { databases: stats.length, statements };
}

export async function latestSizes(maxAgeMinutes = 5): Promise<Map<string, number>> {
  const m = await meta();
  const { rows } = await m.query<{ database: string; size_bytes: string }>(
    `SELECT DISTINCT ON (database) database, size_bytes
     FROM metric_sample
     WHERE ts > now() - make_interval(mins => $1)
     ORDER BY database, ts DESC`,
    [maxAgeMinutes],
  );
  return new Map(rows.map((r) => [r.database, Number(r.size_bytes)]));
}

export type Window = "1h" | "24h" | "7d";
export const WINDOWS: Window[] = ["1h", "24h", "7d"];
const WINDOW_INTERVAL: Record<Window, string> = {
  "1h": "1 hour",
  "24h": "24 hours",
  "7d": "7 days",
};
const BUCKET_MINUTES: Record<Window, number> = { "1h": 1, "24h": 5, "7d": 30 };

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

export function getSeries(database: string, window: Window): Promise<Point[]> {
  return timed("series", () => querySeries(database, window));
}

async function querySeries(database: string, window: Window): Promise<Point[]> {
  const m = await meta();
  const minutes = BUCKET_MINUTES[window];
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
    `WITH last_in_bucket AS (
       SELECT DISTINCT ON (date_bin(make_interval(mins => $2), ts, '2000-01-01')) *
       FROM metric_sample
       WHERE database = $1 AND ts > now() - interval '${WINDOW_INTERVAL[window]}'
       ORDER BY date_bin(make_interval(mins => $2), ts, '2000-01-01'), ts DESC
     )
     SELECT ts::text, connections,
            xact_commit - lag(xact_commit) OVER w AS commits,
            xact_rollback - lag(xact_rollback) OVER w AS rollbacks,
            blks_hit - lag(blks_hit) OVER w AS hit,
            blks_read - lag(blks_read) OVER w AS read,
            (tup_returned + tup_fetched) - lag(tup_returned + tup_fetched) OVER w AS returned,
            (tup_inserted + tup_updated + tup_deleted)
              - lag(tup_inserted + tup_updated + tup_deleted) OVER w AS written,
            size_bytes
     FROM last_in_bucket
     WINDOW w AS (ORDER BY ts)
     ORDER BY ts`,
    [database, minutes],
  );
  const perMinute = (v: string | null) => Math.max(0, Math.round(Number(v ?? 0) / minutes));
  return rows
    .filter((r) => r.commits !== null)
    .map((r) => {
      const hit = Number(r.hit ?? 0);
      const read = Number(r.read ?? 0);
      return {
        ts: r.ts,
        connections: r.connections,
        commits: perMinute(r.commits),
        rollbacks: perMinute(r.rollbacks),
        cache_hit: hit + read > 0 ? hit / (hit + read) : null,
        rows_read: perMinute(r.returned),
        rows_written: perMinute(r.written),
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

export function getTopStatements(database: string): Promise<StatementSummary[]> {
  return timed("statements", () => queryTopStatements(database));
}

async function queryTopStatements(database: string): Promise<StatementSummary[]> {
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

export function getActivity(database: string): Promise<ActivityRow[]> {
  return timed("activity", async () => {
    const { rows } = await maintenancePool().query<ActivityRow>(listActivity, [database]);
    return rows;
  });
}

export async function lastSampleAt(): Promise<string | null> {
  const m = await meta();
  const { rows } = await m.query<{ ts: string | null }>(
    "SELECT max(ts)::text AS ts FROM metric_sample",
  );
  return rows[0]?.ts ?? null;
}
