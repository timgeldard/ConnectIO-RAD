import { test, expect, waitForChart } from '@connectio/shared-playwright'
import { SPCFilterBarPO } from '../pages/SPCFilterBar.po'

test.describe('Point exclusion', () => {
  test.beforeEach(async ({ page }) => {
    const filterBar = new SPCFilterBarPO(page)
    await page.goto('/')
    await filterBar.selectPlant('C351')
    await filterBar.typeMaterial('20582002')
    await filterBar.confirmMaterial()
    await filterBar.selectMIC('Viscosity')
    await filterBar.setDatePreset('90d')
    await filterBar.commit()
    await waitForChart(page, 'control-chart-svg', 25_000)
  })

  test('clicking a chart point opens the exclusion modal', async ({ page }) => {
    // Click the first rendered data point
    await page.locator('[data-testid="chart-point"]').first().click()
    await expect(page.locator('[data-testid="exclusion-modal"]')).toBeVisible({ timeout: 5_000 })
  })

  test('exclusion modal requires justification before confirming', async ({ page }) => {
    await page.locator('[data-testid="chart-point"]').first().click()
    await expect(page.locator('[data-testid="exclusion-modal"]')).toBeVisible({ timeout: 5_000 })
    // Confirm button should be disabled without a justification
    await expect(page.locator('[data-testid="exclusion-confirm"]')).toBeDisabled()
    // After typing justification it becomes enabled
    await page.locator('[data-testid="exclusion-justification-input"]').fill('Outlier due to calibration error')
    await expect(page.locator('[data-testid="exclusion-confirm"]')).toBeEnabled()
  })
})
