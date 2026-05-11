import { test, expect } from '@connectio/shared-playwright'
import { PlatformShellPO } from '@connectio/shared-playwright'

test.describe('Plant selection propagation', () => {
  test('plant selector is visible in shell top bar', async ({ page }) => {
    await page.goto('/cq')
    await expect(page.locator('[data-testid="topbar-plant-selector"]')).toBeVisible({ timeout: 10_000 })
  })

  test('selecting a plant triggers data fetch in active module', async ({ page, plantBar }) => {
    await page.goto('/cq')
    const shell = new PlatformShellPO(page)
    await shell.navigateTo('warehouse360')

    const responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/') && r.status() < 400,
      { timeout: 15_000 },
    )
    await plantBar.selectPlant('C351')
    await responsePromise
  })
})
