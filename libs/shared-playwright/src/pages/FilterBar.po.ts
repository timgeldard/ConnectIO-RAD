import type { Page } from '@playwright/test'

/**
 * Page Object for the @connectio/shared-ui GlobalFilterBar.
 * Covers the shared date-preset, commit, and reset controls used across apps.
 */
export class FilterBarPO {
  constructor(protected readonly page: Page) {}

  /** Clicks a date preset chip (e.g. "30d", "90d", "6m"). */
  async setDatePreset(label: string): Promise<void> {
    await this.page
      .locator('[data-testid="filter-bar"]')
      .locator(`[data-testid="date-preset-${label}"]`)
      .click()
  }

  /** Clicks the "Apply" / commit button to trigger a data fetch. */
  async commit(): Promise<void> {
    await this.page.locator('[data-testid="filter-bar-apply"]').click()
    await this.page.waitForResponse(
      (r) => r.url().includes('/api/') && r.status() < 400,
      { timeout: 20_000 },
    )
  }

  /** Clicks the reset button to clear all filters. */
  async reset(): Promise<void> {
    await this.page.locator('[data-testid="filter-bar-reset"]').click()
  }
}
