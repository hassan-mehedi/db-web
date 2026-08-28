"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { ExplainPlan, PlanNode } from "@/app/actions/query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function totalTime(plan: ExplainPlan): number | null {
  const t = plan.Plan["Actual Total Time"];
  return typeof t === "number" ? t : null;
}

function nodeTitle(n: PlanNode): string {
  const parts = [n["Node Type"]];
  if (n["Join Type"] && n["Node Type"].includes("Join")) parts[0] = `${n["Join Type"]} ${parts[0]}`;
  if (n["Relation Name"]) {
    parts.push(
      `on ${n["Relation Name"]}${n.Alias && n.Alias !== n["Relation Name"] ? ` ${n.Alias}` : ""}`,
    );
  }
  if (n["Index Name"]) parts.push(`using ${n["Index Name"]}`);
  return parts.join(" ");
}

const CONDITIONS: [keyof PlanNode & string, string][] = [
  ["Index Cond", "index cond"],
  ["Recheck Cond", "recheck"],
  ["Hash Cond", "hash cond"],
  ["Merge Cond", "merge cond"],
  ["Join Filter", "join filter"],
  ["Filter", "filter"],
  ["Sort Key", "sort key"],
  ["Group Key", "group key"],
];

function selfTime(n: PlanNode): number | null {
  const total = n["Actual Total Time"];
  if (typeof total !== "number") return null;
  const loops = n["Actual Loops"] ?? 1;
  const children = (n.Plans ?? []).reduce(
    (sum, c) => sum + (c["Actual Total Time"] ?? 0) * (c["Actual Loops"] ?? 1),
    0,
  );
  return Math.max(0, total * loops - children);
}

function Node({ node, depth, total }: { node: PlanNode; depth: number; total: number | null }) {
  const [open, setOpen] = useState(true);
  const children = node.Plans ?? [];
  const self = selfTime(node);
  const share = total && self !== null && total > 0 ? self / total : null;
  const estimate = node["Plan Rows"];
  const actual = node["Actual Rows"];
  const off =
    typeof estimate === "number" && typeof actual === "number" && estimate > 0 && actual > 0
      ? Math.max(estimate / actual, actual / estimate)
      : null;
  return (
    <li>
      <div
        className="group flex items-start gap-1 rounded px-1 py-1 hover:bg-muted/60"
        style={{ paddingLeft: depth * 16 + 4 }}
      >
        <button
          type="button"
          aria-label={open ? "collapse" : "expand"}
          className={cn(
            "mt-0.5 rounded p-0.5 text-muted-foreground",
            children.length === 0 && "invisible",
          )}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span data-plan-node className="font-mono text-xs font-medium">
              {nodeTitle(node)}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              cost {node["Startup Cost"]?.toFixed(2)}..{node["Total Cost"]?.toFixed(2)}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              rows {estimate?.toLocaleString()}
              {typeof actual === "number" && (
                <>
                  {" "}
                  <span
                    className={cn(
                      off !== null && off >= 10 && "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    actual {actual.toLocaleString()}
                    {off !== null && off >= 10 ? ` (${off.toFixed(0)}x off)` : ""}
                  </span>
                </>
              )}
              {typeof node["Actual Loops"] === "number" && node["Actual Loops"] > 1 && (
                <> loops {node["Actual Loops"]}</>
              )}
            </span>
            {typeof node["Actual Total Time"] === "number" && (
              <span className="font-mono text-[11px] text-muted-foreground">
                {node["Actual Total Time"].toFixed(2)} ms
              </span>
            )}
          </div>
          {share !== null && (
            <div className="mt-1 h-1 w-48 overflow-hidden rounded bg-muted">
              <div
                className={cn(
                  "h-full",
                  share > 0.5 ? "bg-red-500" : share > 0.2 ? "bg-amber-500" : "bg-primary",
                )}
                style={{ width: `${Math.max(1, share * 100)}%` }}
                title={`${(share * 100).toFixed(0)}% of total time in this node`}
              />
            </div>
          )}
          <dl className="mt-0.5 grid gap-x-3 font-mono text-[11px] text-muted-foreground">
            {CONDITIONS.map(([key, label]) => {
              const v = node[key];
              if (v === undefined || v === null) return null;
              return (
                <div key={key} className="flex gap-2">
                  <dt className="shrink-0">{label}</dt>
                  <dd className="break-all text-foreground/80">
                    {Array.isArray(v) ? v.join(", ") : String(v)}
                  </dd>
                </div>
              );
            })}
            {typeof node["Rows Removed by Filter"] === "number" &&
              node["Rows Removed by Filter"] > 0 && (
                <div className="flex gap-2">
                  <dt>removed by filter</dt>
                  <dd>{node["Rows Removed by Filter"].toLocaleString()}</dd>
                </div>
              )}
            {typeof node["Shared Read Blocks"] === "number" && (
              <div className="flex gap-2">
                <dt>buffers</dt>
                <dd>
                  hit {node["Shared Hit Blocks"]?.toLocaleString() ?? 0}, read{" "}
                  {node["Shared Read Blocks"].toLocaleString()}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
      {open && children.length > 0 && (
        <ul>
          {children.map((c, i) => (
            <Node
              // biome-ignore lint/suspicious/noArrayIndexKey: plan children have no id
              key={i}
              node={c}
              depth={depth + 1}
              total={total}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function PlanTree({ plan, durationMs }: { plan: ExplainPlan; durationMs: number }) {
  const [raw, setRaw] = useState(false);
  const total = totalTime(plan);
  return (
    <ScrollArea className="h-full">
      <div className="flex items-center gap-3 px-3 pt-2 text-xs text-muted-foreground">
        <span>plan in {durationMs} ms</span>
        {typeof plan["Planning Time"] === "number" && (
          <span>planning {plan["Planning Time"].toFixed(2)} ms</span>
        )}
        {typeof plan["Execution Time"] === "number" && (
          <span>execution {plan["Execution Time"].toFixed(2)} ms</span>
        )}
        <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setRaw((v) => !v)}>
          {raw ? "Tree" : "Raw JSON"}
        </Button>
      </div>
      {raw ? (
        <pre className="p-3 font-mono text-xs leading-relaxed">{JSON.stringify(plan, null, 2)}</pre>
      ) : (
        <ul className="p-2">
          <Node node={plan.Plan} depth={0} total={total} />
        </ul>
      )}
    </ScrollArea>
  );
}
