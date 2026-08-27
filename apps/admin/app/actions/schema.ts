"use server";

import { withClient } from "@db-web/db";
import {
  alterColumns,
  type ColumnChange,
  type CreateTableInput,
  createTable,
  dropTable,
  isValidType,
  quoteIdent,
} from "@db-web/sql";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/cluster";
import { audit } from "@/lib/audit";
import { tablePath, tablesPath } from "@/lib/routes";
import { requireSession } from "@/lib/session";

function fail(err: unknown, database?: string): { ok: false; error: string } {
  let message = err instanceof Error ? err.message : String(err);
  if (database && /permission denied for schema/.test(message)) {
    message += `. The app role does not own ${database}. Run as a superuser: ALTER DATABASE ${quoteIdent(database)} OWNER TO ${quoteIdent(APP_ROLE)}`;
  }
  return { ok: false, error: message };
}

const APP_ROLE = new URL(process.env.DATABASE_URL_MAINTENANCE ?? "postgres://app_admin@x/x")
  .username;

async function runInTransaction(database: string, statements: string[]) {
  await withClient(database, async (c) => {
    await c.query("BEGIN");
    try {
      for (const s of statements) await c.query(s);
      await c.query("COMMIT");
    } catch (err) {
      await c.query("ROLLBACK");
      throw err;
    }
  });
}

export async function createTableAction(
  database: string,
  input: CreateTableInput,
): Promise<ActionResult> {
  await requireSession();
  try {
    const sql = createTable(input);
    audit("create-table", database, sql);
    await runInTransaction(database, [sql]);
    revalidatePath(tablesPath(database));
    return { ok: true, sql };
  } catch (err) {
    return fail(err, database);
  }
}

export async function dropTableAction(
  database: string,
  schema: string,
  table: string,
): Promise<ActionResult> {
  await requireSession();
  try {
    const sql = dropTable(schema, table);
    audit("drop-table", database, sql);
    await runInTransaction(database, [sql]);
    revalidatePath(tablesPath(database));
    return { ok: true, sql };
  } catch (err) {
    return fail(err, database);
  }
}

export async function alterColumnsAction(
  database: string,
  schema: string,
  table: string,
  changes: ColumnChange[],
): Promise<ActionResult> {
  await requireSession();
  try {
    if (changes.length === 0) return { ok: false, error: "no changes" };
    const statements = alterColumns(schema, table, changes);
    const sql = `${statements.join(";\n")};`;
    audit("alter-columns", database, sql);
    await runInTransaction(database, statements);
    revalidatePath(tablePath(database, schema, table));
    return { ok: true, sql };
  } catch (err) {
    return fail(err, database);
  }
}

export async function checkColumnType(
  database: string,
  type: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSession();
  if (!isValidType(type)) return { ok: false, error: "unexpected characters in type" };
  try {
    await withClient(database, async (c) => {
      await c.query("BEGIN");
      try {
        await c.query(`CREATE TEMP TABLE "__db_web_type_check" ("c" ${type.trim()})`);
      } finally {
        await c.query("ROLLBACK");
      }
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
