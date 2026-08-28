import { withClient } from "@db-web/db";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getAuth } from "@/lib/auth";
import { runningBackend } from "@/lib/running";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body: unknown = await req.json().catch(() => null);
  const token =
    body && typeof body === "object" && typeof (body as { token?: unknown }).token === "string"
      ? (body as { token: string }).token
      : null;
  const target = token ? runningBackend(token) : null;
  if (!target) return NextResponse.json({ ok: false, error: "nothing running" }, { status: 404 });
  audit("cancel-query", target.database, `SELECT pg_cancel_backend(${target.pid})`);
  try {
    await withClient(target.database, (c) => c.query("SELECT pg_cancel_backend($1)", [target.pid]));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
