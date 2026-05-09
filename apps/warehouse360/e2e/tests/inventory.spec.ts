import { test, expect } from '@connectio/shared-playwright'

test.describe('Inventory stock view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?module=inventory')
  })

  test('stock table renders after plant selection @smoke', async ({ page, plantBar, dataTable }) => {
    await plantBar.selectPlant('DEMO_PLANT')
    await expect(dataTable.root).toBeVisible({ timeout: 15_000 })
    const count = await dataTable.rowCount()
    expect(count).toBeGreaterThan(0)
  })

  test('material filter narrows the table', async ({ page, plantBar, dataTable }) => {
    await plantBar.selectPlant('DEMO_PLANT')
    await expect(dataTable.root).toBeVisible({ timeout: 15_000 })
    const before = await dataTable.rowCount()

    await page.locator('[data-testid="material-filter"]').fill('MAT-001')
    await page.keyboard.press('Enter')
    await page.waitForResponse((r) => r.url().includes('/api/inventory') && r.status() < 400, { timeout: 15_000 })

    const after = await dataTable.rowCount()
    expect(after).toBeLessThanOrEqual(before)
    expect(after).toBeGreaterThan(0)
  })

  test('row click opens bin detail drawer', async ({ page, plantBar, dataTable, drawer }) => {
    await plantBar.selectPlant('DEMO_PLANT')
    await expect(dataTable.rows.first()).toBeVisible({ timeout: 15_000 })
    await dataTable.rows.first().click()
    await expect(drawer.root).toBeVisible({ timeout: 8_000 })
  })

  test('drawer closes on close button', async ({ page, plantBar, dataTable, drawer }) => {
    await plantBar.selectPlant('DEMO_PLANT')
    await expect(dataTable.rows.first()).toBeVisible({ timeout: 15_000 })
    await dataTable.rows.first().click()
    await expect(drawer.root).toBeVisible({ timeout: 8_000 })
    await drawer.close()
    await expect(drawer.root).not.toBeVisible()
  })
})
