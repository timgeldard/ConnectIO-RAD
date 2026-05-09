import { test, expect } from '@connectio/shared-playwright'

/**
 * Warehouse360 Control Tower — smoke and structural journey tests.
 *
 * The @smoke tag marks tests that run on every PR via mocked API routes.
 * All others run only in post-merge live runs against UAT.
 */

test.describe('Control Tower', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('page loads and shows plant selector @smoke', async ({ page }) => {
    await expect(page.locator('[data-testid="topbar-plant-selector"]')).toBeVisible()
  })

  test('KPI cards appear after plant selection @smoke', async ({ page, plantBar, kpiCard }) => {
    await plantBar.selectPlant('DEMO_PLANT')
    await expect(kpiCard.root.first()).toBeVisible({ timeout: 15_000 })
  })

  test('at-risk orders section is present', async ({ page, plantBar }) => {
    await plantBar.selectPlant('DEMO_PLANT')
    await expect(page.locator('[data-testid="at-risk-orders"]')).toBeVisible({ timeout: 15_000 })
  })

  test('navigation to inventory module works', async ({ page, plantBar }) => {
    await plantBar.selectPlant('DEMO_PLANT')
    await page.locator('[data-testid="nav-inventory"]').click()
    await expect(page.locator('[data-testid="data-table"]')).toBeVisible({ timeout: 15_000 })
  })
})
