import pg from "pg";

let pool: pg.Pool | null = null;
let ready: Promise<void> | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS saved_query (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  database text NOT NULL,
  sql text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (database, name)
);
CREATE TABLE IF NOT EXISTS metric_sample (
  ts timestamptz NOT NULL,
  database text NOT NULL,
  connections int NOT NULL,
  xact_commit bigint NOT NULL,
  xact_rollback bigint NOT NULL,
  blks_hit bigint NOT NULL,
  blks_read bigint NOT NULL,
  tup_returned bigint NOT NULL,
  tup_fetched bigint NOT NULL,
  tup_inserted bigint NOT NULL,
  tup_updated bigint NOT NULL,
  tup_deleted bigint NOT NULL,
  deadlocks bigint NOT NULL,
  size_bytes bigint NOT NULL,
  PRIMARY KEY (database, ts)
);
CREATE TABLE IF NOT EXISTS statement_sample (
  ts timestamptz NOT NULL,
  database text NOT NULL,
  queryid text NOT NULL,
  query text NOT NULL,
  calls bigint NOT NULL,
  total_exec_time double precision NOT NULL,
  mean_exec_time double precision NOT NULL,
  rows bigint NOT NULL,
  PRIMARY KEY (database, ts, queryid)
);
CREATE TABLE IF NOT EXISTS query_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  database text NOT NULL,
  sql text NOT NULL,
  row_count int,
  duration_ms int NOT NULL,
  error text,
  ran_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS query_history_database_ran_at ON query_history (database, ran_at DESC);
CREATE INDEX IF NOT EXISTS metric_sample_ts ON metric_sample (ts);
CREATE INDEX IF NOT EXISTS statement_sample_ts ON statement_sample (ts);
`;

export function metaPool(): pg.Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL_META;
  if (!url) throw new Error("DATABASE_URL_META is not set");
  pool = new pg.Pool({ connectionString: url, max: 2, idleTimeoutMillis: 30_000 });
  pool.on("error", (err) => {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        action: "meta-pool-error",
        error: err.message,
      }),
    );
  });
  return pool;
}

export function ensureMetaSchema(): Promise<void> {
  if (!ready) {
    ready = metaPool()
      .query(SCHEMA)
      .then(() => undefined)
      .catch((err) => {
        ready = null;
        throw err;
      });
  }
  return ready;
}

export async function meta(): Promise<pg.Pool> {
  await ensureMetaSchema();
  return metaPool();
}
