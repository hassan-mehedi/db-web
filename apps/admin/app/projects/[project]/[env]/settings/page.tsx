import { AppShell } from "@/components/app-shell";
import { DropDatabaseDialog } from "@/components/drop-database-dialog";
import { EnvBadge } from "@/components/env-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type EnvParams, resolveDatabase } from "@/lib/env-params";
import { getDatabases } from "@/lib/queries";
import { envPath, projectPath } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<EnvParams> }) {
  await requireSession();
  const { project, env } = await params;
  const database = resolveDatabase({ project, env });
  const row = (await getDatabases()).find((d) => d.datname === database);
  return (
    <AppShell
      database={database}
      crumbs={[
        { label: project, href: projectPath(project) },
        { label: env, href: envPath(database) },
        { label: "settings" },
      ]}
    >
      <div className="mb-6 flex items-center gap-3">
        <h1 className="font-mono text-xl font-semibold">{database}</h1>
        <EnvBadge database={database} />
      </div>
      <div className="grid gap-4">
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Drop database</CardTitle>
            <CardDescription>
              Deletes every table and row. {row?.connections ?? 0} open connection
              {row?.connections === 1 ? "" : "s"} right now; tick force to terminate them first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DropDatabaseDialog database={database} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
