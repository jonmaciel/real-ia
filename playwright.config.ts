import { randomUUID } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3001",
    trace: "retain-on-failure",
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: "node --import tsx tests/mock-api.ts",
      port: 4010,
      reuseExistingServer: false,
    },
    {
      command:
        process.env.PLAYWRIGHT_PRODUCTION === "true"
          ? "npm run build && npm start"
          : "npm run dev",
      url: "http://localhost:3001",
      env: {
        LISTINGS_API_BASE_URL: `http://127.0.0.1:4010/contract-${randomUUID()}/api/v1/listings-platform`,
        APP_URL: "http://localhost:3001",
        DEMO_MODE: "false",
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
