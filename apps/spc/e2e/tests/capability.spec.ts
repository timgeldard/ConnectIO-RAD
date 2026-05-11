import { test, expect, waitForChart } from '@connectio/shared-playwright'
import { SPCFilterBarPO } from '../pages/SPCFilterBar.po'

test.describe('Capability panel', () => {
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

  test('capability panel is visible alongside the control chart', async ({ page }) => {
    await expect(page.locator('[data-testid="capability-panel"]')).toBeVisible({ timeout: 10_000 })
  })

  test('Cpk and Pp metrics are rendered', async ({ page }) => {
    const panel = page.locator('[data-testid="capability-panel"]')
    await expect(panel).toBeVisible({ timeout: 10_000 })
    await expect(panel.locator('[data-testid="cpk-value"]')).toBeVisible()
    await expect(panel.locator('[data-testid="pp-value"]')).toBeVisible()
  })
})
