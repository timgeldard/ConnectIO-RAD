import { test, assertVisualMatch } from '@connectio/shared-playwright'

/**
 * Visual regression tests for shared UI components.
 * These capture baseline screenshots and compare them against future runs.
 */
test.describe('Visual Regression', () => {
  test('Platform Shell layout', async ({ page }) => {
    await page.goto('/cq')
    // Wait for initial layout
    await page.waitForSelector('[data-testid="platform-shell"]')
    await assertVisualMatch(page, 'platform-shell-initial')
  })

  test('KPI Card appearance', async ({ page, kpiCard }) => {
    // Navigate to a page with KPI cards (e.g. Warehouse360)
    await page.goto('/cq?module=warehouse360')
    await page.locator('[data-testid="topbar-plant-selector"]').click()
    await page.locator('[data-plant-id="C351"]').click()
    
    await kpiCard.root.first().waitFor({ state: 'visible' })
    await assertVisualMatch(kpiCard.root.first(), 'shared-kpi-card')
  })

  test('Data Table appearance', async ({ page, dataTable }) => {
    await page.goto('/cq?module=warehouse360&tab=inventory')
    await page.locator('[data-testid="topbar-plant-selector"]').click()
    await page.locator('[data-plant-id="C351"]').click()
    
    await dataTable.root.waitFor({ state: 'visible' })
    await assertVisualMatch(dataTable.root, 'shared-data-table')
  })
})
