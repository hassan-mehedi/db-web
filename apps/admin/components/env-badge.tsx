import { isProdDatabase } from "@db-web/bootstrap";
import { Badge } from "@/components/ui/badge";

export function EnvBadge({ database }: { database: string }) {
  const env = database.slice(database.lastIndexOf("_") + 1);
  if (isProdDatabase(database)) return <Badge variant="destructive">prod</Badge>;
  return <Badge variant="secondary">{env}</Badge>;
}
