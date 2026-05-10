import { expect, test } from '@playwright/test'

test('Template Module loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Template Module' })).toBeVisible()
})
