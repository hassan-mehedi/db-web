import Link from "next/link";
import { ColumnEditor } from "@/components/column-editor";
import { AddConstraintDialog, DropConstraintButton } from "@/components/constraint-dialogs";
import { DataGrid } from "@/components/data-grid";
import { DropTableDialog } from "@/components/drop-table-dialog";
import { CreateIndexDialog, DropIndexButton } from "@/components/index-dialogs";
import { TablesLayout } from "@/components/tables-layout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type EnvParams, resolveDatabase } from "@/lib/env-params";
import { getSchemasWithTables, getTableData, getTableDetails, PAGE_SIZE } from "@/lib/queries";
import { envPath, projectPath, tablePath, tablesPath } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const TABS = ["data", "columns", "constraints", "indexes"] as const;
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
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  await requireSession();
  const { project, env, schema, table } = await params;
  const database = resolveDatabase({ project, env });
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "data";
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const base = tablePath(database, schema, table);

  const [details, schemas] = await Promise.all([
    getTableDetails(database, schema, table),
    getSchemasWithTables(database),
  ]);
  const data = tab === "data" ? await getTableData(database, schema, table, page) : null;
  const allTables = schemas.flatMap((s) =>
    s.tables.map((t) => ({ schema: s.schema, table: t.relname })),
  );
  const rel = { database, schema, table };
  const columnNames = details.columns.map((c) => c.column_name);

  return (
    <TablesLayout
      database={database}
      schemas={schemas}
      selected={{ schema, table }}
      crumbs={[
        { label: project, href: projectPath(project) },
        { label: env, href: envPath(database) },
        { label: "tables", href: tablesPath(database) },
        { label: `${schema}.${table}` },
      ]}
    >
      <div className="mb-4 flex items-center gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`${base}?tab=${t}`}
            className={`px-3 py-2 text-sm ${t === tab ? "-mb-px border-b-2 border-primary font-medium text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t}
          </Link>
        ))}
        <div className="ml-auto pb-2">
          <DropTableDialog database={database} schema={schema} table={table} />
        </div>
      </div>

      {tab === "data" && data && (
        <>
          <DataGrid
            rel={{ database, schema, table }}
            columns={data.columns}
            columnMeta={details.columns}
            rows={data.rows}
            primaryKey={data.primaryKey}
          />
          <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {data.total === 0
                ? "0 rows"
                : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, data.total)} of ${data.total}`}
            </span>
            <Button asChild size="sm" variant="outline" disabled={page === 0}>
              <Link href={`${base}?tab=data&page=${page - 1}`} aria-disabled={page === 0}>
                Prev
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                href={`${base}?tab=data&page=${page + 1}`}
                aria-disabled={(page + 1) * PAGE_SIZE >= data.total}
              >
                Next
              </Link>
            </Button>
          </div>
        </>
      )}

      {tab === "columns" && (
        <ColumnEditor database={database} schema={schema} table={table} columns={details.columns} />
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
    </TablesLayout>
  );
}
