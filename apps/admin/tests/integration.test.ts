import { closePool, maintenancePool, poolFor, withClient } from "@db-web/db";
import { alterColumns, createTable, databaseAccess } from "@db-web/sql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, dropDatabase, planCreateDatabase } from "../lib/cluster";
import { deleteRows, insertRow, updateRow, updateRows } from "../lib/dml";
import { getTableData, getTableDetails } from "../lib/queries";
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

  it("reports that the app role can create tables in a database it created", async () => {
    const { rows } = await poolFor(DB).query(databaseAccess);
    expect(rows[0].owner).toBe(rows[0].user);
    expect(rows[0].canCreateInPublic).toBe(true);
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

  it("applies several row changes in one transaction and rolls back on a miss", async () => {
    const rel = { database: DB, schema: "api", table: "posts" };
    const ids = await withClient(DB, (c) =>
      c.query<{ id: number }>("INSERT INTO api.posts (title) VALUES ('p'), ('q') RETURNING id"),
    );
    const [a, b] = ids.rows.map((r) => String(r.id));
    const sql = await updateRows(rel, [
      { key: { id: a as string }, values: { title: "first" } },
      { key: { id: b as string }, values: { title: "second", views: "7" } },
    ]);
    expect(sql).toContain('UPDATE "api"."posts" SET "title" = $1, "views" = $2 WHERE "id" = $3');
    const after = await withClient(DB, (c) =>
      c.query("SELECT title, views FROM api.posts WHERE id = ANY($1::int[]) ORDER BY id", [[a, b]]),
    );
    expect(after.rows).toEqual([
      { title: "first", views: 0 },
      { title: "second", views: 7 },
    ]);
    await expect(
      updateRows(rel, [
        { key: { id: a as string }, values: { title: "x" } },
        { key: { id: "999999" }, values: { title: "y" } },
      ]),
    ).rejects.toThrow("matched 0");
    const still = await withClient(DB, (c) =>
      c.query("SELECT title FROM api.posts WHERE id = $1", [a]),
    );
    expect(still.rows[0]).toEqual({ title: "first" });
  });

  it("marks single-table results with a primary key as editable", async () => {
    const out = await runQuery(DB, "select id, title as t, upper(title) from api.posts", 10);
    expect(out.source).toEqual({
      schema: "api",
      table: "posts",
      primaryKey: ["id"],
      columns: ["id", "title", null],
    });
    const noKey = await runQuery(DB, "select title from api.posts", 10);
    expect(noKey.source).toBeNull();
    const expr = await runQuery(DB, "select 1 as one", 10);
    expect(expr.source).toBeNull();
  });

  it("filters and sorts table data, and links foreign keys", async () => {
    await withClient(DB, (c) =>
      c.query(
        createTable({
          schema: "api",
          name: "comments",
          columns: [
            { name: "id", type: "int", nullable: false },
            { name: "body", type: "text", nullable: true },
            {
              name: "post_id",
              type: "bigint",
              nullable: true,
              references: { schema: "api", table: "posts", column: "id", onDelete: "CASCADE" },
            },
          ],
          primaryKey: ["id"],
        }),
      ),
    );
    const post = await withClient(DB, (c) =>
      c.query<{ id: string }>("INSERT INTO api.posts (title) VALUES ('linked') RETURNING id"),
    );
    const postId = post.rows[0]?.id ?? "";
    await withClient(DB, (c) =>
      c.query(
        "INSERT INTO api.comments (id, body, post_id) VALUES (1, 'apple', $1), (2, 'banana', NULL), (3, 'cherry', $1)",
        [postId],
      ),
    );
    const details = await getTableDetails(DB, "api", "comments");
    expect(details.foreignKeys).toEqual([
      { column: "post_id", refSchema: "api", refTable: "posts", refColumn: "id" },
    ]);
    expect(details.constraints.map((c) => c.definition)).toContain(
      "FOREIGN KEY (post_id) REFERENCES api.posts(id) ON DELETE CASCADE",
    );

    const sorted = await getTableData(DB, "api", "comments", {
      sort: { column: "body", desc: true },
    });
    expect(sorted.rows.map((r) => r[1])).toEqual(["cherry", "banana", "apple"]);
    expect(sorted.estimated).toBe(true);

    const filtered = await getTableData(DB, "api", "comments", {
      filters: [
        { column: "body", op: "ilike", value: "%an%" },
        { column: "post_id", op: "null", value: "" },
      ],
    });
    expect(filtered.rows.map((r) => r[0])).toEqual(["2"]);
    expect(filtered.total).toBe(1);
    expect(filtered.estimated).toBe(false);
    const inList = await getTableData(DB, "api", "comments", {
      filters: [{ column: "id", op: "in", value: "1, 3" }],
      sort: { column: "id", desc: true },
    });
    expect(inList.rows.map((r) => r[0])).toEqual(["3", "1"]);
    const numeric = await getTableData(DB, "api", "comments", {
      filters: [{ column: "id", op: "gt", value: "1" }],
    });
    expect(numeric.total).toBe(2);

    const out = await runQuery(
      DB,
      "select c.id, c.post_id, p.title from api.comments c join api.posts p on p.id = c.post_id",
      10,
    );
    expect(out.source).toBeNull();
    expect(out.links).toEqual([null, { schema: "api", table: "posts", column: "id" }, null]);
    await withClient(DB, (c) => c.query("DROP TABLE api.comments"));
  });

  it("pages by primary key and estimates the count", async () => {
    await withClient(DB, (c) =>
      c.query(`CREATE TABLE api.nums (id int PRIMARY KEY, v text);
               INSERT INTO api.nums SELECT g, 'v' || g FROM generate_series(1, 120) g;
               CREATE TABLE api.heap (v int);
               INSERT INTO api.heap SELECT g FROM generate_series(1, 60) g;
               ANALYZE api.nums`),
    );
    const p1 = await getTableData(DB, "api", "nums");
    expect(p1.rows.length).toBe(50);
    expect(p1.rows[0]?.[0]).toBe("1");
    expect(p1.hasNext).toBe(true);
    expect(p1.hasPrev).toBe(false);
    expect(p1.estimated).toBe(true);
    expect(p1.total).toBe(120);
    expect(p1.columns).toEqual(["id", "v"]);

    const p2 = await getTableData(DB, "api", "nums", { after: p1.lastKey ?? undefined });
    expect(p2.rows[0]?.[0]).toBe("51");
    expect(p2.hasPrev).toBe(true);
    const p3 = await getTableData(DB, "api", "nums", { after: p2.lastKey ?? undefined });
    expect(p3.rows.length).toBe(20);
    expect(p3.hasNext).toBe(false);
    const back = await getTableData(DB, "api", "nums", { before: p3.firstKey ?? undefined });
    expect(back.rows[0]?.[0]).toBe("51");
    expect(back.rows.at(-1)?.[0]).toBe("100");

    const exact = await getTableData(DB, "api", "nums", { exact: true });
    expect(exact.estimated).toBe(false);
    expect(exact.total).toBe(120);

    const heap = await getTableData(DB, "api", "heap", { page: 1 });
    expect(heap.primaryKey).toEqual([]);
    expect(heap.rows.length).toBe(10);
    expect(heap.hasPrev).toBe(true);
    expect(heap.hasNext).toBe(false);
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

const metaSuite = url && process.env.DATABASE_URL_META ? describe : describe.skip;

metaSuite("sampler against a real Postgres", () => {
  it("samples in one insert per table and serves bucketed series", async () => {
    const { getSeries, latestSizes, sampleOnce } = await import("../lib/metrics");
    const { getDatabases } = await import("../lib/queries");
    const first = await sampleOnce();
    expect(first.databases).toBeGreaterThan(0);
    const sizes = await latestSizes();
    expect(sizes.size).toBeGreaterThanOrEqual(first.databases);
    const dbs = await getDatabases();
    for (const d of dbs) expect(Number(d.size_bytes)).toBe(sizes.get(d.datname));
    await sampleOnce();
    const series = await getSeries(dbs[0]?.datname ?? "", "7d");
    expect(Array.isArray(series)).toBe(true);
    for (const p of series) expect(p.commits).toBeGreaterThanOrEqual(0);
  });
});
