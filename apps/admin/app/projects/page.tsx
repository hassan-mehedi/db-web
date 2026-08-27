import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CreateDatabaseDialog } from "@/components/create-database-dialog";
import { EnvBadge } from "@/components/env-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { groupByProject } from "@/lib/projects";
import { getDatabases } from "@/lib/queries";
import { envPath, projectPath } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  await requireSession();
  const projects = groupByProject(await getDatabases());
  return (
    <AppShell crumbs={[]} actions={<CreateDatabaseDialog />}>
      <div className="mb-6 flex items-end">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">
            {projects.length} project{projects.length === 1 ? "" : "s"},{" "}
            {projects.reduce((n, p) => n + p.envs.length, 0)} databases
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Card key={p.name} className="gap-3">
            <CardHeader>
              <CardTitle className="font-mono text-base">
                <Link href={projectPath(p.name)} className="hover:text-primary">
                  {p.name}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {p.envs.map((e) => (
                <Link
                  key={e.database}
                  href={envPath(e.database)}
                  className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <EnvBadge database={e.database} />
                  <span className="font-mono text-xs text-muted-foreground">{e.database}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {e.row.size} · {e.row.connections} conn
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        ))}
        {projects.length === 0 && (
          <p className="text-sm text-muted-foreground">No projects yet. Create one to start.</p>
        )}
      </div>
    </AppShell>
  );
}
