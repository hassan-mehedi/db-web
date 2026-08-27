import { meta } from "./meta-db";

export interface SavedQuery {
  id: string;
  name: string;
  database: string;
  sql: string;
  updated_at: string;
}

export async function listSavedQueries(database: string): Promise<SavedQuery[]> {
  const { rows } = await (await meta()).query<SavedQuery>(
    "SELECT id::text, name, database, sql, updated_at::text FROM saved_query WHERE database = $1 ORDER BY name",
    [database],
  );
  return rows;
}

export async function saveQuery(database: string, name: string, sql: string): Promise<void> {
  await (await meta()).query(
    `INSERT INTO saved_query (name, database, sql) VALUES ($1, $2, $3)
     ON CONFLICT (database, name) DO UPDATE SET sql = EXCLUDED.sql, updated_at = now()`,
    [name, database, sql],
  );
}

export async function deleteSavedQuery(id: string): Promise<void> {
  await (await meta()).query("DELETE FROM saved_query WHERE id = $1", [id]);
}
