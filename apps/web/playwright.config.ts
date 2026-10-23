import { defineConfig, devices } from "@playwright/test";
import { findPort, serviceURL } from "./ports.mjs";

const fixture = !!process.env.MACHINA_BROWSER_FIXTURE;
if (fixture && process.env.TEST_WORKER_INDEX === undefined) {
  // The runner picks free ports once; workers re-evaluate this file and
  // inherit the choice through the environment, as do the fixture servers.
  const exploration = await findPort("exploration-fixture");
  const curator = await findPort("curator-fixture", { exclude: [exploration] });
  process.env.MACHINA_EXPLORATION_FIXTURE_PORT = String(exploration);
  process.env.MACHINA_CURATOR_FIXTURE_PORT = String(curator);
}
const { curatorFixtureURL, explorationFixtureURL } = await import(
  "./e2e/fixture-ports"
);

export default defineConfig({
  testDir: "./e2e",
  testMatch: fixture
    ? ["regression.spec.ts", "editorial.spec.ts"]
    : "exploration.spec.ts",
  // Fixtures get freshly chosen ports, so an existing server there is never ours.
  webServer: fixture
    ? [
        {
          command: ".venv/bin/python -m tests.exploration_fixture",
          cwd: new URL("../../", import.meta.url).pathname,
          url: explorationFixtureURL + "/api/v1/health",
          reuseExistingServer: false,
        },
        {
          command: ".venv/bin/python -m tests.curator_fixture",
          cwd: new URL("../../", import.meta.url).pathname,
          url: curatorFixtureURL + "/",
          reuseExistingServer: false,
        },
      ]
    : undefined,
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ||
      (fixture ? explorationFixtureURL : serviceURL("web")),
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
