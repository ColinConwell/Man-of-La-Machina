import { defineConfig, devices } from '../../apps/web/node_modules/@playwright/test/index.mjs';
import { findPort, url } from '../../apps/web/ports.mjs';

// Picked once by the runner; workers and the fixture inherit it.
if (process.env.TEST_WORKER_INDEX === undefined)
  process.env.MACHINA_RESULTS_FIXTURE_PORT = String(await findPort('results-fixture'));
const fixture = url('127.0.0.1', process.env.MACHINA_RESULTS_FIXTURE_PORT);

export default defineConfig({
  testDir: './browser-tests', workers: 1, fullyParallel: false, timeout: 30000,
  outputDir: '/tmp/machina-dashboard-browser-artifacts', reporter: 'list',
  webServer: { command: '.venv/bin/python -m tests.results_dashboard_fixture', cwd: new URL('../../', import.meta.url).pathname,
    url: fixture + '/api/runs', reuseExistingServer: false },
  use: { baseURL: fixture, trace: 'retain-on-failure', ...devices['Desktop Chrome'], viewport: {width: 1440, height: 1000} },
});
