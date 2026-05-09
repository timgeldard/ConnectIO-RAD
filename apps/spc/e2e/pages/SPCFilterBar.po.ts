import { FilterBarPO } from '@connectio/shared-playwright'
import type { Page } from '@playwright/test'

/**
 * SPC-specific filter bar PO extending the shared FilterBarPO.
 * Adds the material type-ahead, MIC selector, and plant picker that are
 * unique to the SPCFilterBar component.
 */
export class SPCFilterBarPO extends FilterBarPO {
  constructor(page: Page) {
    super(page)
  }

  /** Selects a plant via the filter bar plant dropdown. */
  async selectPlant(plantId: string): Promise<void> {
    await this.page.locator('[data-testid="topbar-plant-selector"]').click()
    await this.page.locator(`[data-plant-id="${plantId}"]`).click()
  }

  /** Types a material ID into the material search box and waits for suggestions. */
  async typeMaterial(materialId: string): Promise<void> {
    await this.page.locator('[data-testid="spc-material-input"]').fill(materialId)
    await this.page.locator('[data-testid="spc-material-suggestion"]').first().waitFor({ timeout: 10_000 })
  }

  /** Clicks the first matching suggestion to confirm the material. */
  async confirmMaterial(): Promise<void> {
    await this.page.locator('[data-testid="spc-material-suggestion"]').first().click()
  }

  /** Selects a MIC (Measurement / Inspection Characteristic) by label. */
  async selectMIC(micLabel: string): Promise<void> {
    await this.page.locator('[data-testid="spc-mic-select"]').click()
    await this.page.locator(`[data-testid="spc-mic-option"]`).filter({ hasText: micLabel }).click()
  }
}
