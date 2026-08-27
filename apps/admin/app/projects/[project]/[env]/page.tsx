import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CreateTableDialog } from "@/components/create-table-dialog";
import { EnvBadge } from "@/components/env-badge";
import { OwnershipAlert } from "@/components/ownership-alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type EnvParams, resolveDatabase } from "@/lib/env-params";
import { envLabel } from "@/lib/projects";
import {
  getCompletionSchema,
  getDatabaseAccess,
  getDatabases,
  getSchemasWithTables,
} from "@/lib/queries";
import { projectPath, tablePath, tablesPath } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EnvOverview({ params }: { params: Promise<EnvParams> }) {
  await requireSession();
  const { project, env } = await params;
  const database = resolveDatabase({ project, env });
  const [schemas, databases, access, tables] = await Promise.all([
    getSchemasWithTables(database),
    getDatabases(),
    getDatabaseAccess(database),
    getCompletionSchema(database),
  ]);
  const row = databases.find((d) => d.datname === database);
  const tableCount = schemas.reduce((n, s) => n + s.tables.length, 0);

  return (
    <AppShell
      database={database}
      crumbs={[{ label: project, href: projectPath(project) }, { label: envLabel(env) }]}
      actions={
        <CreateTableDialog
          database={database}
          schemas={schemas.map((s) => s.schema)}
          tables={tables}
        />
      }
    >
      <OwnershipAlert database={database} access={access} />
      <div className="mb-6 flex items-center gap-3">
        <h1 className="font-mono text-xl font-semibold">{database}</h1>
        <EnvBadge database={database} />
      </div>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Size" value={row?.size ?? "?"} />
        <Stat label="Connections" value={String(row?.connections ?? "?")} />
        <Stat label="Tables" value={String(tableCount)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {schemas.map(({ schema, tables }) => (
          <Card key={schema} className="gap-2">
            <CardHeader>
              <CardTitle className="font-mono text-sm text-muted-foreground">{schema}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1 text-sm">
                {tables.slice(0, 8).map((t) => (
                  <li key={t.relname} className="flex items-center">
                    <Link
                      href={tablePath(database, schema, t.relname)}
                      className="font-mono hover:text-primary"
                    >
                      {t.relname}
                    </Link>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {Number(t.est_rows) < 0 ? "?" : t.est_rows} rows · {t.size}
                    </span>
                  </li>
                ))}
                {tables.length > 8 && (
                  <li>
                    <Link href={tablesPath(database)} className="text-xs text-primary">
                      {tables.length - 8} more
                    </Link>
                  </li>
                )}
                {tables.length === 0 && <li className="text-muted-foreground">No tables.</li>}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl">{value}</div>
    </div>
  );
}
