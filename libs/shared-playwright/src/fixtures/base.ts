import { test as base, expect } from '@playwright/test'
import { PlantContextBarPO } from '../pages/PlantContextBar.po'
import { DataTablePO } from '../pages/DataTable.po'
import { KPICardPO } from '../pages/KPICard.po'
import { DrawerPO } from '../pages/Drawer.po'

/** Extended test context available to all ConnectIO E2E tests. */
export interface ConnectIOTestContext {
  plantBar: PlantContextBarPO
  dataTable: DataTablePO
  kpiCard: KPICardPO
  drawer: DrawerPO
}

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
})

export { expect }
