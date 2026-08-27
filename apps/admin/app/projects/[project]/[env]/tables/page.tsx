import { CreateTableDialog } from "@/components/create-table-dialog";
import { TablesLayout } from "@/components/tables-layout";
import { type EnvParams, resolveDatabase } from "@/lib/env-params";
import { envLabel } from "@/lib/projects";
import { getCompletionSchema, getSchemasWithTables } from "@/lib/queries";
import { envPath, projectPath } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TablesPage({ params }: { params: Promise<EnvParams> }) {
  await requireSession();
  const { project, env } = await params;
  const database = resolveDatabase({ project, env });
  const [schemas, tables] = await Promise.all([
    getSchemasWithTables(database),
    getCompletionSchema(database),
  ]);
  const count = schemas.reduce((n, s) => n + s.tables.length, 0);
  return (
    <TablesLayout
      database={database}
      schemas={schemas}
      crumbs={[
        { label: project, href: projectPath(project) },
        { label: envLabel(env), href: envPath(database) },
        { label: "tables" },
      ]}
      actions={
        <CreateTableDialog
          database={database}
          schemas={schemas.map((s) => s.schema)}
          tables={tables}
        />
      }
    >
      <p className="text-sm text-muted-foreground">
        {count} table{count === 1 ? "" : "s"} in {schemas.length} schema
        {schemas.length === 1 ? "" : "s"}. Pick one on the left.
      </p>
    </TablesLayout>
  );
}
