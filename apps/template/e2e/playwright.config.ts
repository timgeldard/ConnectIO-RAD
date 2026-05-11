import { defineConfig } from '@playwright/test'
import base from '../../../playwright.config'

/**
 * Playwright config for Template Module E2E tests.
 * Backend: uvicorn on :8012, Frontend: Vite on :5206.
 */
export default defineConfig({
  ...base,
  testDir: './tests',
  webServer: [
    {
      command: 'uv run --no-sync --package template-backend uvicorn template_backend.main:app --port 8012',
      url: 'http://localhost:8012/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
      env: { APP_ENV: 'test' },
    },
    {
      command: 'vite --port 5206',
      url: 'http://localhost:5206',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      cwd: 'apps/template/frontend',
      env: { VITE_BASE_PATH: '/' },
    },
  ],
  use: {
    ...base.use,
    baseURL: 'http://localhost:5206',
  },
})
