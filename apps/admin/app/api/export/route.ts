import { isValidDatabaseName } from "@db-web/bootstrap";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { getAuth } from "@/lib/auth";
import { csvFileName } from "@/lib/csv";
import { tableCsvStream } from "@/lib/export-table";
import { getTableDetails } from "@/lib/queries";
import { parseFilters, parseSort } from "@/lib/table-filters";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return new Response("unauthorized", { status: 401 });

  const q = req.nextUrl.searchParams;
  const database = q.get("database") ?? "";
  const schema = q.get("schema") ?? "";
  const table = q.get("table") ?? "";
  if (!isValidDatabaseName(database) || !schema || !table) {
    return new Response("bad request", { status: 400 });
  }

  let columns: string[];
  try {
    columns = (await getTableDetails(database, schema, table)).columns.map((c) => c.column_name);
  } catch (err) {
    return new Response(err instanceof Error ? err.message : String(err), { status: 400 });
  }
  if (columns.length === 0) return new Response("not found", { status: 404 });

  const filters = parseFilters(q.get("f") ?? undefined, columns);
  const sort = parseSort(q.get("s") ?? undefined, columns);
  return new Response(tableCsvStream(database, schema, table, filters, sort), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${csvFileName(database, schema, table)}"`,
      "cache-control": "no-store",
    },
  });
}
