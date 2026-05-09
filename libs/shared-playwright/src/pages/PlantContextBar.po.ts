import type { Page } from '@playwright/test'

/**
 * Page Object for the shared PlantContextBar component.
 * Targets [data-testid="topbar-plant-selector"] on the container div.
 * The inner <select> has data-testid="plant-selector-dropdown".
 * Each <option> has a data-plant-id attribute.
 */
export class PlantContextBarPO {
  constructor(private readonly page: Page) {}

  /** Selects the plant matching `plantId` via the native <select> element. */
  async selectPlant(plantId: string): Promise<void> {
    await this.page
      .locator('[data-testid="plant-selector-dropdown"]')
      .selectOption({ value: plantId })
    await this.page.waitForResponse(
      (r) => r.url().includes('/api/') && r.status() < 400,
      { timeout: 15_000 },
    )
  }

  /** Returns the currently selected plant ID from the <select> value. */
  async selectedPlant(): Promise<string> {
    return this.page
      .locator('[data-testid="plant-selector-dropdown"]')
      .inputValue()
  }
}
