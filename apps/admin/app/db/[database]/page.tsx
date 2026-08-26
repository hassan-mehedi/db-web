import Link from "next/link";
import { CreateTableDialog } from "@/components/create-table-dialog";
import { DropDatabaseDialog } from "@/components/drop-database-dialog";
import { EnvBadge } from "@/components/env-badge";
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
import { getSchemasWithTables } from "@/lib/queries";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DatabasePage({ params }: { params: Promise<{ database: string }> }) {
  await requireSession();
  const { database } = await params;
  const schemas = await getSchemasWithTables(database);
  return (
    <Shell crumbs={[{ label: database }]}>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="font-mono text-xl font-semibold">{database}</h1>
        <EnvBadge database={database} />
        <div className="ml-auto flex gap-2">
          <CreateTableDialog database={database} schemas={schemas.map((s) => s.schema)} />
          <Button asChild size="sm" variant="outline">
            <Link href={`/db/${database}/query`}>SQL editor</Link>
          </Button>
          <DropDatabaseDialog database={database} />
        </div>
      </div>
      {schemas.map(({ schema, tables }) => (
        <section key={schema} className="mb-8">
          <h2 className="mb-2 font-mono text-sm text-muted-foreground">{schema}</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table</TableHead>
                <TableHead>Est. rows</TableHead>
                <TableHead>Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.map((t) => (
                <TableRow key={t.relname}>
                  <TableCell className="font-mono">
                    <Link
                      href={`/db/${database}/${schema}/${t.relname}`}
                      className="hover:underline"
                    >
                      {t.relname}
                    </Link>
                  </TableCell>
                  <TableCell>{Number(t.est_rows) < 0 ? "?" : t.est_rows}</TableCell>
                  <TableCell>{t.size}</TableCell>
                </TableRow>
              ))}
              {tables.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No tables.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
      ))}
    </Shell>
  );
}
