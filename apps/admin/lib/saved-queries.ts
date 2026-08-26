import pg from "pg";

let pool: pg.Pool | null = null;
let ready: Promise<void> | null = null;

function metaPool(): pg.Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL_META;
  if (!url) throw new Error("DATABASE_URL_META is not set");
  pool = new pg.Pool({ connectionString: url, max: 2, idleTimeoutMillis: 30_000 });
  return pool;
}

function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = metaPool()
      .query(
        `CREATE TABLE IF NOT EXISTS saved_query (
           id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
           name text NOT NULL,
           database text NOT NULL,
           sql text NOT NULL,
           created_at timestamptz NOT NULL DEFAULT now(),
           updated_at timestamptz NOT NULL DEFAULT now(),
           UNIQUE (database, name)
         )`,
      )
      .then(() => undefined)
      .catch((err) => {
        ready = null;
        throw err;
      });
  }
  return ready;
}

export interface SavedQuery {
  id: string;
  name: string;
  database: string;
  sql: string;
  updated_at: string;
}

export async function listSavedQueries(database: string): Promise<SavedQuery[]> {
  await ensureSchema();
  const { rows } = await metaPool().query<SavedQuery>(
    "SELECT id::text, name, database, sql, updated_at::text FROM saved_query WHERE database = $1 ORDER BY name",
    [database],
  );
  return rows;
}

export async function saveQuery(database: string, name: string, sql: string): Promise<void> {
  await ensureSchema();
  await metaPool().query(
    `INSERT INTO saved_query (name, database, sql) VALUES ($1, $2, $3)
     ON CONFLICT (database, name) DO UPDATE SET sql = EXCLUDED.sql, updated_at = now()`,
    [name, database, sql],
  );
}

export async function deleteSavedQuery(id: string): Promise<void> {
  await ensureSchema();
  await metaPool().query("DELETE FROM saved_query WHERE id = $1", [id]);
}
