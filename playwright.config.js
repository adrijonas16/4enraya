import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
    testDir: 'tests/e2e',
    timeout: 60_000,
    fullyParallel: true,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: `http://localhost:${PORT}`,
        trace: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 820 } } }],
    webServer: {
        command: 'node scripts/serve.mjs',
        env: { PORT: String(PORT) },
        url: `http://localhost:${PORT}/index.html`,
        reuseExistingServer: !process.env.CI,
    },
});
