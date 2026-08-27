"use server";

import { maintenancePool } from "@db-web/db";
import { terminateBackend } from "@db-web/sql";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { sampleOnce } from "@/lib/metrics";
import { monitoringPath } from "@/lib/routes";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "./cluster";

export async function terminateBackendAction(database: string, pid: number): Promise<ActionResult> {
  await requireSession();
  try {
    const sql = `SELECT pg_terminate_backend(${Number(pid)})`;
    audit("terminate-backend", database, sql);
    const { rows } = await maintenancePool().query<{ ok: boolean }>(terminateBackend, [
      database,
      pid,
    ]);
    if (rows.length === 0)
      return { ok: false, error: `pid ${pid} is not connected to ${database}` };
    revalidatePath(monitoringPath(database));
    return { ok: true, sql };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sampleNowAction(database: string): Promise<ActionResult> {
  await requireSession();
  try {
    await sampleOnce();
    revalidatePath(monitoringPath(database));
    return { ok: true, sql: "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
