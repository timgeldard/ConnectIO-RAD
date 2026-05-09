import { test, expect } from '@connectio/shared-playwright'
import { PlatformShellPO } from '@connectio/shared-playwright'

/**
 * Platform shell module-switching journey.
 * Any change to PlatformShell, LeftRail, or ModuleContentPanel that breaks
 * left-rail navigation will fail these tests.
 *
 * @smoke: runs on every PR.
 */
test.describe('Module switching', () => {
  test('left-rail loads and shows navigation @smoke', async ({ page }) => {
    const shell = new PlatformShellPO(page)
    await page.goto('/cq')
    await expect(shell.rail).toBeVisible({ timeout: 10_000 })
  })

  test('navigating to warehouse360 switches content panel @smoke', async ({ page }) => {
    const shell = new PlatformShellPO(page)
    await page.goto('/cq')
    await shell.navigateTo('warehouse360')
    // The W360 control tower or app root must appear
    await expect(
      page.locator('[data-testid="w360-control-tower"], [data-testid="app-shell"]').first()
    ).toBeVisible({ timeout: 15_000 })
  })

  test('navigating to spc switches content panel', async ({ page }) => {
    const shell = new PlatformShellPO(page)
    await page.goto('/cq')
    await shell.navigateTo('spc')
    await expect(page.locator('[data-testid="topbar-plant-selector"]')).toBeVisible({ timeout: 10_000 })
  })

  test('active module is reflected in rail state', async ({ page }) => {
    const shell = new PlatformShellPO(page)
    await page.goto('/cq')
    await shell.navigateTo('warehouse360')
    const activeId = await shell.activeModule()
    expect(activeId).toBe('warehouse360')
  })
})
