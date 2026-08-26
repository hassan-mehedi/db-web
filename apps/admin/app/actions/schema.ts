"use server";

import { withClient } from "@db-web/db";
import {
  alterColumns,
  type ColumnChange,
  type CreateTableInput,
  createTable,
  dropTable,
} from "@db-web/sql";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/cluster";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/session";

function fail(err: unknown): { ok: false; error: string } {
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

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
    revalidatePath(`/db/${database}`);
    return { ok: true, sql };
  } catch (err) {
    return fail(err);
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
    revalidatePath(`/db/${database}`);
    return { ok: true, sql };
  } catch (err) {
    return fail(err);
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
    revalidatePath(`/db/${database}/${schema}/${table}`);
    return { ok: true, sql };
  } catch (err) {
    return fail(err);
  }
}
