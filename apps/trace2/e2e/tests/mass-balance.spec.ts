import { test, expect } from '@connectio/shared-playwright'

test.describe('Mass balance panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="batch-id-input"]').fill('BATCH-E2E-001')
    await page.locator('[data-testid="trace-forward-btn"]').click()
    await expect(page.locator('[data-testid="trace-tree"]')).toBeVisible({ timeout: 30_000 })
  })

  test('mass balance panel appears with input and output quantities', async ({ page }) => {
    await expect(page.locator('[data-testid="mass-balance-panel"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid="mass-balance-input-qty"]')).toBeVisible()
    await expect(page.locator('[data-testid="mass-balance-output-qty"]')).toBeVisible()
  })

  test('quantities are numeric strings', async ({ page }) => {
    const inputText = await page
      .locator('[data-testid="mass-balance-input-qty"]')
      .innerText({ timeout: 10_000 })
    expect(parseFloat(inputText)).toBeGreaterThan(0)
  })
})
