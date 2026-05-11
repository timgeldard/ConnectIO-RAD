import { test, expect } from '@connectio/shared-playwright'
import { PlatformShellPO } from '@connectio/shared-playwright'

test.describe('Deep-link URL restoration', () => {
  test('?module= param activates the correct module on load', async ({ page }) => {
    await page.goto('/cq?module=warehouse360')
    const shell = new PlatformShellPO(page)
    const activeId = await shell.activeModule()
    expect(activeId).toBe('warehouse360')
  })

  test('navigating between modules updates the URL', async ({ page }) => {
    const shell = new PlatformShellPO(page)
    await page.goto('/cq')
    await shell.navigateTo('spc')
    await expect(page).toHaveURL(/module=spc/, { timeout: 5_000 })
  })

  test('?plant= param pre-selects the plant on load', async ({ page }) => {
    await page.goto('/cq?plant=C351')
    // Plant selector should reflect the URL param
    await expect(page.locator('[data-testid="topbar-plant-selector"]')).toContainText(/C351/i, { timeout: 10_000 })
  })
})
