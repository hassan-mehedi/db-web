import Link from "next/link";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTableData, getTableDetails, PAGE_SIZE } from "@/lib/queries";
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
  params: Promise<{ database: string; schema: string; table: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  await requireSession();
  const { database, schema, table } = await params;
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "data";
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const base = `/db/${database}/${schema}/${table}`;

  const details = await getTableDetails(database, schema, table);
  const data = tab === "data" ? await getTableData(database, schema, table, page) : null;

  return (
    <Shell
      crumbs={[{ label: database, href: `/db/${database}` }, { label: schema }, { label: table }]}
    >
      <div className="mb-4 flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`${base}?tab=${t}`}
            className={`px-3 py-2 text-sm ${t === tab ? "border-b-2 border-foreground font-medium" : "text-muted-foreground"}`}
          >
            {t}
          </Link>
        ))}
      </div>

      {tab === "data" && data && (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {data.columns.map((c) => (
                    <TableHead key={c} className="font-mono">
                      {c}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id
                  <TableRow key={`${page}-${i}`}>
                    {row.map((cell, j) => (
                      <TableCell
                        key={data.columns[j]}
                        className="max-w-xs truncate font-mono text-xs"
                        title={cell ?? ""}
                      >
                        {cell === null ? <span className="text-muted-foreground">null</span> : cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Column</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Nullable</TableHead>
              <TableHead>Default</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {details.columns.map((c) => (
              <TableRow key={c.column_name}>
                <TableCell className="font-mono">{c.column_name}</TableCell>
                <TableCell className="font-mono text-xs">
                  {c.data_type}
                  {c.character_maximum_length ? `(${c.character_maximum_length})` : ""}
                </TableCell>
                <TableCell>{c.is_nullable === "YES" ? "yes" : "no"}</TableCell>
                <TableCell className="font-mono text-xs">{c.column_default ?? ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {tab === "constraints" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Definition</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {details.constraints.map((c) => (
              <TableRow key={c.conname}>
                <TableCell className="font-mono">{c.conname}</TableCell>
                <TableCell>{CONSTRAINT_TYPES[c.contype] ?? c.contype}</TableCell>
                <TableCell className="font-mono text-xs">{c.definition}</TableCell>
              </TableRow>
            ))}
            {details.constraints.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No constraints.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {tab === "indexes" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Definition</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {details.indexes.map((i) => (
              <TableRow key={i.indexname}>
                <TableCell className="font-mono">{i.indexname}</TableCell>
                <TableCell className="font-mono text-xs">{i.indexdef}</TableCell>
              </TableRow>
            ))}
            {details.indexes.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-muted-foreground">
                  No indexes.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </Shell>
  );
}
