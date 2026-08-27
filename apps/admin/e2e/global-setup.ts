import { join } from "node:path";
import pg from "pg";

export const E2E_USER = { email: "e2e@local.test", password: "e2e-password-123" };
export const STATE_FILE = join(process.cwd(), "e2e", ".state.json");

export default async function globalSetup() {
  const maintenance = process.env.DATABASE_URL_MAINTENANCE;
  if (!maintenance) throw new Error("DATABASE_URL_MAINTENANCE is required for e2e");
  process.env.BETTER_AUTH_SECRET ??= "e2e-secret-e2e-secret-e2e-secret-1234";

  const metaUrl = new URL(maintenance);
  metaUrl.pathname = "/db_web_meta";
  process.env.DATABASE_URL_META ??= metaUrl.toString();

  const admin = new pg.Client({ connectionString: maintenance });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'db_web_meta'");
  if (exists.rowCount === 0) await admin.query("CREATE DATABASE db_web_meta");
  for (const db of ["e2e_dev", "e2e_test"]) {
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [db],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${db}`);
    for (const r of ["anon", "user", "authenticator"]) {
      await admin.query(`DROP ROLE IF EXISTS ${db}_${r}`);
    }
  }
  await admin.end();

  const meta = new pg.Client({ connectionString: process.env.DATABASE_URL_META });
  await meta.connect();
  const hasUser = await meta.query(
    "SELECT 1 FROM information_schema.tables WHERE table_name = 'user'",
  );
  if (hasUser.rowCount) await meta.query('DELETE FROM "user"');
  await meta.end();
}
