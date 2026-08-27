import type { ReactNode } from "react";
import { AppSidebar } from "@/components/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { groupByProject } from "@/lib/projects";
import { getDatabaseNames } from "@/lib/queries";
import { requireSession } from "@/lib/session";

export async function ShellLayout({ children }: { children: ReactNode }) {
  await requireSession();
  const names = await getDatabaseNames();
  const projects = groupByProject(names.map((datname) => ({ datname }))).map((p) => ({
    name: p.name,
    envs: p.envs.map((e) => ({ env: e.env, database: e.database })),
  }));

  return (
    <SidebarProvider>
      <AppSidebar projects={projects} backupsUrl={process.env.BACKUPS_URL} />
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  );
}
