import { quoteIdent } from "@db-web/sql";
import { ShieldAlert } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { DatabaseAccess } from "@/lib/queries";

export function OwnershipAlert({ database, access }: { database: string; access: DatabaseAccess }) {
  if (access.canCreateInPublic) return null;
  const sql = `ALTER DATABASE ${quoteIdent(database)} OWNER TO ${quoteIdent(access.user)};`;
  return (
    <Alert className="mb-6">
      <ShieldAlert />
      <AlertTitle>
        {access.user} cannot create tables here. {database} is owned by {access.owner}.
      </AlertTitle>
      <AlertDescription>
        Run this once as a superuser, then reload:
        <code className="mt-1 block rounded bg-muted px-2 py-1 font-mono text-xs">{sql}</code>
      </AlertDescription>
      <AlertAction>
        <CopyButton text={sql} />
      </AlertAction>
    </Alert>
  );
}
