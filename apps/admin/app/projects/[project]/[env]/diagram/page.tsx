import { AppShell } from "@/components/app-shell";
import { ErDiagram } from "@/components/er-diagram";
import { getDiagram } from "@/lib/diagram";
import { type EnvParams, resolveDatabase } from "@/lib/env-params";
import { envLabel } from "@/lib/projects";
import { envPath, projectPath } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DiagramPage({ params }: { params: Promise<EnvParams> }) {
  await requireSession();
  const { project, env } = await params;
  const database = resolveDatabase({ project, env });
  const { tables, edges } = await getDiagram(database);
  return (
    <AppShell
      database={database}
      crumbs={[
        { label: project, href: projectPath(project) },
        { label: envLabel(env), href: envPath(database) },
        { label: "diagram" },
      ]}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        {tables.length} table{tables.length === 1 ? "" : "s"}, {edges.length} foreign key
        {edges.length === 1 ? "" : "s"}. Click a table name to open it.
      </p>
      <ErDiagram tables={tables} edges={edges} database={database} />
    </AppShell>
  );
}
