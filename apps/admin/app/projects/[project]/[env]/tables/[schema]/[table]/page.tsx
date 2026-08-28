import Link from "next/link";
import { Suspense } from "react";
import { ColumnEditor } from "@/components/column-editor";
import { AddConstraintDialog, DropConstraintButton } from "@/components/constraint-dialogs";
import { DataGrid } from "@/components/data-grid";
import { DropTableDialog } from "@/components/drop-table-dialog";
import { CreateIndexDialog, DropIndexButton } from "@/components/index-dialogs";
import { DependenciesTab, PoliciesTab, TriggersTab } from "@/components/table-security";
import { TableTabs, TabSkeleton } from "@/components/table-tabs";
import { TablesLayout } from "@/components/tables-layout";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type EnvParams, resolveDatabase } from "@/lib/env-params";
import { envLabel } from "@/lib/projects";
import {
  getCompletionSchema,
  getSchemasWithTables,
  getTableData,
  getTableDetails,
  getTableExtras,
  prettyBytes,
} from "@/lib/queries";
import { envPath, projectPath, tablePath, tablesPath } from "@/lib/routes";
import { requireSession } from "@/lib/session";
import { parseFilters, parseSort } from "@/lib/table-filters";

export const dynamic = "force-dynamic";

const TABS = [
  "data",
  "columns",
  "constraints",
  "indexes",
  "triggers",
  "policies",
  "dependencies",
] as const;
type Tab = (typeof TABS)[number];

const CONSTRAINT_TYPES: Record<string, string> = {
  p: "primary key",
  f: "foreign key",
  u: "unique",
  c: "check",
  x: "exclusion",
};

export default async function TablePage({
  params,
  searchParams,
}: {
  params: Promise<EnvParams & { schema: string; table: string }>;
  searchParams: Promise<SearchParams>;
}) {
  await requireSession();
  const { project, env, schema, table } = await params;
  const database = resolveDatabase({ project, env });
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "data";
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const base = tablePath(database, schema, table);
  const exact = sp.count === "exact";
  const dataQuery = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams({ tab: "data" });
    if (exact) q.set("count", "exact");
    if (sp.f) q.set("f", sp.f);
    if (sp.s) q.set("s", sp.s);
    for (const [k, v] of Object.entries(extra)) if (v !== undefined) q.set(k, v);
    return `${base}?${q}`;
  };

  const [schemas, extras] = await Promise.all([
    getSchemasWithTables(database),
    getTableExtras(database, schema, table),
  ]);
  const stats = extras.stats;

  return (
    <TablesLayout
      database={database}
      schemas={schemas}
      selected={{ schema, table }}
      crumbs={[
        { label: project, href: projectPath(project) },
        { label: envLabel(env), href: envPath(database) },
        { label: "tables", href: tablesPath(database) },
        { label: `${schema}.${table}` },
      ]}
    >
      {stats && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
          <span title="live rows from pg_stat_user_tables, updated by analyze">
            ~{Number(stats.live).toLocaleString()} rows
          </span>
          <span
            title={`table ${prettyBytes(Number(stats.table_bytes))}, indexes ${prettyBytes(Number(stats.index_bytes))}`}
          >
            {prettyBytes(Number(stats.total_bytes))}
          </span>
          {Number(stats.dead) > 0 && <span>{Number(stats.dead).toLocaleString()} dead rows</span>}
          <span>
            {Number(stats.seq_scan).toLocaleString()} seq /{" "}
            {Number(stats.idx_scan).toLocaleString()} idx scans
          </span>
          {(stats.last_autovacuum ?? stats.last_vacuum) && (
            <span>
              vacuumed{" "}
              {(stats.last_autovacuum ?? stats.last_vacuum ?? "").slice(0, 16).replace("T", " ")}
            </span>
          )}
        </div>
      )}
      <TableTabs
        base={base}
        tabs={TABS}
        active={tab}
        counts={{
          triggers: extras.triggers.length,
          policies: extras.policies.length,
          dependencies: extras.dependencies.length,
        }}
        actions={<DropTableDialog database={database} schema={schema} table={table} />}
      >
        <Suspense
          key={JSON.stringify(sp)}
          fallback={<TabSkeleton rows={tab === "data" ? 10 : 5} />}
        >
          <TabBody
            database={database}
            schema={schema}
            table={table}
            tab={tab}
            sp={sp}
            page={page}
            exact={exact}
            dataQuery={dataQuery}
            schemas={schemas}
            extras={extras}
          />
        </Suspense>
      </TableTabs>
    </TablesLayout>
  );
}

function parseCursor(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) && v.every((x) => typeof x === "string") ? v : undefined;
  } catch {
    return undefined;
  }
}

type SearchParams = {
  tab?: string;
  page?: string;
  after?: string;
  before?: string;
  count?: string;
  f?: string;
  s?: string;
};

async function TabBody({
  database,
  schema,
  table,
  tab,
  sp,
  page,
  exact,
  dataQuery,
  schemas,
  extras,
}: {
  database: string;
  schema: string;
  table: string;
  tab: Tab;
  sp: SearchParams;
  page: number;
  exact: boolean;
  dataQuery: (extra: Record<string, string | undefined>) => string;
  schemas: Awaited<ReturnType<typeof getSchemasWithTables>>;
  extras: Awaited<ReturnType<typeof getTableExtras>>;
}) {
  const [details, allColumns] = await Promise.all([
    getTableDetails(database, schema, table),
    getCompletionSchema(database),
  ]);
  const columnNames = details.columns.map((c) => c.column_name);
  const filters = parseFilters(sp.f, columnNames);
  const sort = parseSort(sp.s, columnNames);
  const data =
    tab === "data"
      ? await getTableData(database, schema, table, {
          page,
          after: parseCursor(sp.after),
          before: parseCursor(sp.before),
          exact,
          filters,
          sort,
        })
      : null;
  const allTables = schemas.flatMap((s) =>
    s.tables.map((t) => ({ schema: s.schema, table: t.relname })),
  );
  const rel = { database, schema, table };

  return (
    <>
      {tab === "data" && data && (
        <>
          <DataGrid
            rel={{ database, schema, table }}
            columns={data.columns}
            columnMeta={details.columns}
            foreignKeys={details.foreignKeys}
            rows={data.rows}
            primaryKey={data.primaryKey}
            filters={filters}
            sort={sort}
          />
          <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {data.rows.length} rows shown
              {data.total !== null && (
                <>
                  {" · "}
                  {data.estimated ? "~" : ""}
                  {data.total.toLocaleString()} total
                </>
              )}
              {data.estimated && (
                <>
                  {" "}
                  <Link
                    href={dataQuery({ after: sp.after, before: sp.before, page: sp.page })}
                    className="text-primary"
                  >
                    count exactly
                  </Link>
                </>
              )}
            </span>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href={
                      data.primaryKey.length && data.firstKey
                        ? dataQuery({ before: JSON.stringify(data.firstKey) })
                        : dataQuery({ page: String(Math.max(0, page - 1)) })
                    }
                    aria-disabled={!data.hasPrev}
                    className={data.hasPrev ? undefined : "pointer-events-none opacity-50"}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href={
                      data.primaryKey.length && data.lastKey
                        ? dataQuery({ after: JSON.stringify(data.lastKey) })
                        : dataQuery({ page: String(page + 1) })
                    }
                    aria-disabled={!data.hasNext}
                    className={data.hasNext ? undefined : "pointer-events-none opacity-50"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </>
      )}

      {tab === "columns" && (
        <ColumnEditor
          database={database}
          schema={schema}
          table={table}
          columns={details.columns}
          foreignKeys={details.foreignKeys}
          tables={allColumns}
        />
      )}

      {tab === "constraints" && (
        <div className="grid gap-3">
          <div>
            <AddConstraintDialog rel={rel} columns={columnNames} tables={allTables} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Definition</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.constraints.map((c) => (
                <TableRow key={c.conname}>
                  <TableCell className="font-mono">{c.conname}</TableCell>
                  <TableCell>{CONSTRAINT_TYPES[c.contype] ?? c.contype}</TableCell>
                  <TableCell className="font-mono text-xs">{c.definition}</TableCell>
                  <TableCell className="text-right">
                    <DropConstraintButton rel={rel} name={c.conname} />
                  </TableCell>
                </TableRow>
              ))}
              {details.constraints.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No constraints.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {tab === "triggers" && <TriggersTab rel={rel} triggers={extras.triggers} />}

      {tab === "policies" && (
        <PoliciesTab rel={rel} policies={extras.policies} rowSecurity={extras.rowSecurity} />
      )}

      {tab === "dependencies" && <DependenciesTab rel={rel} dependencies={extras.dependencies} />}

      {tab === "indexes" && (
        <div className="grid gap-3">
          <div>
            <CreateIndexDialog rel={rel} columns={columnNames} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Definition</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.indexes.map((i) => (
                <TableRow key={i.indexname}>
                  <TableCell className="font-mono">{i.indexname}</TableCell>
                  <TableCell className="font-mono text-xs">{i.indexdef}</TableCell>
                  <TableCell className="text-right">
                    <DropIndexButton rel={rel} name={i.indexname} />
                  </TableCell>
                </TableRow>
              ))}
              {details.indexes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No indexes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
