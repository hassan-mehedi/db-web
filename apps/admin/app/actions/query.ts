"use server";

import { audit } from "@/lib/audit";
import { type QueryOutcome, runQuery } from "@/lib/run-query";
import { requireSession } from "@/lib/session";

export type QueryResponse = { ok: true; result: QueryOutcome } | { ok: false; error: string };

export async function executeQuery(
  database: string,
  sql: string,
  limit: number,
): Promise<QueryResponse> {
  await requireSession();
  if (!sql.trim()) return { ok: false, error: "empty query" };
  const cappedLimit = Math.min(Math.max(1, limit), 10_000);
  audit("query", database, sql);
  try {
    return { ok: true, result: await runQuery(database, sql, cappedLimit) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
