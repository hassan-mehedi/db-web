import { readFileSync } from "node:fs";
import { createOTP } from "@better-auth/utils/otp";
import type { Page } from "@playwright/test";
import { E2E_USER, STATE_FILE } from "./global-setup";

export async function login(page: Page) {
  const { rawSecret } = JSON.parse(readFileSync(STATE_FILE, "utf8")) as { rawSecret: string };
  await page.goto("/login");
  await page.fill("#email", E2E_USER.email);
  await page.fill("#password", E2E_USER.password);
  await page.click("button[type=submit]");
  await page.waitForURL("**/login/2fa");
  await page.fill("#code", await createOTP(rawSecret).totp());
  await page.click("button[type=submit]");
  await page.waitForURL("/");
}
