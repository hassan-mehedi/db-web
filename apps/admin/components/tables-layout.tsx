import type { ReactNode } from "react";
import { AppShell, type Crumb } from "@/components/app-shell";
import { TableTree, type TreeSchema } from "@/components/table-tree";

export function TablesLayout({
  database,
  schemas,
  selected,
  crumbs,
  actions,
  children,
}: {
  database: string;
  schemas: TreeSchema[];
  selected?: { schema: string; table: string } | undefined;
  crumbs: Crumb[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppShell database={database} crumbs={crumbs} actions={actions} wide>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="max-h-64 shrink-0 border-b md:max-h-none md:w-64 md:border-r md:border-b-0">
          <TableTree database={database} schemas={schemas} selected={selected} />
        </aside>
        <section className="min-w-0 flex-1 overflow-x-auto p-4">{children}</section>
      </div>
    </AppShell>
  );
}
