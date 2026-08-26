import pg from "pg";

const { Pool } = pg;

const MAINTENANCE_DB = "postgres";
const pools = new Map<string, pg.Pool>();

function maintenanceUrl(): URL {
  const raw = process.env.DATABASE_URL_MAINTENANCE;
  if (!raw) throw new Error("DATABASE_URL_MAINTENANCE is not set");
  return new URL(raw);
}

export function poolFor(database: string): pg.Pool {
  const existing = pools.get(database);
  if (existing) return existing;
  const url = maintenanceUrl();
  url.pathname = `/${database}`;
  const pool = new Pool({
    connectionString: url.toString(),
    max: 3,
    idleTimeoutMillis: 30_000,
    statement_timeout: 30_000,
  });
  pools.set(database, pool);
  return pool;
}

export function maintenancePool(): pg.Pool {
  return poolFor(MAINTENANCE_DB);
}

export async function withClient<T>(
  database: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await poolFor(database).connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closePool(database: string): Promise<void> {
  const pool = pools.get(database);
  if (!pool) return;
  pools.delete(database);
  await pool.end();
}

export type { Pool, PoolClient, QueryResult } from "pg";
