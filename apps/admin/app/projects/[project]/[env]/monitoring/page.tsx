import Link from "next/link";
import { ActivityTable } from "@/components/activity-table";
import { AppShell } from "@/components/app-shell";
import { LineChart } from "@/components/line-chart";
import { LockWaits } from "@/components/lock-waits";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type EnvParams, resolveDatabase } from "@/lib/env-params";
import {
  getActivity,
  getBloat,
  getLockWaits,
  getSeries,
  getTopStatements,
  getUnusedIndexes,
  lastSampleAt,
  statStatementsAvailable,
  WINDOWS,
  type Window,
} from "@/lib/metrics";
import { envLabel } from "@/lib/projects";
import { envPath, monitoringPath, projectPath, queryPath, tablePath } from "@/lib/routes";
import { requireSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function bytes(v: number) {
  if (v > 1e9) return `${(v / 1e9).toFixed(1)} GB`;
  if (v > 1e6) return `${(v / 1e6).toFixed(1)} MB`;
  if (v > 1e3) return `${(v / 1e3).toFixed(0)} kB`;
  return `${v} B`;
}

export default async function MonitoringPage({
  params,
  searchParams,
}: {
  params: Promise<EnvParams>;
  searchParams: Promise<{ w?: string }>;
}) {
  await requireSession();
  const { project, env } = await params;
  const database = resolveDatabase({ project, env });
  const sp = await searchParams;
  const window: Window = WINDOWS.includes(sp.w as Window) ? (sp.w as Window) : "1h";

  const [series, statements, activity, hasExt, lastAt, locks, bloat, unused] = await Promise.all([
    getSeries(database, window),
    getTopStatements(database),
    getActivity(database),
    statStatementsAvailable(),
    lastSampleAt(),
    getLockWaits(database),
    getBloat(database),
    getUnusedIndexes(database),
  ]);
  const labels = series.map((p) => p.ts.slice(window === "7d" ? 5 : 11, 16));
  const latest = series.at(-1);

  return (
    <AppShell
      database={database}
      crumbs={[
        { label: project, href: projectPath(project) },
        { label: envLabel(env), href: envPath(database) },
        { label: "monitoring" },
      ]}
    >
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-semibold">Monitoring</h1>
        <span className="text-xs text-muted-foreground">
          {lastAt ? `last sample ${lastAt.slice(0, 19).replace("T", " ")}` : "no samples yet"}
        </span>
        <div className="ml-auto flex gap-1 rounded-md border p-0.5 text-xs">
          {WINDOWS.map((w) => (
            <Link
              key={w}
              href={`${monitoringPath(database)}?w=${w}`}
              className={cn(
                "rounded px-2 py-1",
                w === window
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {w}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Tile label="Connections" value={latest ? String(latest.connections) : "–"} />
        <Tile
          label="Cache hit"
          value={latest?.cache_hit == null ? "–" : `${(latest.cache_hit * 100).toFixed(1)}%`}
        />
        <Tile label="Commits / min" value={latest ? String(latest.commits) : "–"} />
        <Tile label="Size" value={latest ? bytes(latest.size_bytes) : "–"} />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <LineChart
          title="Connections"
          labels={labels}
          series={[
            { label: "open", color: "var(--chart-1)", values: series.map((p) => p.connections) },
          ]}
        />
        <LineChart
          title="Transactions per minute"
          labels={labels}
          series={[
            { label: "commits", color: "var(--chart-1)", values: series.map((p) => p.commits) },
            { label: "rollbacks", color: "var(--chart-4)", values: series.map((p) => p.rollbacks) },
          ]}
        />
        <LineChart
          title="Cache hit ratio"
          labels={labels}
          max={1}
          format={(v) => `${(v * 100).toFixed(0)}%`}
          series={[
            { label: "hit", color: "var(--chart-2)", values: series.map((p) => p.cache_hit) },
          ]}
        />
        <LineChart
          title="Rows per minute"
          labels={labels}
          series={[
            { label: "read", color: "var(--chart-2)", values: series.map((p) => p.rows_read) },
            {
              label: "written",
              color: "var(--chart-3)",
              values: series.map((p) => p.rows_written),
            },
          ]}
        />
      </div>

      <section className="mb-8 grid gap-2">
        <h2 className="text-sm font-medium">Slowest statements (by total time, latest sample)</h2>
        {!hasExt && (
          <p className="text-sm text-muted-foreground">
            <code className="font-mono">pg_stat_statements</code> is not installed. Add{" "}
            <code className="font-mono">shared_preload_libraries=pg_stat_statements</code> to the
            Postgres command, restart, then{" "}
            <code className="font-mono">CREATE EXTENSION pg_stat_statements</code> as a superuser in
            the <code className="font-mono">postgres</code> database.
          </p>
        )}
        {hasExt && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>calls</TableHead>
                <TableHead>total ms</TableHead>
                <TableHead>mean ms</TableHead>
                <TableHead>rows</TableHead>
                <TableHead>query</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {statements.map((s) => (
                <TableRow key={s.queryid}>
                  <TableCell className="text-xs">{s.calls}</TableCell>
                  <TableCell className="text-xs">{s.total_exec_time.toFixed(1)}</TableCell>
                  <TableCell className="text-xs">{s.mean_exec_time.toFixed(2)}</TableCell>
                  <TableCell className="text-xs">{s.rows}</TableCell>
                  <TableCell className="max-w-xl truncate font-mono text-xs" title={s.query}>
                    {s.query}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`${queryPath(database)}?explain=${encodeURIComponent(s.query)}`}
                      className="text-xs text-primary"
                    >
                      Explain
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {statements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No statements sampled for this database yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </section>

      <div className="mb-8">
        <LockWaits database={database} rows={locks} />
      </div>

      <ActivityTable database={database} rows={activity} />

      <section className="mt-8 mb-8 grid gap-2">
        <h2 className="text-sm font-medium">Tables by dead rows</h2>
        <p className="text-xs text-muted-foreground">
          Dead rows wait for vacuum. A high share with an old vacuum time means bloat. Many seq
          scans on a big table usually means a missing index.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>table</TableHead>
              <TableHead>live</TableHead>
              <TableHead>dead</TableHead>
              <TableHead>dead %</TableHead>
              <TableHead>seq / idx scans</TableHead>
              <TableHead>last vacuum</TableHead>
              <TableHead>size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bloat.map((b) => {
              const pct = Number(b.dead_pct);
              return (
                <TableRow key={`${b.schema}.${b.table}`}>
                  <TableCell className="font-mono text-xs">
                    <Link href={tablePath(database, b.schema, b.table)} className="text-primary">
                      {b.schema}.{b.table}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">{Number(b.live).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{Number(b.dead).toLocaleString()}</TableCell>
                  <TableCell
                    className={cn(
                      "text-xs",
                      pct >= 20 && "text-amber-600 dark:text-amber-400",
                      pct >= 50 && "text-destructive",
                    )}
                  >
                    {b.dead_pct}%
                  </TableCell>
                  <TableCell className="text-xs">
                    {Number(b.seq_scan).toLocaleString()} / {Number(b.idx_scan).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {b.last_vacuum ? b.last_vacuum.slice(0, 16).replace("T", " ") : "never"}
                  </TableCell>
                  <TableCell className="text-xs">{bytes(Number(b.total_bytes))}</TableCell>
                </TableRow>
              );
            })}
            {bloat.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  No user tables.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <section className="mb-8 grid gap-2">
        <h2 className="text-sm font-medium">Indexes never scanned</h2>
        <p className="text-xs text-muted-foreground">
          Non-unique indexes with zero scans since the last stats reset. Each one costs write time
          and disk. Check the age of the stats before dropping anything.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>index</TableHead>
              <TableHead>table</TableHead>
              <TableHead>size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unused.map((u) => (
              <TableRow key={`${u.schema}.${u.index}`}>
                <TableCell className="font-mono text-xs">{u.index}</TableCell>
                <TableCell className="font-mono text-xs">
                  <Link
                    href={`${tablePath(database, u.schema, u.table)}?tab=indexes`}
                    className="text-primary"
                  >
                    {u.schema}.{u.table}
                  </Link>
                </TableCell>
                <TableCell className="text-xs">{bytes(Number(u.bytes))}</TableCell>
              </TableRow>
            ))}
            {unused.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  Every non-unique index has been used.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </AppShell>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl">{value}</div>
    </div>
  );
}
