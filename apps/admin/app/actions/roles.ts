"use server";

import { projectRoles } from "@db-web/bootstrap";
import { maintenancePool } from "@db-web/db";
import { alterRolePassword } from "@db-web/sql";
import { audit } from "@/lib/audit";
import { generatePassword } from "@/lib/password";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "./cluster";

export async function resetAuthenticatorPasswordAction(
  database: string,
): Promise<ActionResult<{ password: string }>> {
  await requireSession();
  const role = projectRoles(database).authenticator;
  const password = generatePassword();
  try {
    const sql = alterRolePassword(role, password);
    audit("reset-password", database, alterRolePassword(role, "<redacted>"));
    await maintenancePool().query(sql);
    return { ok: true, sql: alterRolePassword(role, "<redacted>"), data: { password } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
