import type { Locator, Page } from '@playwright/test'

/**
 * Page Object for the @connectio/shared-ui KPI component.
 * Targets [data-testid="kpi-card"] added to KPI.tsx in Phase 3.
 */
export class KPICardPO {
  readonly root: Locator

  constructor(page: Page, scope?: Locator) {
    this.root = (scope ?? page.locator('body')).locator('[data-testid="kpi-card"]')
  }

  /** Returns the KPI card with the given label text. */
  withLabel(label: string): Locator {
    return this.root.filter({ has: this.root.page().locator(`[data-testid="kpi-label"]:text("${label}")`) })
  }

  /** Returns the display value of the first (or scoped) KPI card. */
  async getValue(cardLocator?: Locator): Promise<string> {
    return (cardLocator ?? this.root.first())
      .locator('[data-testid="kpi-value"]')
      .innerText()
  }

  /** Returns the tone class applied to the card (ok | warn | risk | neutral). */
  async getTone(cardLocator?: Locator): Promise<string | null> {
    return (cardLocator ?? this.root.first()).getAttribute('data-tone')
  }
}
