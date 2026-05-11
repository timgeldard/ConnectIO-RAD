/* eslint-disable jsdoc/require-jsdoc */
import type { Locator, Page } from '@playwright/test'

/**
 * Page Object for the slide-in detail drawer used in Warehouse360.
 * Targets [data-testid="drawer"] on the drawer root element.
 */
export class DrawerPO {
  readonly root: Locator

  constructor(page: Page) {
    this.root = page.locator('[data-testid="drawer"]')
  }

  /** Returns true when the drawer is visible. */
  async isOpen(): Promise<boolean> {
    return this.root.isVisible()
  }

  /** Clicks the drawer close button. */
  async close(): Promise<void> {
    await this.root.locator('[data-testid="drawer-close"]').click()
  }

  /** Returns the text of a labelled field within the drawer. */
  async getField(label: string): Promise<string> {
    return this.root
      .locator(`[data-testid="drawer-field"][data-label="${label}"] [data-testid="drawer-field-value"]`)
      .innerText()
  }
}
