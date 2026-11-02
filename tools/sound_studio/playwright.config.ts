import { defineConfig } from "@playwright/test";
import { findPort } from "../../apps/web/ports.mjs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
if (process.env.TEST_WORKER_INDEX === undefined) {
  process.env.MACHINA_SOUND_FIXTURE_PORT = String(
    await findPort("sound-fixture"),
  );
  process.env.SOUND_TEST_DATA = mkdtempSync(
    join(tmpdir(), "sound-studio-test-"),
  );
}
const baseURL = `http://127.0.0.1:${process.env.MACHINA_SOUND_FIXTURE_PORT}`;
export default defineConfig({
  testDir: "./browser-tests",
  workers: 1,
  timeout: 60000,
  reporter: "list",
  use: {
    channel: process.env.SOUND_TEST_BROWSER_CHANNEL || "chrome",
    baseURL,
    viewport: { width: 1536, height: 1024 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `tools/sound_studio/.venv/bin/python -m tools.sound_studio --fixture --data-dir "${process.env.SOUND_TEST_DATA}" --port ${process.env.MACHINA_SOUND_FIXTURE_PORT}`,
    cwd: new URL("../../", import.meta.url).pathname,
    url: baseURL + "/healthz",
    reuseExistingServer: false,
  },
});
