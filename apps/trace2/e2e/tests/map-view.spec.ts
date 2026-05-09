import { test, expect } from '@connectio/shared-playwright'

test.describe('Geo map view', () => {
  test('map tab renders after trace completes', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="batch-id-input"]').fill('BATCH-E2E-001')
    await page.locator('[data-testid="trace-forward-btn"]').click()
    await expect(page.locator('[data-testid="trace-tree"]')).toBeVisible({ timeout: 30_000 })

    // Switch to map view
    await page.locator('[data-testid="trace-tab-map"]').click()
    await expect(page.locator('[data-testid="trace-map"]')).toBeVisible({ timeout: 10_000 })
  })

  test('map contains at least one plant marker', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="batch-id-input"]').fill('BATCH-E2E-001')
    await page.locator('[data-testid="trace-forward-btn"]').click()
    await page.locator('[data-testid="trace-tab-map"]').click()
    await expect(page.locator('[data-testid="trace-map"]')).toBeVisible({ timeout: 10_000 })

    const markerCount = await page.locator('[data-testid="map-plant-marker"]').count()
    expect(markerCount).toBeGreaterThanOrEqual(1)
  })
})
