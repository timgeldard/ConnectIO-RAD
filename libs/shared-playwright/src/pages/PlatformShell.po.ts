/* eslint-disable jsdoc/require-jsdoc */
import type { Locator, Page } from '@playwright/test'

/**
 * Page Object for the @connectio/shared-ui PlatformShell left-rail nav.
 * Targets [data-testid="rail-module-{moduleId}"] buttons in LeftRail.tsx.
 */
export class PlatformShellPO {
  readonly rail: Locator
  readonly body: Locator

  constructor(private readonly page: Page) {
    this.rail = page.locator('[data-testid="left-rail"]')
    this.body = page.locator('[data-testid="shell-body"]')
  }

  /** Clicks the rail button for the given module ID and waits for the panel to load. */
  async navigateTo(moduleId: string): Promise<void> {
    await this.rail.locator(`[data-testid="rail-module-${moduleId}"]`).click()
    await this.page.waitForResponse(
      (r) => r.url().includes('/api/') && r.status() < 400,
      { timeout: 15_000 },
    )
  }

  /** Returns the moduleId attribute of the currently active rail button. */
  async activeModule(): Promise<string | null> {
    return this.rail.locator('.connectio-rail-mod.active').getAttribute('data-module-id')
  }

  /** Pins a hidden module back to the rail via the "Add module" picker. */
  async pinModule(moduleId: string): Promise<void> {
    await this.rail.locator('[data-testid="rail-add-module"]').click()
    await this.page.locator(`[data-testid="rail-picker-item-${moduleId}"]`).click()
  }
}
