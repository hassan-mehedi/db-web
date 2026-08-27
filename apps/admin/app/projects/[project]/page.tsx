import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CreateDatabaseDialog } from "@/components/create-database-dialog";
import { EnvBadge } from "@/components/env-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { groupByProject } from "@/lib/projects";
import { getDatabases } from "@/lib/queries";
import { envPath, queryPath, tablesPath } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ project: string }> }) {
  await requireSession();
  const { project } = await params;
  const group = groupByProject(await getDatabases()).find((p) => p.name === project) ?? {
    name: project,
    envs: [],
  };
  return (
    <AppShell crumbs={[{ label: project }]} actions={<CreateDatabaseDialog project={project} />}>
      <h1 className="mb-4 font-mono text-xl font-semibold">{project}</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Environment</TableHead>
            <TableHead>Database</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Connections</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {group.envs.map((e) => (
            <TableRow key={e.database}>
              <TableCell>
                <Link href={envPath(e.database)}>
                  <EnvBadge database={e.database} />
                </Link>
              </TableCell>
              <TableCell className="font-mono">
                <Link href={envPath(e.database)} className="hover:text-primary">
                  {e.database}
                </Link>
              </TableCell>
              <TableCell>{e.row.size}</TableCell>
              <TableCell>{e.row.connections}</TableCell>
              <TableCell className="space-x-3 text-right text-xs">
                <Link
                  href={tablesPath(e.database)}
                  className="text-muted-foreground hover:text-primary"
                >
                  Tables
                </Link>
                <Link
                  href={queryPath(e.database)}
                  className="text-muted-foreground hover:text-primary"
                >
                  SQL
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {group.envs.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No environments. Create one to start.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </AppShell>
  );
}
