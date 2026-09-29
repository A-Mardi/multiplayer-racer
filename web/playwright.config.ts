import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:8193', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: {
    command: 'node ../scripts/test-server.mjs',
    url: 'http://127.0.0.1:8193/api/health',
    timeout: 120000,
    reuseExistingServer: false,
  },
});
