import { expect, test } from '@connectio/shared-playwright'

/**
 * Template Module smoke tests.
 * 
 * @smoke: runs on every PR.
 */
test.describe('Template Module', () => {
  test('Template Module loads and shows title @smoke', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Template Module/i })).toBeVisible()
  })

  test('metric grid is populated @smoke', async ({ page }) => {
    await page.goto('/')
    const grid = page.locator('[data-testid="template-metric-grid"]')
    await expect(grid).toBeVisible({ timeout: 15_000 })
    
    const cards = page.locator('[data-testid="template-metric-card"]')
    await expect(cards.first()).toBeVisible({ timeout: 10_000 })
    expect(await cards.count()).toBeGreaterThanOrEqual(3)
  })

  test('individual metrics show correct values', async ({ page }) => {
    await page.goto('/')
    const cards = page.locator('[data-testid="template-metric-card"]')
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })
    
    // Check for a specific metric from the fixture
    const signalsMetric = cards.filter({ hasText: /signals/i })
    await expect(signalsMetric.locator('[data-testid="template-metric-value"]')).toHaveText('3')
  })
})
