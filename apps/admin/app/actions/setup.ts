"use server";

import QRCode from "qrcode";
import { createAuth } from "@/lib/auth";
import { hasUsers } from "@/lib/setup";

export type SetupResponse =
  | { ok: true; qr: string; totpURI: string; backupCodes: string[] }
  | { ok: false; error: string };

export async function beginSetup(email: string, password: string): Promise<SetupResponse> {
  if (await hasUsers()) return { ok: false, error: "setup already completed" };
  if (password.length < 8) return { ok: false, error: "password must be at least 8 characters" };
  const auth = createAuth({ allowSignUp: true });
  try {
    const signUp = await auth.api.signUpEmail({
      body: { email, password, name: "admin" },
      returnHeaders: true,
    });
    const headers = new Headers({ cookie: signUp.headers.get("set-cookie") ?? "" });
    const enabled = await auth.api.enableTwoFactor({ body: { password }, headers });
    if (enabled.method !== "totp")
      return { ok: false, error: `unexpected 2fa method ${enabled.method}` };
    return {
      ok: true,
      qr: await QRCode.toDataURL(enabled.totpURI, { margin: 1, width: 220 }),
      totpURI: enabled.totpURI,
      backupCodes: enabled.backupCodes,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
