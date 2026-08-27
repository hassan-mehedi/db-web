import { AppShell } from "@/components/app-shell";
import { SqlEditor } from "@/components/sql-editor";
import { type EnvParams, resolveDatabase } from "@/lib/env-params";
import { envLabel } from "@/lib/projects";
import { listHistory } from "@/lib/query-history";
import { envPath, projectPath } from "@/lib/routes";
import { listSavedQueries } from "@/lib/saved-queries";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function QueryPage({
  params,
  searchParams,
}: {
  params: Promise<EnvParams>;
  searchParams: Promise<{ explain?: string }>;
}) {
  await requireSession();
  const { project, env } = await params;
  const database = resolveDatabase({ project, env });
  const initial = (await searchParams).explain ?? "";
  const [saved, history] = await Promise.all([listSavedQueries(database), listHistory(database)]);
  return (
    <AppShell
      database={database}
      crumbs={[
        { label: project, href: projectPath(project) },
        { label: envLabel(env), href: envPath(database) },
        { label: "query" },
      ]}
    >
      <SqlEditor database={database} saved={saved} history={history} initial={initial} />
    </AppShell>
  );
}
