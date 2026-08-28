"use server";

import { withClient } from "@db-web/db";
import {
  type AddCheckInput,
  type AddForeignKeyInput,
  type AddUniqueInput,
  addCheck,
  addForeignKey,
  addUnique,
  type CreateIndexInput,
  createIndex,
  dropConstraint,
  dropIndex,
  dropPolicy,
  dropTrigger,
  setRowSecurity,
} from "@db-web/sql";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/cluster";
import { audit } from "@/lib/audit";
import { tablePath } from "@/lib/routes";
import { requireSession } from "@/lib/session";

function fail(err: unknown): { ok: false; error: string } {
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

async function run(
  database: string,
  action: string,
  sql: string,
  path: string,
): Promise<ActionResult> {
  await requireSession();
  try {
    audit(action, database, sql);
    await withClient(database, (c) => c.query(sql));
    revalidatePath(path);
    return { ok: true, sql };
  } catch (err) {
    return fail(err);
  }
}

const rel = (db: string, s: string, t: string) => tablePath(db, s, t);

export async function createIndexAction(database: string, input: CreateIndexInput) {
  let sql: string;
  try {
    sql = createIndex(input);
  } catch (err) {
    return fail(err);
  }
  return run(database, "create-index", sql, rel(database, input.schema, input.table));
}

export async function dropIndexAction(
  database: string,
  schema: string,
  table: string,
  name: string,
) {
  return run(database, "drop-index", dropIndex(schema, name), rel(database, schema, table));
}

export async function addForeignKeyAction(database: string, input: AddForeignKeyInput) {
  let sql: string;
  try {
    sql = addForeignKey(input);
  } catch (err) {
    return fail(err);
  }
  return run(database, "add-foreign-key", sql, rel(database, input.schema, input.table));
}

export async function addUniqueAction(database: string, input: AddUniqueInput) {
  let sql: string;
  try {
    sql = addUnique(input);
  } catch (err) {
    return fail(err);
  }
  return run(database, "add-unique", sql, rel(database, input.schema, input.table));
}

export async function addCheckAction(database: string, input: AddCheckInput) {
  let sql: string;
  try {
    sql = addCheck(input);
  } catch (err) {
    return fail(err);
  }
  return run(database, "add-check", sql, rel(database, input.schema, input.table));
}

export async function dropConstraintAction(
  database: string,
  schema: string,
  table: string,
  name: string,
) {
  return run(
    database,
    "drop-constraint",
    dropConstraint(schema, table, name),
    rel(database, schema, table),
  );
}

export async function dropTriggerAction(
  database: string,
  schema: string,
  table: string,
  name: string,
) {
  return run(
    database,
    "drop-trigger",
    dropTrigger(schema, table, name),
    rel(database, schema, table),
  );
}

export async function dropPolicyAction(
  database: string,
  schema: string,
  table: string,
  name: string,
) {
  return run(
    database,
    "drop-policy",
    dropPolicy(schema, table, name),
    rel(database, schema, table),
  );
}

export async function setRowSecurityAction(
  database: string,
  schema: string,
  table: string,
  enabled: boolean,
) {
  return run(
    database,
    enabled ? "enable-rls" : "disable-rls",
    setRowSecurity(schema, table, enabled),
    rel(database, schema, table),
  );
}
