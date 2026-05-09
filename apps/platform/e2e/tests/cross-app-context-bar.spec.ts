import { test, expect } from '@connectio/shared-playwright'

/**
 * Cross-app context bar — verifies the 40px banner that appears when a user
 * navigates from one module to another carrying entity context.
 * Uses the CrossAppContextBar component in shared-ui/shell.
 */
test.describe('Cross-app context bar', () => {
  test('context bar appears when navigating with cross-app params', async ({ page }) => {
    await page.goto('/cq?from=warehouse360&entity=processOrder&processOrderId=PO-001')
    await expect(page.locator('.connectio-ctx.plat-ctx-bar')).toBeVisible({ timeout: 10_000 })
  })

  test('context bar shows originating module label', async ({ page }) => {
    await page.goto('/cq?from=warehouse360&entity=processOrder&processOrderId=PO-001')
    const fromLabel = page.locator('.connectio-ctx-field .val').first()
    await expect(fromLabel).toContainText(/warehouse/i, { timeout: 10_000 })
  })

  test('context bar shows entity type', async ({ page }) => {
    await page.goto('/cq?from=warehouse360&entity=processOrder&processOrderId=PO-001')
    await expect(page.locator('.connectio-ctx-field .val').nth(1)).toContainText(/PO-001/i, { timeout: 10_000 })
  })

  test('clear button dismisses the context bar', async ({ page }) => {
    await page.goto('/cq?from=warehouse360&entity=processOrder&processOrderId=PO-001')
    await expect(page.locator('.connectio-ctx.plat-ctx-bar')).toBeVisible({ timeout: 10_000 })
    await page.locator('.connectio-ctx-action').click()
    await expect(page.locator('.connectio-ctx.plat-ctx-bar')).not.toBeVisible()
  })
})
