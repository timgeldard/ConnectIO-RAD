import { test, expect } from '@connectio/shared-playwright'

test.describe('Alarm state', () => {
  test('alarm badge is visible on page load', async ({ page }) => {
    await page.goto('/')
    // The alarm badge count is loaded independently of the filter selection.
    // It should be visible even before a material is chosen.
    await expect(page.locator('[data-testid="alarm-badge"]')).toBeVisible({ timeout: 10_000 })
  })

  test('alarm count is a non-negative integer', async ({ page }) => {
    await page.goto('/')
    const text = await page.locator('[data-testid="alarm-badge"]').innerText({ timeout: 10_000 })
    expect(parseInt(text, 10)).toBeGreaterThanOrEqual(0)
  })
})
