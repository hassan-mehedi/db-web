import { closePool, maintenancePool, withClient } from "@db-web/db";
import { alterColumns, createTable } from "@db-web/sql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, dropDatabase, planCreateDatabase } from "../lib/cluster";
import { deleteRows, insertRow, updateRow } from "../lib/dml";
import { runQuery } from "../lib/run-query";

const url = process.env.DATABASE_URL_MAINTENANCE;
const suite = url ? describe : describe.skip;

const DB = "itest_dev";
const ROLES = [`${DB}_anon`, `${DB}_user`, `${DB}_authenticator`];

async function cleanup() {
  await closePool(DB);
  const pool = maintenancePool();
  await pool.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [DB],
  );
  await pool.query(`DROP DATABASE IF EXISTS ${DB}`);
  for (const r of ROLES) await pool.query(`DROP ROLE IF EXISTS ${r}`);
}

suite("cluster + schema + dml against a real Postgres", () => {
  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await closePool("postgres");
  });

  it("bootstraps a project-env database", async () => {
    const plan = planCreateDatabase({
      database: DB,
      bootstrap: true,
      authenticatorPassword: "pw'1",
    });
    await createDatabase(plan, DB);
    const roles = await maintenancePool().query(
      "SELECT rolname FROM pg_roles WHERE rolname = ANY($1) ORDER BY 1",
      [ROLES],
    );
    expect(roles.rows.map((r) => r.rolname)).toEqual([...ROLES].sort());
    const schema = await withClient(DB, (c) =>
      c.query("SELECT nspname FROM pg_namespace WHERE nspname = 'api'"),
    );
    expect(schema.rowCount).toBe(1);
  });

  it("refuses protected and invalid names", () => {
    expect(() => planCreateDatabase({ database: "postgres", bootstrap: false })).toThrow();
    expect(() => planCreateDatabase({ database: "db_web_meta", bootstrap: false })).toThrow();
    expect(() => planCreateDatabase({ database: "Bad-Name", bootstrap: false })).toThrow();
  });

  it("creates a table, edits rows, alters columns in one transaction", async () => {
    await withClient(DB, (c) =>
      c.query(
        createTable({
          schema: "api",
          name: "posts",
          columns: [
            { name: "id", type: "bigint generated always as identity", nullable: false },
            { name: "title", type: "text", nullable: false },
            { name: "views", type: "int", nullable: false, default: "0" },
          ],
          primaryKey: ["id"],
        }),
      ),
    );
    const rel = { database: DB, schema: "api", table: "posts" };
    await insertRow(rel, { title: "a" });
    await insertRow(rel, { title: "b", views: "5" });
    await expect(updateRow(rel, { id: "1" }, { views: null })).rejects.toThrow(/not-null/);
    await updateRow(rel, { id: "1" }, { title: "a2" });
    let rows = await withClient(DB, (c) =>
      c.query("SELECT title, views FROM api.posts ORDER BY id"),
    );
    expect(rows.rows).toEqual([
      { title: "a2", views: 0 },
      { title: "b", views: 5 },
    ]);
    await expect(updateRow(rel, { id: "999" }, { title: "x" })).rejects.toThrow(/matched 0/);

    const statements = alterColumns("api", "posts", [
      { kind: "add", column: { name: "ok", type: "text", nullable: true } },
      { kind: "type", column: "views", type: "uuid" },
    ]);
    await withClient(DB, async (c) => {
      await c.query("BEGIN");
      let failed = false;
      try {
        for (const s of statements) await c.query(s);
        await c.query("COMMIT");
      } catch {
        failed = true;
        await c.query("ROLLBACK");
      }
      expect(failed).toBe(true);
    });
    const cols = await withClient(DB, (c) =>
      c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'posts'"),
    );
    expect(cols.rows.map((r) => r.column_name)).not.toContain("ok");

    await deleteRows(rel, [{ id: "1" }, { id: "2" }]);
    rows = await withClient(DB, (c) => c.query("SELECT count(*)::int AS n FROM api.posts"));
    expect(rows.rows[0]?.n).toBe(0);
  });

  it("caps query results with a cursor", async () => {
    const out = await runQuery(DB, "select * from generate_series(1, 5000)", 100);
    expect(out.rows).toHaveLength(100);
    expect(out.truncated).toBe(true);
    const upd = await runQuery(DB, "insert into api.posts (title) values ('x')", 100);
    expect(upd.command).toBe("INSERT");
    expect(upd.rowCount).toBe(1);
  });

  it("drops the database, forcing disconnects", async () => {
    await withClient(DB, (c) => c.query("SELECT 1"));
    await dropDatabase(DB, true);
    const left = await maintenancePool().query("SELECT 1 FROM pg_database WHERE datname = $1", [
      DB,
    ]);
    expect(left.rowCount).toBe(0);
  });
});
