import { test as base, expect } from '@playwright/test'
import { PlantContextBarPO } from '../pages/PlantContextBar.po'
import { DataTablePO } from '../pages/DataTable.po'
import { KPICardPO } from '../pages/KPICard.po'
import { DrawerPO } from '../pages/Drawer.po'
import { mockAllApiRoutes } from './mockApi'

/** Extended test context available to all ConnectIO E2E tests. */
export interface ConnectIOTestContext {
  /** Page object for the plant selector bar. */
  plantBar: PlantContextBarPO
  /** Page object for the primary data table on the page. */
  dataTable: DataTablePO
  /** Page object for KPI summary cards. */
  kpiCard: KPICardPO
  /** Page object for the slide-in detail drawer. */
  drawer: DrawerPO
}

/**
 * App name injected by each app-level playwright.config.ts via
 * the E2E_APP_NAME env var. Consumed by the mockApi auto-fixture.
 */
const APP_NAME = process.env.E2E_APP_NAME ?? 'unknown'

export const test = base.extend<ConnectIOTestContext>({
  plantBar: async ({ page }, use) => {
    await use(new PlantContextBarPO(page))
  },
  dataTable: async ({ page }, use) => {
    await use(new DataTablePO(page))
  },
  kpiCard: async ({ page }, use) => {
    await use(new KPICardPO(page))
  },
  drawer: async ({ page }, use) => {
    await use(new DrawerPO(page))
  },

  /** Auto-fixture: when E2E_USE_FIXTURES=1, intercept all /api/* calls with local JSON. */
  page: async ({ page }, use) => {
    if (process.env.E2E_USE_FIXTURES === '1') {
      await mockAllApiRoutes(page, APP_NAME)
    }
    await use(page)
  },
})

export { expect }
