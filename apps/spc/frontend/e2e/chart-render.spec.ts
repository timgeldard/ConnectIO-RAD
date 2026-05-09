import { test, expect } from '@playwright/test';

test.describe('Control chart rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/spc/validate-material', async (route) => {
      await route.fulfill({ json: { material_id: 'MAT-1', material_name: 'Test Material', valid: true } });
    });
    await page.route('**/api/spc/plants*', async (route) => {
      await route.fulfill({ json: { plants: [{ plant_id: 'IE01', plant_name: 'Ireland' }] } });
    });
    await page.route('**/api/spc/characteristics', async (route) => {
      await route.fulfill({
        json: {
          characteristics: [{ mic_id: 'MIC-1', mic_name: 'Weight', operation_id: '10', chart_type: 'xbar_r', batch_count: 100 }],
          attr_characteristics: [],
        },
      });
    });
    await page.route('**/api/spc/charts/data*', async (route) => {
      const points = Array.from({ length: 25 }, (_, i) => ({
        batch_id: `B${i + 1}`, value: 10 + Math.random() * 0.5, timestamp: new Date().toISOString(),
      }));
      await route.fulfill({ json: { data: points, ucl: 10.8, lcl: 9.2, cl: 10.0, cursor: null } });
    });
    await page.goto('/');
    await page.locator('#spc-material').fill('MAT-1');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Validated: Test Material')).toBeVisible();
    await page.locator('#spc-plant').selectOption('IE01');
  });

  test('control chart container renders after characteristic selection', async ({ page }) => {
    await page.locator('#spc-characteristic').selectOption('MIC-1');
    const chartsTab = page.locator('role=tab[name="Control Charts"]');
    await chartsTab.click();
    await expect(page.locator('[data-testid="chart-container"], canvas, svg').first()).toBeVisible({ timeout: 10000 });
  });

  test('chart tab becomes enabled after full selection', async ({ page }) => {
    await page.locator('#spc-characteristic').selectOption('MIC-1');
    const chartsTab = page.locator('role=tab[name="Control Charts"]');
    await expect(chartsTab).not.toBeDisabled();
  });

  test('no data state is surfaced when API returns empty dataset', async ({ page }) => {
    await page.route('**/api/spc/charts/data*', async (route) => {
      await route.fulfill({ json: { data: [], ucl: null, lcl: null, cl: null, cursor: null } });
    });
    await page.locator('#spc-characteristic').selectOption('MIC-1');
    const chartsTab = page.locator('role=tab[name="Control Charts"]');
    await chartsTab.click();
    await expect(page.locator('text=/no data|no measurements|empty/i').first()).toBeVisible({ timeout: 8000 });
  });
});
