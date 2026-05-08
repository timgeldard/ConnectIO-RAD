import { test, expect } from '@playwright/test';

test.describe('Material selection flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/spc/validate-material', async (route) => {
      const body = await route.request().postDataJSON();
      if (body.material_id === 'MAT-1') {
        await route.fulfill({ json: { material_id: 'MAT-1', material_name: 'Test Material', valid: true } });
      } else {
        await route.fulfill({ json: { valid: false } });
      }
    });
    await page.route('**/api/spc/plants*', async (route) => {
      await route.fulfill({
        json: { plants: [{ plant_id: 'IE01', plant_name: 'Ireland' }, { plant_id: 'DE01', plant_name: 'Germany' }] },
      });
    });
    await page.route('**/api/spc/characteristics', async (route) => {
      await route.fulfill({
        json: { characteristics: [{ mic_id: 'MIC-1', mic_name: 'Test MIC', operation_id: '10', chart_type: 'individuals', batch_count: 50 }], attr_characteristics: [] },
      });
    });
    await page.goto('/');
  });

  test('entering a valid material ID enables the plant selector', async ({ page }) => {
    const input = page.locator('#spc-material');
    await input.fill('MAT-1');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Validated: Test Material')).toBeVisible();
    await expect(page.locator('#spc-plant')).toBeEnabled();
  });

  test('entering an invalid material ID shows an error state', async ({ page }) => {
    const input = page.locator('#spc-material');
    await input.fill('INVALID');
    await page.keyboard.press('Enter');
    await expect(page.locator('#spc-plant')).toBeDisabled();
  });

  test('plant selector shows authorized plants after material entry', async ({ page }) => {
    await page.locator('#spc-material').fill('MAT-1');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Validated: Test Material')).toBeVisible();

    const plantSelect = page.locator('#spc-plant');
    await plantSelect.click();
    await expect(page.locator('text=Ireland')).toBeVisible();
    await expect(page.locator('text=Germany')).toBeVisible();
  });

  test('selecting a plant enables the characteristics selector', async ({ page }) => {
    await page.locator('#spc-material').fill('MAT-1');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Validated: Test Material')).toBeVisible();
    await page.locator('#spc-plant').selectOption('IE01');
    await expect(page.locator('#spc-characteristic')).toBeEnabled();
  });
});
