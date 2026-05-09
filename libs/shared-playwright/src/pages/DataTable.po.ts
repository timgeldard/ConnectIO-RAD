import type { Locator, Page } from '@playwright/test'

/**
 * Page Object for the @connectio/shared-ui DataTable component.
 * Targets [data-testid="data-table"] added to DataTable.tsx in Phase 3.
 */
export class DataTablePO {
  readonly root: Locator
  readonly rows: Locator
  readonly headers: Locator
  readonly emptyState: Locator

  constructor(page: Page, scope?: Locator) {
    const root = scope ?? page.locator('body')
    this.root = root.locator('[data-testid="data-table"]').first()
    this.rows = this.root.locator('[data-testid="data-table-row"]')
    this.headers = this.root.locator('[data-testid^="data-table-header"]')
    this.emptyState = this.root.locator('[data-testid="data-table-empty"]')
  }

  /** Returns a row locator filtered to only rows containing `text`. */
  rowWithText(text: string): Locator {
    return this.rows.filter({ hasText: text })
  }

  /** Returns the current visible row count. */
  async rowCount(): Promise<number> {
    return this.rows.count()
  }

  /** Clicks the header cell for the given column key. */
  async sortBy(column: string): Promise<void> {
    await this.root.locator(`[data-testid="data-table-header-${column}"]`).click()
  }
}
