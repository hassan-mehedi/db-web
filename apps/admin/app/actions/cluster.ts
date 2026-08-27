"use server";

import { planToSql } from "@db-web/bootstrap";
import type { CreateRoleInput } from "@db-web/sql";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import * as cluster from "@/lib/cluster";
import { requireSession } from "@/lib/session";

export type ActionResult<T = undefined> =
  | { ok: true; sql: string; data?: T }
  | { ok: false; error: string };

function fail(err: unknown): { ok: false; error: string } {
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

export async function createDatabaseAction(input: {
  database: string;
  bootstrap: boolean;
  authenticatorPassword?: string;
}): Promise<ActionResult> {
  await requireSession();
  try {
    const plan = cluster.planCreateDatabase(input);
    const sql = planToSql(plan);
    audit("create-database", input.database, sql);
    await cluster.createDatabase(plan, input.database);
    revalidatePath("/projects");
    return { ok: true, sql };
  } catch (err) {
    return fail(err);
  }
}

export async function dropDatabaseAction(input: {
  database: string;
  force: boolean;
}): Promise<ActionResult> {
  await requireSession();
  try {
    audit("drop-database", input.database, `DROP DATABASE ${input.database}`);
    await cluster.dropDatabase(input.database, input.force);
    return { ok: true, sql: `DROP DATABASE ${input.database}` };
  } catch (err) {
    return fail(err);
  }
}

export async function createRoleAction(input: CreateRoleInput): Promise<ActionResult> {
  await requireSession();
  try {
    const sql = cluster.planCreateRole(input);
    audit("create-role", "postgres", sql.replace(/PASSWORD '.*'/, "PASSWORD '***'"));
    await cluster.createRoleExec(sql);
    revalidatePath("/roles");
    return { ok: true, sql };
  } catch (err) {
    return fail(err);
  }
}

export async function grantRoleAction(role: string, to: string): Promise<ActionResult> {
  await requireSession();
  try {
    const sql = await cluster.grantRole(role, to);
    audit("grant-role", "postgres", sql);
    revalidatePath("/roles");
    return { ok: true, sql };
  } catch (err) {
    return fail(err);
  }
}

export async function revokeRoleAction(role: string, from: string): Promise<ActionResult> {
  await requireSession();
  try {
    const sql = await cluster.revokeRole(role, from);
    audit("revoke-role", "postgres", sql);
    revalidatePath("/roles");
    return { ok: true, sql };
  } catch (err) {
    return fail(err);
  }
}

export async function dropRoleAction(name: string): Promise<ActionResult> {
  await requireSession();
  try {
    const sql = await cluster.dropRole(name);
    audit("drop-role", "postgres", sql);
    revalidatePath("/roles");
    return { ok: true, sql };
  } catch (err) {
    return fail(err);
  }
}
