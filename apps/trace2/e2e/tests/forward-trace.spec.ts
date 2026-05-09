import { test, expect } from '@connectio/shared-playwright'

/**
 * Forward trace journey — entering a batch ID and verifying the lineage
 * tree renders. This is the most complex data flow in the system:
 * recursive CTE lineage query → D3 tree render.
 *
 * @smoke: runs on every PR.
 */
test.describe('Forward trace', () => {
  test('batch ID input → lineage tree renders @smoke', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="batch-id-input"]').fill('BATCH-E2E-001')
    await page.locator('[data-testid="trace-forward-btn"]').click()

    await expect(page.locator('[data-testid="trace-tree"]')).toBeVisible({ timeout: 30_000 })
    const nodeCount = await page.locator('[data-testid="trace-node"]').count()
    expect(nodeCount).toBeGreaterThanOrEqual(1)
  })

  test('forward trace shows child nodes', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="batch-id-input"]').fill('BATCH-E2E-001')
    await page.locator('[data-testid="trace-forward-btn"]').click()

    await expect(page.locator('[data-testid="trace-tree"]')).toBeVisible({ timeout: 30_000 })
    // Root + children — forward trace should show at least 2 nodes for our seed batch
    const nodeCount = await page.locator('[data-testid="trace-node"]').count()
    expect(nodeCount).toBeGreaterThanOrEqual(2)
  })

  test('invalid batch ID shows empty state', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="batch-id-input"]').fill('BATCH-DOES-NOT-EXIST')
    await page.locator('[data-testid="trace-forward-btn"]').click()

    await expect(page.locator('[data-testid="trace-empty-state"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid="trace-tree"]')).not.toBeVisible()
  })
})
