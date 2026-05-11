import { test, expect } from '@connectio/shared-playwright'

/**
 * Pours analytics journey.
 * Verifies that the pour events and KPI cards render correctly.
 * 
 * @smoke: runs on every PR.
 */
test.describe('Pour Analytics', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to pours module
    await page.goto('/pours')
  })

  test('page loads and shows KPI cards @smoke', async ({ page, kpiCard }) => {
    await expect(page.getByRole('heading', { name: /pour analytics/i })).toBeVisible()
    // Wait for data load (using KPI card as proxy)
    await expect(kpiCard.root.first()).toBeVisible({ timeout: 15_000 })
    
    const count = await kpiCard.root.count()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('KPI cards show correct labels @smoke', async ({ kpiCard }) => {
    const labels = await kpiCard.labels()
    expect(labels).toContain('Target')
    expect(labels).toContain('Planned')
    expect(labels).toContain('Actual')
  })

  test('pour events list is populated', async ({ page }) => {
    // Wait for the contributors panel to show events
    const eventRows = page.locator('.contributors-panel div[style*="border-bottom"]')
    await expect(eventRows.first()).toBeVisible({ timeout: 15_000 })
    
    const count = await eventRows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('clicking process order navigates to order detail', async ({ page }) => {
    const poLink = page.locator('.contributors-panel button.btn-link').first()
    await expect(poLink).toBeVisible({ timeout: 15_000 })
    
    const poId = await poLink.innerText()
    await poLink.click()
    
    // URL should update to /orders/{poId} or similar
    await expect(page).toHaveURL(new RegExp(`/orders/${poId}`), { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: /process order detail/i })).toBeVisible()
  })
})
