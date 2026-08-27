import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("unauthenticated users land on /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("login with TOTP, create, use, clone and drop a database", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();

  await page.click("button:has-text('New project')");
  await page.fill("#db-project", "e2e");
  await page.fill("#db-env", "dev");
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
  await expect(page.locator("a[href='/projects/e2e/dev']").first()).toBeVisible();

  await page.goto("/db/e2e_dev/query");
  await expect(page).toHaveURL(/\/projects\/e2e\/dev\/query$/);
  await page.click(".cm-content");
  await page.keyboard.type("select 1 as one");
  await page.click("button:has-text('Run')");
  await expect(page.locator("tbody tr").first()).toHaveText("1");
  await page.click("button:has-text('Explain')");
  await page.click("[role=menuitem]:text-is('Explain')");
  await expect(page.locator("pre")).toContainText("Result");
  await page.click("button:has-text('History')");
  await expect(page.locator("main aside")).toContainText("select 1 as one");

  await page.goto("/projects/e2e/dev/connect");
  await expect(page.locator("pre")).toContainText("e2e_dev_authenticator");
  await page.click("button:has-text('Node (pg)')");
  await expect(page.locator("pre")).toContainText("new Pool");

  await page.goto("/projects/e2e/dev/roles");
  await expect(page.locator("tbody")).toContainText("e2e_dev_anon");

  await page.goto("/projects/e2e/dev/monitoring");
  await expect(page.getByRole("heading", { name: "Monitoring" })).toBeVisible();
  await page.click("button:has-text('Sample now')");
  await expect(page.locator("main")).toContainText("last sample");

  await page.goto("/projects/e2e/dev/settings");
  await page.click("button:has-text('Clone environment')");
  await page.fill("#clone-env", "test");
  await page.click("button:has-text('Preview SQL')");
  await expect(page.locator("[role=dialog] pre")).toContainText(
    'CREATE DATABASE "e2e_test" TEMPLATE "e2e_dev"',
  );
  if (await page.locator("#clone-typed").isVisible()) await page.fill("#clone-typed", "e2e_dev");
  await page.click("[role=dialog] button:has-text('Clone')");
  await expect(page.locator("[role=dialog]")).toContainText("created from");
  await page.click("[role=dialog] button:has-text('Close')");

  for (const env of ["test", "dev"]) {
    await page.goto(`/projects/e2e/${env}/settings`);
    await page.click("button:has-text('Drop database')");
    await page.fill("#drop-first", `e2e_${env}`);
    await page.check("[role=dialog] input[type=checkbox]");
    await page.click("[role=dialog] button:has-text('Drop')");
    await page.waitForURL("/projects/e2e");
    await expect(page.locator(`a[href='/projects/e2e/${env}']`)).toHaveCount(0);
  }
});
