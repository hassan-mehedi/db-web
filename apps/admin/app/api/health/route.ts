import { maintenancePool } from "@db-web/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await maintenancePool().query("SELECT 1");
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
