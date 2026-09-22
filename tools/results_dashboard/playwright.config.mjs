import { defineConfig, devices } from '../../apps/web/node_modules/@playwright/test/index.mjs';
export default defineConfig({
  testDir: './browser-tests', workers: 1, fullyParallel: false, timeout: 30000,
  outputDir: '/tmp/machina-dashboard-browser-artifacts', reporter: 'list',
  webServer: { command: '.venv/bin/python -m tests.results_dashboard_fixture', cwd: new URL('../../', import.meta.url).pathname,
    url: 'http://127.0.0.1:8137/api/runs', reuseExistingServer: false },
  use: { baseURL: 'http://127.0.0.1:8137', trace: 'retain-on-failure', ...devices['Desktop Chrome'], viewport: {width: 1440, height: 1000} },
});
