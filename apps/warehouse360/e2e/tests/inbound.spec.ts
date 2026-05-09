import { test, expect } from '@connectio/shared-playwright'

test.describe('Inbound GR receipts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?module=inbound')
  })

  test('receipt list renders after plant selection', async ({ page, plantBar, dataTable }) => {
    await plantBar.selectPlant('DEMO_PLANT')
    await expect(dataTable.root).toBeVisible({ timeout: 15_000 })
  })

  test('receipt row click opens receipt detail drawer', async ({ page, plantBar, dataTable, drawer }) => {
    await plantBar.selectPlant('DEMO_PLANT')
    await expect(dataTable.rows.first()).toBeVisible({ timeout: 15_000 })
    await dataTable.rows.first().click()
    await expect(drawer.root).toBeVisible({ timeout: 8_000 })
  })
})
