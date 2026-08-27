import { projectRoles } from "@db-web/bootstrap";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  CreateRoleDialog,
  DropRoleDialog,
  GrantRoleDialog,
  RevokeRoleButton,
} from "@/components/role-dialogs";
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
import { type EnvParams, resolveDatabase } from "@/lib/env-params";
import { envPath, projectPath, rolesPath } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const PURPOSE: Record<string, string> = {
  anon: "PostgREST unauthenticated requests",
  user: "PostgREST requests with a valid JWT",
  authenticator: "PostgREST connects as this role, then SET ROLE",
};

export default async function EnvRolesPage({
  params,
  searchParams,
}: {
  params: Promise<EnvParams>;
  searchParams: Promise<{ all?: string }>;
}) {
  await requireSession();
  const { project, env } = await params;
  const database = resolveDatabase({ project, env });
  const showAll = (await searchParams).all === "1";
  const all = await getRoles();
  const own = projectRoles(database);
  const ownNames = new Set(Object.values(own));
  const roles = showAll ? all : all.filter((r) => ownNames.has(r.rolname));
  const grantable = all.filter((r) => !r.rolsuper).map((r) => r.rolname);
  const missing = Object.values(own).filter((n) => !all.some((r) => r.rolname === n));

  return (
    <AppShell
      database={database}
      crumbs={[
        { label: project, href: projectPath(project) },
        { label: env, href: envPath(database) },
        { label: "roles" },
      ]}
      actions={<CreateRoleDialog />}
    >
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-semibold">Roles</h1>
        <Link
          href={showAll ? rolesPath(database) : `${rolesPath(database)}?all=1`}
          className="ml-auto text-sm text-muted-foreground hover:text-primary"
        >
          {showAll ? "Only this database's roles" : "All cluster roles"}
        </Link>
      </div>
      {missing.length > 0 && !showAll && (
        <p className="mb-4 text-sm text-muted-foreground">
          Not bootstrapped for PostgREST: missing{" "}
          <code className="font-mono">{missing.join(", ")}</code>.
        </p>
      )}
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
          {roles.map((r) => {
            const kind = Object.entries(own).find(([, n]) => n === r.rolname)?.[0];
            return (
              <TableRow key={r.rolname}>
                <TableCell>
                  <div className="font-mono">{r.rolname}</div>
                  {kind && <div className="text-xs text-muted-foreground">{PURPOSE[kind]}</div>}
                </TableCell>
                <TableCell className="space-x-1">
                  {r.rolsuper && <Badge variant="destructive">superuser</Badge>}
                  {r.rolcanlogin && <Badge variant="secondary">login</Badge>}
                  {r.rolcreatedb && <Badge variant="secondary">createdb</Badge>}
                  {r.rolcreaterole && <Badge variant="secondary">createrole</Badge>}
                </TableCell>
                <TableCell className="font-mono text-xs whitespace-normal">
                  {all
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
            );
          })}
          {roles.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                No roles for this database.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </AppShell>
  );
}
