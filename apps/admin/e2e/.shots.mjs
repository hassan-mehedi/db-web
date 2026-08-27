import { readFileSync } from "node:fs";
import { createOTP } from "@better-auth/utils/otp";
import { chromium } from "@playwright/test";

const base = "http://127.0.0.1:3111";
const { rawSecret } = JSON.parse(readFileSync("e2e/.state.json", "utf8"));
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`${base}/login`);
await page.fill("#email", "e2e@local.test");
await page.fill("#password", "e2e-password-123");
await page.click("button[type=submit]");
await page.waitForURL("**/login/2fa");
await page.fill("#code", await createOTP(rawSecret).totp());
await page.click("button[type=submit]");
await page.waitForURL("**/projects");
const shots = process.argv.slice(3);
for (const s of shots) {
  const [path, name] = s.split("=");
  await page.goto(base + path);
  await page.waitForLoadState("load");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  console.log(name, page.url());
}
await page.setViewportSize({ width: 390, height: 800 });
await page.goto(`${base}/projects/demo/dev`);
await page.waitForLoadState("load");
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/mobile.png` });
await browser.close();
