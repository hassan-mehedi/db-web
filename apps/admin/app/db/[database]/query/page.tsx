import { Shell } from "@/components/shell";
import { SqlEditor } from "@/components/sql-editor";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function QueryPage({ params }: { params: Promise<{ database: string }> }) {
  await requireSession();
  const { database } = await params;
  return (
    <Shell crumbs={[{ label: database, href: `/db/${database}` }, { label: "query" }]}>
      <SqlEditor database={database} />
    </Shell>
  );
}
