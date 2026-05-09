import type { Page } from '@playwright/test'

/**
 * Page Object for the plant selector present in all ConnectIO apps.
 * Wraps the [data-testid="topbar-plant-selector"] element in TopBar.tsx.
 */
export class PlantContextBarPO {
  constructor(private readonly page: Page) {}

  /** Opens the plant dropdown and clicks the option matching `plantId`. */
  async selectPlant(plantId: string): Promise<void> {
    await this.page.locator('[data-testid="topbar-plant-selector"]').click()
    await this.page.locator(`[data-plant-id="${plantId}"]`).click()
    // Wait for the first successful API response — signals backend warmed up.
    await this.page.waitForResponse(
      (r) => r.url().includes('/api/') && r.status() < 400,
      { timeout: 15_000 },
    )
  }

  /** Returns the label text of the currently selected plant. */
  async selectedPlant(): Promise<string> {
    return this.page
      .locator('[data-testid="topbar-plant-selector"] [data-testid="plant-selected-label"]')
      .innerText()
  }
}
