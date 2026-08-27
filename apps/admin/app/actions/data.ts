"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/cluster";
import { audit } from "@/lib/audit";
import { deleteRows, insertRow, type Rel, type RowKey, updateRow } from "@/lib/dml";
import type { Cell } from "@/lib/format";
import { tablePath } from "@/lib/routes";
import { requireSession } from "@/lib/session";

function fail(err: unknown): { ok: false; error: string } {
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

function path(rel: Rel) {
  return tablePath(rel.database, rel.schema, rel.table);
}

export async function updateRowAction(
  rel: Rel,
  key: RowKey,
  changes: Record<string, Cell>,
): Promise<ActionResult> {
  await requireSession();
  try {
    const sql = await updateRow(rel, key, changes);
    audit("update-row", rel.database, sql);
    revalidatePath(path(rel));
    return { ok: true, sql };
  } catch (err) {
    return fail(err);
  }
}

export async function insertRowAction(
  rel: Rel,
  values: Record<string, Cell>,
): Promise<ActionResult> {
  await requireSession();
  try {
    const sql = await insertRow(rel, values);
    audit("insert-row", rel.database, sql);
    revalidatePath(path(rel));
    return { ok: true, sql };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteRowsAction(rel: Rel, keys: RowKey[]): Promise<ActionResult> {
  await requireSession();
  try {
    const sql = await deleteRows(rel, keys);
    audit("delete-rows", rel.database, sql);
    revalidatePath(path(rel));
    return { ok: true, sql };
  } catch (err) {
    return fail(err);
  }
}
