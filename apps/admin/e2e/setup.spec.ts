import { writeFileSync } from "node:fs";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { expect, test } from "@playwright/test";
import { E2E_USER, STATE_FILE } from "./global-setup";

test("first run creates the admin user with TOTP in the browser", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/setup$/);

  await page.fill("#email", E2E_USER.email);
  await page.fill("#password", E2E_USER.password);
  await page.click("button[type=submit]");

  const uri = await page.locator("code").textContent();
  const secret = new URL(uri ?? "").searchParams.get("secret");
  if (!secret) throw new Error("no secret in totp uri");
  const rawSecret = new TextDecoder().decode(base32.decode(secret));
  await expect(page.locator("img[alt='TOTP QR code']")).toBeVisible();
  await expect(page.locator("pre")).not.toBeEmpty();

  await page.fill("#code", await createOTP(rawSecret).totp());
  await page.click("button[type=submit]");
  await page.waitForURL("/projects");
  writeFileSync(STATE_FILE, JSON.stringify({ rawSecret }));

  await page.context().clearCookies();
  await page.goto("/setup");
  await expect(page).toHaveURL(/\/login$/);
});
