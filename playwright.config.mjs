import {defineConfig} from "../../apps/web/node_modules/@playwright/test/index.mjs";
import {findPort} from "../../apps/web/ports.mjs";
if (process.env.TEST_WORKER_INDEX === undefined) {
  process.env.MACHINA_DESIGN_FIXTURE_PORT = String(await findPort("design-fixture"));
}
const baseURL = `http://127.0.0.1:${process.env.MACHINA_DESIGN_FIXTURE_PORT}`;
export default defineConfig({
  testDir: "./browser-tests", workers: 1, timeout: 60000,
  reporter: "list", use: {baseURL, viewport: {width:1440,height:1000}, trace:"retain-on-failure"},
  webServer: {
    command: `.venv/bin/python -m tools.design_preview --port ${process.env.MACHINA_DESIGN_FIXTURE_PORT}`,
    cwd: new URL("../../",import.meta.url).pathname,
    url: baseURL+"/healthz", reuseExistingServer:false,
  },
});
