import { AppShell } from "@/components/app-shell";
import { SqlEditor } from "@/components/sql-editor";
import { type EnvParams, resolveDatabase } from "@/lib/env-params";
import { envPath, projectPath } from "@/lib/routes";
import { listSavedQueries } from "@/lib/saved-queries";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function QueryPage({ params }: { params: Promise<EnvParams> }) {
  await requireSession();
  const { project, env } = await params;
  const database = resolveDatabase({ project, env });
  const saved = await listSavedQueries(database);
  return (
    <AppShell
      database={database}
      crumbs={[
        { label: project, href: projectPath(project) },
        { label: env, href: envPath(database) },
        { label: "query" },
      ]}
    >
      <SqlEditor database={database} saved={saved} />
    </AppShell>
  );
}
