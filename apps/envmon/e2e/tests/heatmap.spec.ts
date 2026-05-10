import { test, expect } from '@connectio/shared-playwright'

/**
 * EnvMon Heatmap journey — selecting a floor and verifying markers render.
 * 
 * @smoke: runs on every PR.
 */
test.describe('EnvMon Heatmap', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to envmon (assuming base path is /)
    await page.goto('/')
  })

  test('heatmap renders markers after plant and floor selection @smoke', async ({ page, plantBar }) => {
    await plantBar.selectPlant('C351')
    
    // Select floor F1 if not auto-selected
    const floorF1 = page.locator('[data-testid="floor-chip-F1"]')
    if (await floorF1.isVisible()) {
      await floorF1.click()
    }

    await expect(page.locator('[data-testid="floor-plan-svg"]')).toBeVisible({ timeout: 15_000 })
    
    const markers = page.locator('[data-testid="em-marker"]')
    await expect(markers.first()).toBeVisible({ timeout: 10_000 })
    expect(await markers.count()).toBeGreaterThan(0)
  })

  test('clicking a marker opens location details', async ({ page, plantBar, drawer }) => {
    await plantBar.selectPlant('C351')
    
    const marker = page.locator('[data-testid="em-marker"]').first()
    await expect(marker).toBeVisible({ timeout: 15_000 })
    
    await marker.click()
    
    // Detail drawer or side panel should show details
    await expect(page.locator('[data-testid="location-details"], [data-testid="drawer"]')).toBeVisible({ timeout: 8_000 })
  })

  test('sanitation persona shows blast radius halos', async ({ page, plantBar }) => {
    // Switch to sanitation persona
    await page.locator('[data-testid="persona-switcher"]').click()
    await page.locator('[data-testid="persona-option-sanitation"]').click()
    
    await plantBar.selectPlant('C351')
    await expect(page.locator('[data-testid="floor-plan-svg"]')).toBeVisible({ timeout: 15_000 })
    
    // Halos should be present for FAIL markers
    const halos = page.locator('.em-blast-radius')
    await expect(halos.first()).toBeVisible({ timeout: 10_000 })
  })
})
