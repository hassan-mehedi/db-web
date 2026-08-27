import { isProdDatabase } from "@db-web/bootstrap";
import { Badge } from "@/components/ui/badge";
import { envLabel, parseDatabaseName } from "@/lib/projects";

export function EnvBadge({ database }: { database: string }) {
  if (isProdDatabase(database)) return <Badge variant="destructive">prod</Badge>;
  return <Badge variant="secondary">{envLabel(parseDatabaseName(database).env)}</Badge>;
}
