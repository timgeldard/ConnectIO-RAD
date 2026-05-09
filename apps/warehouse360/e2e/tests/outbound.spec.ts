import { test, expect } from '@connectio/shared-playwright'

test.describe('Outbound deliveries', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?module=outbound')
  })

  test('delivery list renders after plant selection', async ({ page, plantBar, dataTable }) => {
    await plantBar.selectPlant('DEMO_PLANT')
    await expect(dataTable.root).toBeVisible({ timeout: 15_000 })
  })

  test('delivery row click opens delivery detail drawer', async ({ page, plantBar, dataTable, drawer }) => {
    await plantBar.selectPlant('DEMO_PLANT')
    await expect(dataTable.rows.first()).toBeVisible({ timeout: 15_000 })
    await dataTable.rows.first().click()
    await expect(drawer.root).toBeVisible({ timeout: 8_000 })
  })
})
