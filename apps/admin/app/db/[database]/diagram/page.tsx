import { ErDiagram } from "@/components/er-diagram";
import { Shell } from "@/components/shell";
import { getDiagram } from "@/lib/diagram";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DiagramPage({ params }: { params: Promise<{ database: string }> }) {
  await requireSession();
  const { database } = await params;
  const { tables, edges } = await getDiagram(database);
  return (
    <Shell crumbs={[{ label: database, href: `/db/${database}` }, { label: "diagram" }]}>
      <p className="mb-3 text-xs text-muted-foreground">
        {tables.length} table{tables.length === 1 ? "" : "s"}, {edges.length} foreign key
        {edges.length === 1 ? "" : "s"}. Click a table name to open it.
      </p>
      <ErDiagram tables={tables} edges={edges} database={database} />
    </Shell>
  );
}
