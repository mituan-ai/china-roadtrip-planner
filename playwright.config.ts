import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:3011',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run start',
    url: 'http://127.0.0.1:3011/api/v1/health',
    reuseExistingServer: false,
    env: {
      PORT: '3011',
      AMAP_JS_KEY: 'test-js-key',
      AMAP_JS_SECURITY_CODE: 'test-security-code',
      AMAP_WEB_SERVICE_KEY: 'test-web-service-key',
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chrome', viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: process.env.CI ? undefined : 'chrome' } },
  ],
})
