import type { ReactNode } from "react";
import { groupByProject } from "@/lib/projects";
import { getDatabaseNames } from "@/lib/queries";
import { requireSession } from "@/lib/session";
import { Sidebar } from "./sidebar";

export async function ShellLayout({ children }: { children: ReactNode }) {
  await requireSession();
  const names = await getDatabaseNames();
  const projects = groupByProject(names.map((datname) => ({ datname }))).map((p) => ({
    name: p.name,
    envs: p.envs.map((e) => ({ env: e.env, database: e.database })),
  }));

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar projects={projects} backupsUrl={process.env.BACKUPS_URL} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
