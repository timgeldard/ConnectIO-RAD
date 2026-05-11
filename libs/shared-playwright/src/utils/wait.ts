/* eslint-disable jsdoc/require-jsdoc */
import type { Page } from '@playwright/test'

/**
 * Waits for any /api/ response to succeed, signalling the backend (and
 * Databricks SQL warehouse) has warmed up. Use before assertions that
 * depend on live data in post-merge test runs.
 */
export async function waitForBackendWarm(page: Page, timeout = 90_000): Promise<void> {
  await page.waitForResponse(
    (r) => r.url().includes('/api/') && r.status() < 500,
    { timeout },
  )
}

/**
 * Waits for a chart SVG container to appear.
 * Used in SPC and EnvMon tests where chart render is the key success signal.
 */
export async function waitForChart(page: Page, testId = 'control-chart-svg', timeout = 25_000): Promise<void> {
  await page.locator(`[data-testid="${testId}"]`).waitFor({ state: 'visible', timeout })
}
