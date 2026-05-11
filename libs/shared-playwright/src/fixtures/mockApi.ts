/* eslint-disable jsdoc/require-jsdoc */
import type { Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures')

/**
 * Intercepts all /api/* calls and responds with fixture JSON from
 * libs/shared-playwright/fixtures/{appName}/{endpoint}.json.
 *
 * Use in PR/offline runs (E2E_USE_FIXTURES=1) when no live Databricks
 * endpoint is available. Tests that use this MUST NOT assert on exact
 * numeric values — only on structural properties (element presence, row count > 0).
 */
export async function mockAllApiRoutes(page: Page, appName: string): Promise<void> {
  await page.route('/api/**', (route) => {
    const apiPath = new URL(route.request().url()).pathname.replace(/^\/api\//, '')
    const fixturePath = path.join(FIXTURES_DIR, appName, `${apiPath}.json`)

    if (fs.existsSync(fixturePath)) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: fs.readFileSync(fixturePath, 'utf-8'),
      })
    } else {
      // Return a structured empty response rather than a 404 — lets the UI
      // render its empty state rather than an error screen.
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], rows: [], data: [] }),
      })
    }
  })
}
