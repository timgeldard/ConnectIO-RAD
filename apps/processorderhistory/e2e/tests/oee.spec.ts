import { test, expect } from '@connectio/shared-playwright'

/**
 * OEE / Equipment Insights journey.
 * Verifies that the equipment performance metrics and charts render correctly.
 * 
 * @smoke: runs on every PR.
 */
test.describe('OEE / Equipment Insights', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to equipment insights v2 module
    await page.goto('/equipment-insights-2')
  })

  test('equipment list loads and shows status @smoke', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /equipment estate/i })).toBeVisible()
    
    // Wait for equipment cards or table rows
    const equipmentItems = page.locator('[data-testid="equipment-card"], [data-testid="data-table-row"]')
    await expect(equipmentItems.first()).toBeVisible({ timeout: 15_000 })
    
    expect(await equipmentItems.count()).toBeGreaterThan(0)
  })

  test('OEE and performance metrics are visible', async ({ page, kpiCard }) => {
    // Switch to Overview tab if not active
    const overviewTab = page.locator('button', { hasText: /overview/i })
    if (await overviewTab.isVisible()) {
      await overviewTab.click()
    }

    await expect(kpiCard.root.first()).toBeVisible({ timeout: 15_000 })
    const labels = await kpiCard.labels()
    
    // Look for performance related labels
    expect(labels.some(l => /OEE|performance|utilisation/i.test(l))).toBe(true)
  })
})
