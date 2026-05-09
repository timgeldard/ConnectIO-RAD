import { test, expect } from '@connectio/shared-playwright'

test.describe('Dispensary', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?module=dispensary')
  })

  test('dispensary queue renders after plant selection', async ({ page, plantBar, dataTable }) => {
    await plantBar.selectPlant('DEMO_PLANT')
    await expect(dataTable.root).toBeVisible({ timeout: 15_000 })
  })

  test('queue shows material ID and requested quantity columns', async ({ page, plantBar, dataTable }) => {
    await plantBar.selectPlant('DEMO_PLANT')
    await expect(dataTable.root).toBeVisible({ timeout: 15_000 })
    await expect(dataTable.headers.filter({ hasText: /material/i }).first()).toBeVisible()
    await expect(dataTable.headers.filter({ hasText: /quantity/i }).first()).toBeVisible()
  })
})
