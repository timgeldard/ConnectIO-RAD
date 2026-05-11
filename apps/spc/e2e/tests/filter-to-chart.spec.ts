import { test, expect, waitForChart } from '@connectio/shared-playwright'
import { SPCFilterBarPO } from '../pages/SPCFilterBar.po'

/**
 * SPC filter-to-chart journey — the most regression-sensitive flow.
 *
 * A change to SPCFilterBar, SPCContext, or the shared-ui GlobalFilterBar that
 * breaks the filter → API call → chart render pipeline will be caught here.
 *
 * Tagged @smoke: runs on every PR via mocked API routes.
 */
test.describe('SPC filter-to-chart pipeline', () => {
  test('full filter pipeline renders control chart @smoke', async ({ page }) => {
    const filterBar = new SPCFilterBarPO(page)
    await page.goto('/')

    await filterBar.selectPlant('C351')
    await filterBar.typeMaterial('20582002')
    await filterBar.confirmMaterial()
    await filterBar.selectMIC('Viscosity')
    await filterBar.setDatePreset('90d')
    await filterBar.commit()

    await waitForChart(page, 'control-chart-svg', 25_000)
    // At least one chart container must be present
    await expect(page.locator('[data-testid="control-chart-svg"]').first()).toBeVisible()
  })

  test('changing date preset triggers chart reload', async ({ page }) => {
    const filterBar = new SPCFilterBarPO(page)
    await page.goto('/')

    await filterBar.selectPlant('C351')
    await filterBar.typeMaterial('20582002')
    await filterBar.confirmMaterial()
    await filterBar.selectMIC('Viscosity')
    await filterBar.setDatePreset('30d')
    await filterBar.commit()
    await waitForChart(page, 'control-chart-svg', 25_000)

    // Switch to 90d and verify a new API call fires
    const requestPromise = page.waitForRequest((r) => r.url().includes('/api/charts'), { timeout: 10_000 })
    await filterBar.setDatePreset('90d')
    await filterBar.commit()
    await requestPromise
    await waitForChart(page, 'control-chart-svg', 25_000)
  })

  test('resetting filters returns to empty state', async ({ page }) => {
    const filterBar = new SPCFilterBarPO(page)
    await page.goto('/')
    await filterBar.selectPlant('C351')
    await filterBar.typeMaterial('20582002')
    await filterBar.confirmMaterial()
    await filterBar.reset()
    // After reset the chart container should not be visible
    await expect(page.locator('[data-testid="control-chart-svg"]')).not.toBeVisible()
  })
})
