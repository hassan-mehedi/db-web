import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("unauthenticated users land on /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("login with TOTP, create and drop a database", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Databases" })).toBeVisible();

  await page.click("button:has-text('New database')");
  await page.fill("#db-name", "e2e_dev");
  await page.click("button:has-text('Preview SQL')");
  await expect(page.locator("[role=dialog] pre")).toContainText('CREATE DATABASE "e2e_dev"');
  await expect(page.locator("[role=dialog] pre")).toContainText(
    'CREATE ROLE "e2e_dev_authenticator"',
  );
  await page.click("[role=dialog] button:has-text('Create')");
  await expect(page.locator("[role=dialog]")).toContainText("created");
  await expect(page.locator("[role=dialog]")).toContainText(
    "PGRST_DB_URI=postgres://e2e_dev_authenticator:",
  );
  await page.click("[role=dialog] button:has-text('Close')");
  await expect(page.locator("a[href='/db/e2e_dev']")).toBeVisible();

  await page.goto("/db/e2e_dev/query");
  await page.click(".cm-content");
  await page.keyboard.type("select 1 as one");
  await page.click("button:has-text('Run')");
  await expect(page.locator("tbody tr").first()).toHaveText("1");

  await page.goto("/db/e2e_dev");
  await page.click("button:has-text('Drop database')");
  await page.fill("#drop-first", "e2e_dev");
  await page.check("[role=dialog] input[type=checkbox]");
  await page.click("[role=dialog] button:has-text('Drop')");
  await page.waitForURL("/");
  await expect(page.locator("a[href='/db/e2e_dev']")).toHaveCount(0);
});
