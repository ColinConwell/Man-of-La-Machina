import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: process.env.MACHINA_BROWSER_FIXTURE
    ? ["regression.spec.ts", "editorial.spec.ts"]
    : "exploration.spec.ts",
  webServer: process.env.MACHINA_BROWSER_FIXTURE
    ? [
        {
          command: ".venv/bin/python -m tests.exploration_fixture",
          cwd: new URL("../../", import.meta.url).pathname,
          url: "http://127.0.0.1:8002/api/v1/health",
          reuseExistingServer: !process.env.CI,
        },
        {
          command: ".venv/bin/python -m tests.curator_fixture",
          cwd: new URL("../../", import.meta.url).pathname,
          url: "http://127.0.0.1:8003/",
          reuseExistingServer: !process.env.CI,
        },
      ]
    : undefined,
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ||
      (process.env.MACHINA_BROWSER_FIXTURE
        ? "http://127.0.0.1:8002"
        : "http://127.0.0.1:5173"),
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
  reporter: "list",
});
