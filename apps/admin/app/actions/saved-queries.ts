"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/cluster";
import { queryPath } from "@/lib/routes";
import { deleteSavedQuery, saveQuery } from "@/lib/saved-queries";
import { requireSession } from "@/lib/session";

function fail(err: unknown): { ok: false; error: string } {
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

export async function saveQueryAction(
  database: string,
  name: string,
  sql: string,
): Promise<ActionResult> {
  await requireSession();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "name required" };
  if (!sql.trim()) return { ok: false, error: "query is empty" };
  try {
    await saveQuery(database, trimmed, sql);
    revalidatePath(queryPath(database));
    return { ok: true, sql: "" };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteSavedQueryAction(database: string, id: string): Promise<ActionResult> {
  await requireSession();
  try {
    await deleteSavedQuery(id);
    revalidatePath(queryPath(database));
    return { ok: true, sql: "" };
  } catch (err) {
    return fail(err);
  }
}
