"use server";

import { withClient } from "@db-web/db";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { clearHistory, recordQuery } from "@/lib/query-history";
import { queryPath } from "@/lib/routes";
import { type QueryOutcome, runStatements, type StatementResult } from "@/lib/run-query";
import { trackRun, untrackRun } from "@/lib/running";
import { requireSession } from "@/lib/session";
import { splitStatements } from "@/lib/sql-split";

export type QueryResponse = { ok: true; results: StatementResult[] } | { ok: false; error: string };

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
  token?: string,
): Promise<QueryResponse> {
  await requireSession();
  const statements = splitStatements(sql).map((s) => s.text);
  if (statements.length === 0) return { ok: false, error: "empty query" };
  const cappedLimit = Math.min(Math.max(1, limit), 10_000);
  audit("query", database, sql);
  const startedAt = performance.now();
  try {
    const results = await runStatements(database, statements, cappedLimit, (pid) => {
      if (token) trackRun(token, database, pid);
    });
    const failed = results.find((r) => !r.ok);
    const last = results.at(-1);
    remember(
      database,
      sql,
      last?.ok ? last.outcome : null,
      failed && !failed.ok ? failed.error : null,
      startedAt,
    );
    return { ok: true, results };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    remember(database, sql, null, message, startedAt);
    return { ok: false, error: message };
  } finally {
    if (token) untrackRun(token);
  }
}

export interface PlanNode {
  "Node Type": string;
  "Relation Name"?: string;
  Alias?: string;
  "Index Name"?: string;
  "Join Type"?: string;
  "Startup Cost"?: number;
  "Total Cost"?: number;
  "Plan Rows"?: number;
  "Plan Width"?: number;
  "Actual Startup Time"?: number;
  "Actual Total Time"?: number;
  "Actual Rows"?: number;
  "Actual Loops"?: number;
  "Shared Hit Blocks"?: number;
  "Shared Read Blocks"?: number;
  Filter?: string;
  "Index Cond"?: string;
  "Hash Cond"?: string;
  "Recheck Cond"?: string;
  "Sort Key"?: string[];
  "Rows Removed by Filter"?: number;
  Plans?: PlanNode[];
  [key: string]: unknown;
}

export interface ExplainPlan {
  Plan: PlanNode;
  "Planning Time"?: number;
  "Execution Time"?: number;
  [key: string]: unknown;
}

export type ExplainResponse =
  | { ok: true; plan: ExplainPlan; durationMs: number }
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
    ? `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${body}`
    : `EXPLAIN (FORMAT JSON) ${body}`;
  audit(analyze ? "explain-analyze" : "explain", database, explain);
  const started = performance.now();
  try {
    const plan = await withClient(database, async (c) => {
      await c.query("BEGIN");
      try {
        const { rows } = await c.query<{ "QUERY PLAN": ExplainPlan[] }>(explain);
        const plan = rows[0]?.["QUERY PLAN"][0];
        if (!plan) throw new Error("no plan returned");
        return plan;
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
