import { test, expect } from '@connectio/shared-playwright'

test.describe('Reverse trace', () => {
  test('reverse trace renders upstream nodes', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="batch-id-input"]').fill('BATCH-E2E-001')
    await page.locator('[data-testid="trace-reverse-btn"]').click()

    await expect(page.locator('[data-testid="trace-tree"]')).toBeVisible({ timeout: 30_000 })
    const nodeCount = await page.locator('[data-testid="trace-node"]').count()
    expect(nodeCount).toBeGreaterThanOrEqual(1)
  })

  test('direction toggle switches between forward and reverse views', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="batch-id-input"]').fill('BATCH-E2E-001')

    await page.locator('[data-testid="trace-forward-btn"]').click()
    await expect(page.locator('[data-testid="trace-tree"]')).toBeVisible({ timeout: 30_000 })

    await page.locator('[data-testid="trace-reverse-btn"]').click()
    await expect(page.locator('[data-testid="trace-tree"]')).toBeVisible({ timeout: 30_000 })
  })
})
