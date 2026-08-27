"use server";

import { withClient } from "@db-web/db";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { clearHistory, recordQuery } from "@/lib/query-history";
import { queryPath } from "@/lib/routes";
import { type QueryOutcome, runQuery } from "@/lib/run-query";
import { requireSession } from "@/lib/session";

export type QueryResponse = { ok: true; result: QueryOutcome } | { ok: false; error: string };

function remember(
  database: string,
  sql: string,
  outcome: QueryOutcome | null,
  error: string | null,
  startedAt: number,
) {
  recordQuery({
    database,
    sql,
    rowCount: outcome ? (outcome.rowCount ?? outcome.rows.length) : null,
    durationMs: outcome?.durationMs ?? Math.round(performance.now() - startedAt),
    error,
  }).catch((err: unknown) => {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        action: "history-failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  });
}

export async function executeQuery(
  database: string,
  sql: string,
  limit: number,
): Promise<QueryResponse> {
  await requireSession();
  if (!sql.trim()) return { ok: false, error: "empty query" };
  const cappedLimit = Math.min(Math.max(1, limit), 10_000);
  audit("query", database, sql);
  const startedAt = performance.now();
  try {
    const result = await runQuery(database, sql, cappedLimit);
    remember(database, sql, result, null, startedAt);
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    remember(database, sql, null, message, startedAt);
    return { ok: false, error: message };
  }
}

export type ExplainResponse =
  | { ok: true; plan: string; durationMs: number }
  | { ok: false; error: string };

export async function explainQuery(
  database: string,
  sql: string,
  analyze: boolean,
): Promise<ExplainResponse> {
  await requireSession();
  const body = sql.trim().replace(/;\s*$/, "");
  if (!body) return { ok: false, error: "empty query" };
  if (body.includes(";")) return { ok: false, error: "explain one statement at a time" };
  const explain = analyze
    ? `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${body}`
    : `EXPLAIN (FORMAT TEXT) ${body}`;
  audit(analyze ? "explain-analyze" : "explain", database, explain);
  const started = performance.now();
  try {
    const plan = await withClient(database, async (c) => {
      await c.query("BEGIN");
      try {
        const { rows } = await c.query<{ "QUERY PLAN": string }>(explain);
        return rows.map((r) => r["QUERY PLAN"]).join("\n");
      } finally {
        await c.query("ROLLBACK");
      }
    });
    return { ok: true, plan, durationMs: Math.round(performance.now() - started) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function clearHistoryAction(database: string): Promise<void> {
  await requireSession();
  await clearHistory(database);
  revalidatePath(queryPath(database));
}
