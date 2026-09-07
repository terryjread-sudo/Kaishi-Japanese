import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',testMatch:'offline-production.spec.ts',workers:1,timeout:180000,
  use:{baseURL:'http://127.0.0.1:4190',...devices['Desktop Chrome'],trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'npx vite preview --host 127.0.0.1 --port 4190 --strictPort',url:'http://127.0.0.1:4190',reuseExistingServer:!process.env.CI,timeout:120000},
});
