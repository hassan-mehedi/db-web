import { AppShell } from "@/components/app-shell";
import { ConnectPanel } from "@/components/connect-panel";
import { connectInfo } from "@/lib/connect";
import { type EnvParams, resolveDatabase } from "@/lib/env-params";
import { envLabel } from "@/lib/projects";
import { envPath, projectPath } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ConnectPage({ params }: { params: Promise<EnvParams> }) {
  await requireSession();
  const { project, env } = await params;
  const database = resolveDatabase({ project, env });
  const info = connectInfo(database);
  return (
    <AppShell
      database={database}
      crumbs={[
        { label: project, href: projectPath(project) },
        { label: envLabel(env), href: envPath(database) },
        { label: "connect" },
      ]}
    >
      <h1 className="mb-1 text-xl font-semibold">Connect</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Postgres publishes no port.{" "}
        <code className="font-mono">
          {info.host}:{info.port}
        </code>{" "}
        resolves only inside <code className="font-mono">dokploy-network</code>, so apps run as
        Dokploy services
        {info.tailscaleHost ? (
          <>
            {" "}
            or you tunnel through <code className="font-mono">{info.tailscaleHost}</code>
          </>
        ) : null}
        .
      </p>
      <ConnectPanel info={info} />
    </AppShell>
  );
}
