import Link from "next/link";
import { CreateDatabaseDialog } from "@/components/create-database-dialog";
import { EnvBadge } from "@/components/env-badge";
import { Shell } from "@/components/shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDatabases } from "@/lib/queries";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireSession();
  const databases = await getDatabases();
  return (
    <Shell crumbs={[]}>
      <div className="mb-4 flex items-center">
        <h1 className="text-xl font-semibold">Databases</h1>
        <div className="ml-auto">
          <CreateDatabaseDialog />
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Env</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Connections</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {databases.map((d) => (
            <TableRow key={d.datname}>
              <TableCell className="font-mono">
                <Link href={`/db/${d.datname}`} className="hover:underline">
                  {d.datname}
                </Link>
              </TableCell>
              <TableCell>
                <EnvBadge database={d.datname} />
              </TableCell>
              <TableCell>{d.size}</TableCell>
              <TableCell>{d.connections}</TableCell>
            </TableRow>
          ))}
          {databases.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                No databases yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Shell>
  );
}
