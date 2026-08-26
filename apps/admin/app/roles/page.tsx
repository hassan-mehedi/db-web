import {
  CreateRoleDialog,
  DropRoleDialog,
  GrantRoleDialog,
  RevokeRoleButton,
} from "@/components/role-dialogs";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRoles } from "@/lib/cluster";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  await requireSession();
  const roles = await getRoles();
  const grantable = roles.filter((r) => !r.rolsuper).map((r) => r.rolname);
  return (
    <Shell crumbs={[{ label: "roles" }]}>
      <div className="mb-4 flex items-center">
        <h1 className="text-xl font-semibold">Roles</h1>
        <div className="ml-auto">
          <CreateRoleDialog />
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Role</TableHead>
            <TableHead>Attributes</TableHead>
            <TableHead>Member of</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((r) => (
            <TableRow key={r.rolname}>
              <TableCell className="font-mono">{r.rolname}</TableCell>
              <TableCell className="space-x-1">
                {r.rolsuper && <Badge variant="destructive">superuser</Badge>}
                {r.rolcanlogin && <Badge variant="secondary">login</Badge>}
                {r.rolcreatedb && <Badge variant="secondary">createdb</Badge>}
                {r.rolcreaterole && <Badge variant="secondary">createrole</Badge>}
              </TableCell>
              <TableCell className="font-mono text-xs whitespace-normal">
                {roles
                  .filter((g) => g.members.includes(r.rolname))
                  .map((g) => (
                    <span key={g.rolname} className="mr-2 inline-flex items-center">
                      {g.rolname}
                      {!r.rolsuper && !g.rolsuper && (
                        <RevokeRoleButton role={g.rolname} from={r.rolname} />
                      )}
                    </span>
                  ))}
              </TableCell>
              <TableCell className="space-x-2 text-right whitespace-nowrap">
                {!r.rolsuper && <GrantRoleDialog to={r.rolname} roles={grantable} />}
                {!r.rolsuper && r.rolname !== "app_admin" && <DropRoleDialog name={r.rolname} />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Shell>
  );
}
