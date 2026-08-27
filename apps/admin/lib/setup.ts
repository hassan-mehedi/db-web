import { meta } from "./meta-db";

export async function hasUsers(): Promise<boolean> {
  const { rowCount } = await (await meta()).query('SELECT 1 FROM "user" LIMIT 1');
  return (rowCount ?? 0) > 0;
}
