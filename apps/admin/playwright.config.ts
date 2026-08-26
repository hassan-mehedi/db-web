import { defineConfig } from "@playwright/test";

const port = 3199;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...(process.env.CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } }
      : {}),
  },
  webServer: {
    command: `node .next/standalone/apps/admin/server.js`,
    port,
    reuseExistingServer: false,
    env: {
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      BETTER_AUTH_URL: `http://127.0.0.1:${port}`,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "e2e-secret-e2e-secret-e2e-secret-1234",
      DATABASE_URL_MAINTENANCE: process.env.DATABASE_URL_MAINTENANCE ?? "",
      DATABASE_URL_META: process.env.DATABASE_URL_META ?? "",
    },
  },
});
