# ConnectIO-RAD: Playwright E2E Integration Plan

> **Status:** Phase 0 — Plan committed, implementation not yet started
> **Last updated:** 2026-05-09
> **Owner:** Tim Geldard

---

## Progress Tracker

| Phase | Name | Status | Completed |
|---|---|---|---|
| 0 | Plan written and committed | ✅ Done | 2026-05-09 |
| 1 | Preparation — tooling, scaffold, first Nx target | ⬜ Not started | — |
| 2 | Foundation — auth fixture, base config, first green test | ⬜ Not started | — |
| 3 | Core Coverage — W360 + SPC journeys | ⬜ Not started | — |
| 4 | Expansion — Trace2, Platform shell, EnvMon, POH | ⬜ Not started | — |
| 5 | CI/CD Integration — PR smoke gate + live post-merge run | ⬜ Not started | — |
| 6 | Governance & Hardening — DoD update, flake budget | ⬜ Not started | — |

---

## 1. Executive Summary

**Objective:** Integrate Playwright as the E2E testing layer protecting critical manufacturing
workflows — filter-to-chart pipelines in SPC, forward/reverse trace in Trace2, inventory and
dispensary flows in Warehouse360, and cross-app navigation in the Platform shell.

**Why now:** The recent architectural consolidation (shared-ui `DataTable`/`KPI`/`PlatformShell`,
shared-app-context `PlantProvider`, shared-db DAL, shared-domain entities) introduced a class of
bugs that unit tests cannot catch: cross-boundary regressions where a shared component change
silently breaks an app that consumes it. E2E tests are the only reliable gate for these.

**Key benefits:**
- Protects the five shared libraries from silent regressions during future upgrades
- Validates the Databricks token passthrough (`x-forwarded-access-token`) auth flow end-to-end
- Enables load-shape profiling for the 500-concurrent-user scaling goal
- Completes the test pyramid: unit (Vitest/pytest) → integration (pytest httpx) → **E2E (Playwright)**

**Timeline:** 6 phases over ~14 weeks for a 2-person team, with smoke tests in CI by end of Phase 3.

---

## 2. Phase-by-Phase Implementation Plan

### Phase 1 — Preparation (Week 1, ~2 days)

**Goal:** Install tooling, establish folder conventions, and wire the first Nx `e2e` target with a
trivial health-check test.

**Steps:**

```bash
# 1. Install the Nx Playwright plugin and Playwright itself
npm install --save-dev @nx/playwright @playwright/test

# 2. Install browser binaries (Chromium is sufficient for Phase 1)
npx playwright install chromium

# 3. Scaffold the shared library skeleton
mkdir -p libs/shared-playwright/src/{fixtures,pages,utils}
touch libs/shared-playwright/src/index.ts
```

Create `libs/shared-playwright/project.json`:

```json
{
  "name": "shared-playwright",
  "projectType": "library",
  "tags": ["scope:shared", "type:e2e-support"],
  "targets": {
    "typecheck": {
      "executor": "nx:run-commands",
      "options": { "command": "tsc --noEmit", "cwd": "libs/shared-playwright" }
    }
  }
}
```

Create `libs/shared-playwright/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node", "@playwright/test"]
  },
  "include": ["src/**/*.ts"]
}
```

Add an e2e project for warehouse360 as the pilot app:

```bash
mkdir -p apps/warehouse360/e2e/tests
```

`apps/warehouse360/e2e/project.json`:

```json
{
  "name": "warehouse360-e2e",
  "projectType": "application",
  "tags": ["scope:warehouse360", "type:e2e"],
  "implicitDependencies": ["warehouse360-frontend", "warehouse360-backend"],
  "targets": {
    "e2e": {
      "executor": "nx:run-commands",
      "options": {
        "command": "npx playwright test --config=apps/warehouse360/e2e/playwright.config.ts",
        "cwd": "{workspaceRoot}"
      }
    },
    "e2e-ci": {
      "executor": "nx:run-commands",
      "options": {
        "command": "npx playwright test --config=apps/warehouse360/e2e/playwright.config.ts --reporter=blob",
        "cwd": "{workspaceRoot}"
      }
    }
  }
}
```

**Deliverable:** `npx nx e2e warehouse360-e2e` runs and finds no test files (zero failures).
The scaffolding is in place.

**Effort:** ~4 hours

---

### Phase 2 — Foundation (Weeks 2–3, ~5 days)

**Goal:** Build the shared fixture layer, auth simulation, and API mock infrastructure.
Write the first real test against the warehouse360 Control Tower.

#### 2a. Auth Strategy

Databricks Apps proxy injects `x-forwarded-access-token` from the user's OAuth session. In E2E
tests, the backend's `require_proxy_user()` reads this header. The strategy is:

1. **In UAT/staging:** Provision a service-principal PAT stored as `E2E_DATABRICKS_TOKEN` in
   GitHub Actions secrets. Tests inject it as the `x-forwarded-access-token` header via
   Playwright's `extraHTTPHeaders`.
2. **In local dev / PR runs:** The FastAPI backend's auth dependency is bypassed by setting
   `E2E_MOCK_AUTH=1`, which swaps in the same `mock_user` fixture already used in unit tests —
   exposed as a dedicated FastAPI `TestClient` startup mode, not via Playwright intercept.
3. **For pure frontend tests (no backend):** Use `page.route()` to mock all `/api/*` endpoints
   with fixture JSON.

> **Never** embed real tokens or PATs in test files. All credentials flow through environment
> variables.

#### 2b. Base playwright.config.ts (workspace root)

Create `playwright.config.ts` at the repo root as the base config that app-level configs extend:

```typescript
// playwright.config.ts  (workspace root — base only, not run directly)
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['blob'], ['github']]
    : [['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Inject the service-principal token on every request.
    // Backends read x-forwarded-access-token (Databricks Apps auth contract).
    extraHTTPHeaders: {
      'x-forwarded-access-token': process.env.E2E_DATABRICKS_TOKEN ?? 'e2e-dev-token',
    },
  },
  // Chromium only for speed in Phases 1–3; Firefox added in Phase 4.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
```

#### 2c. App-level config (warehouse360 pilot)

```typescript
// apps/warehouse360/e2e/playwright.config.ts
import { defineConfig } from '@playwright/test'
import base from '../../../playwright.config'

export default defineConfig({
  ...base,
  testDir: './tests',
  webServer: {
    command: [
      'npx nx serve warehouse360-frontend',
      'uv run --no-sync --package warehouse360-backend uvicorn warehouse360_backend.main:app --port 8000',
    ].join(' & '),
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      E2E_MOCK_AUTH: '1',
      VITE_BASE_PATH: '/',
    },
  },
  use: {
    ...base.use,
    baseURL: 'http://localhost:5173',
  },
})
```

#### 2d. Shared fixture base

```typescript
// libs/shared-playwright/src/fixtures/base.ts
import { test as base, expect, type Page } from '@playwright/test'
import { PlantContextBarPO } from '../pages/PlantContextBar.po'
import { DataTablePO } from '../pages/DataTable.po'

/** Extended test context available to all ConnectIO E2E tests. */
export type ConnectIOTestContext = {
  plantBar: PlantContextBarPO
  dataTable: DataTablePO
}

export const test = base.extend<ConnectIOTestContext>({
  plantBar: async ({ page }, use) => {
    await use(new PlantContextBarPO(page))
  },
  dataTable: async ({ page }, use) => {
    await use(new DataTablePO(page))
  },
})

export { expect }
```

**Deliverable:** First green test — warehouse360 Control Tower health check:

```typescript
// apps/warehouse360/e2e/tests/control-tower.spec.ts
import { test, expect } from '@connectio/shared-playwright'

test('Control Tower loads KPI cards', async ({ page, plantBar }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /warehouse/i })).toBeVisible()
  await plantBar.selectPlant('DEMO_PLANT')
  await expect(page.locator('[data-testid="kpi-card"]').first()).toBeVisible({ timeout: 10_000 })
})
```

**Effort:** ~5 days

---

### Phase 3 — Core Coverage (Weeks 4–7, ~12 days)

**Goal:** Full journey coverage for warehouse360 and SPC — the two most complex apps.
Add `data-testid` attributes to shared-ui components.

#### 3a. Add `data-testid` to shared-ui components

The shared `DataTable`, `KPI`, `StatusBadge`, `Card`, and `PlatformShell` components need stable
test hooks. `data-testid` survives refactors better than CSS classes or positional selectors.

| Component | `data-testid` to add |
|---|---|
| `DataTable.tsx` | `data-table`, `data-table-row`, `data-table-header-{column}` |
| `KPI.tsx` | `kpi-card`, `kpi-value`, `kpi-label` |
| `StatusBadge.tsx` | `status-badge` |
| `AppShell.tsx` | `app-shell`, `app-shell-nav` |
| `TopBar.tsx` | `topbar`, `topbar-plant-selector` |

Rule: `data-testid` values use kebab-case and are stable identifiers — treat them as public API.
Any rename is a breaking change requiring an E2E test update.

#### 3b. Page Object Model library

```
libs/shared-playwright/src/pages/
├── PlantContextBar.po.ts     # Plant selector dropdown (all apps)
├── DataTable.po.ts           # @connectio/shared-ui DataTable
├── KPICard.po.ts             # @connectio/shared-ui KPI
├── FilterBar.po.ts           # GlobalFilterBar (SPC)
├── Drawer.po.ts              # Slide-in detail drawer (W360)
└── PlatformShell.po.ts       # Platform left-rail nav + module switcher
```

`DataTable.po.ts`:

```typescript
// libs/shared-playwright/src/pages/DataTable.po.ts
import type { Locator, Page } from '@playwright/test'

/** Page Object for @connectio/shared-ui DataTable. */
export class DataTablePO {
  readonly root: Locator
  readonly rows: Locator
  readonly headers: Locator

  constructor(page: Page, scope?: Locator) {
    this.root = scope?.locator('[data-testid="data-table"]') ?? page.locator('[data-testid="data-table"]')
    this.rows = this.root.locator('[data-testid="data-table-row"]')
    this.headers = this.root.locator('[data-testid="data-table-header"]')
  }

  /** Returns a row locator filtered by a cell value. */
  rowWithText(text: string): Locator {
    return this.rows.filter({ hasText: text })
  }

  /** Returns the number of visible rows. */
  async rowCount(): Promise<number> {
    return this.rows.count()
  }

  /** Clicks the column header to sort. */
  async sortBy(column: string): Promise<void> {
    await this.root.locator(`[data-testid="data-table-header-${column}"]`).click()
  }
}
```

`PlantContextBar.po.ts`:

```typescript
// libs/shared-playwright/src/pages/PlantContextBar.po.ts
import type { Page } from '@playwright/test'

/** Page Object for the plant selector present in all ConnectIO apps. */
export class PlantContextBarPO {
  constructor(private readonly page: Page) {}

  /** Opens the plant dropdown and selects the given plant ID. */
  async selectPlant(plantId: string): Promise<void> {
    await this.page.locator('[data-testid="topbar-plant-selector"]').click()
    await this.page.locator(`[data-plant-id="${plantId}"]`).click()
    await this.page.waitForResponse((r) => r.url().includes('/api/') && r.status() === 200)
  }

  /** Returns the currently selected plant label. */
  async selectedPlant(): Promise<string> {
    return this.page.locator('[data-testid="topbar-plant-selector"] .selected-label').innerText()
  }
}
```

#### 3c. Warehouse360 journey tests

```
apps/warehouse360/e2e/tests/
├── control-tower.spec.ts   # KPI cards, at-risk orders, navigation
├── inventory.spec.ts       # Stock table, filter, bin detail
├── dispensary.spec.ts      # Dispensary queue, fulfil action
├── inbound.spec.ts         # GR receipts, receipt detail drawer
└── outbound.spec.ts        # Delivery list, delivery detail drawer
```

Key journey — inventory stock lookup:

```typescript
// apps/warehouse360/e2e/tests/inventory.spec.ts
import { test, expect } from '@connectio/shared-playwright'

test.describe('Inventory stock view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?module=inventory')
  })

  test('shows stock table after plant selection', async ({ page, plantBar, dataTable }) => {
    await plantBar.selectPlant('DEMO_PLANT')
    await expect(dataTable.root).toBeVisible()
    await expect(dataTable.rows.first()).toBeVisible({ timeout: 15_000 })
  })

  test('filters by material', async ({ page, plantBar, dataTable }) => {
    await plantBar.selectPlant('DEMO_PLANT')
    await page.locator('[data-testid="material-filter"]').fill('MAT-001')
    await page.keyboard.press('Enter')
    const count = await dataTable.rowCount()
    expect(count).toBeGreaterThan(0)
    for (const row of await dataTable.rowWithText('MAT-001').all()) {
      await expect(row).toBeVisible()
    }
  })

  test('opens bin detail on row click', async ({ page, plantBar, dataTable }) => {
    await plantBar.selectPlant('DEMO_PLANT')
    await dataTable.rows.first().click()
    await expect(page.locator('[data-testid="drawer"]')).toBeVisible()
  })
})
```

#### 3d. SPC journey tests

```
apps/spc/e2e/tests/
├── filter-to-chart.spec.ts  # Material → MIC → date range → control chart renders  @smoke
├── point-exclusion.spec.ts  # Click point → exclusion modal → justified → chart redraws
├── capability.spec.ts       # Cpk / Pp panel values match filter state
└── alarm-state.spec.ts      # Alarm badge counts reflect filter
```

Key journey — SPC filter to chart:

```typescript
// apps/spc/e2e/tests/filter-to-chart.spec.ts
import { test, expect } from '@connectio/shared-playwright'
import { SPCFilterBarPO } from '../pages/SPCFilterBar.po'

test('Filter bar drives control chart render @smoke', async ({ page }) => {
  const filterBar = new SPCFilterBarPO(page)
  await page.goto('/')
  await filterBar.selectPlant('DEMO_PLANT')
  await filterBar.typeMaterial('DMAT-01')
  await filterBar.confirmMaterial()
  await filterBar.selectMIC('MIC-A')
  await filterBar.setDatePreset('90d')
  await filterBar.commit()
  // Control chart SVG must render within 20s (Databricks cold start budget)
  await expect(page.locator('[data-testid="control-chart-svg"]')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('[data-testid="chart-point"]').first()).toBeVisible()
})
```

**Deliverable:** ~25 tests covering the two highest-risk apps. Suite runs locally in ~3 minutes.

**Effort:** ~12 days

---

### Phase 4 — Expansion (Weeks 8–11, ~10 days)

**Goal:** Cover Trace2, Platform shell cross-app navigation, EnvMon, and POH. Introduce API mock
fixtures for offline / PR runs.

#### 4a. API Mock Fixture Strategy

For PR-triggered CI where no live Databricks endpoint exists, use Playwright's route interception
with committed fixture JSON files:

```
libs/shared-playwright/src/fixtures/
├── warehouse360/
│   ├── kpis.json
│   ├── inventory.json
│   └── wh-cockpit.json
├── spc/
│   ├── charts.json
│   └── metadata.json
└── trace2/
    ├── forward-trace.json
    └── reverse-trace.json
```

```typescript
// libs/shared-playwright/src/fixtures/mockApi.ts
import type { Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

const FIXTURES_DIR = path.join(__dirname)

/**
 * Intercepts all /api/* calls and responds with fixture JSON.
 * Use in PR/offline runs when no live backend is available.
 */
export async function mockAllApiRoutes(page: Page, appName: string): Promise<void> {
  await page.route('/api/**', (route) => {
    const apiPath = new URL(route.request().url()).pathname.replace('/api/', '')
    const fixturePath = path.join(FIXTURES_DIR, appName, `${apiPath}.json`)

    if (fs.existsSync(fixturePath)) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: fs.readFileSync(fixturePath, 'utf-8'),
      })
    } else {
      route.fulfill({ status: 404, body: JSON.stringify({ detail: 'fixture not found' }) })
    }
  })
}
```

#### 4b. Trace2 journeys

```
apps/trace2/e2e/tests/
├── forward-trace.spec.ts   # Batch ID input → tree renders → node count  @smoke
├── reverse-trace.spec.ts   # Same for reverse direction
├── mass-balance.spec.ts    # Quantity totals in the balance panel
└── map-view.spec.ts        # Geo map renders plant locations
```

```typescript
// apps/trace2/e2e/tests/forward-trace.spec.ts
import { test, expect } from '@connectio/shared-playwright'

test('Forward trace renders lineage tree @smoke', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-testid="batch-id-input"]').fill('BATCH-E2E-001')
  await page.locator('[data-testid="trace-forward-btn"]').click()
  await expect(page.locator('[data-testid="trace-tree"]')).toBeVisible({ timeout: 25_000 })
  const nodeCount = await page.locator('[data-testid="trace-node"]').count()
  expect(nodeCount).toBeGreaterThanOrEqual(1)
})
```

#### 4c. Platform shell cross-app navigation

```
apps/platform/e2e/tests/
├── module-switching.spec.ts      # Left rail nav switches module content panel  @smoke
├── cross-app-context-bar.spec.ts # Context banner appears on cross-app nav
├── plant-selection.spec.ts       # Plant selector propagates to sub-apps
└── deep-link.spec.ts             # URL params restore correct module + context
```

```typescript
// apps/platform/e2e/tests/module-switching.spec.ts
import { test, expect } from '@connectio/shared-playwright'
import { PlatformShellPO } from '@connectio/shared-playwright'

test('Left-rail nav switches to Warehouse360 module @smoke', async ({ page }) => {
  const shell = new PlatformShellPO(page)
  await page.goto('/cq')
  await shell.navigateTo('warehouse360')
  await expect(page.locator('[data-testid="w360-control-tower"]')).toBeVisible({ timeout: 10_000 })
})

test('Cross-app context bar appears after deep-link from W360', async ({ page }) => {
  await page.goto('/cq?from=warehouse360&entity=processOrder&processOrderId=PO-001')
  await expect(page.locator('.connectio-ctx.plat-ctx-bar')).toBeVisible()
  await expect(page.locator('.connectio-ctx-field .val').first()).toHaveText(/warehouse360/i)
})
```

**Effort:** ~10 days

---

### Phase 5 — CI/CD Integration (Weeks 12–13, ~4 days)

**Goal:** E2E suite runs on every PR (mocked, fast) and on merge-to-main (live, full).
Parallelize across apps using GitHub Actions matrix.

#### 5a. nx.json additions

Add to `targetDefaults`:

```json
"e2e": {
  "cache": false,
  "inputs": ["tsFiles", "^tsFiles", "sharedGlobals"]
},
"e2e-ci": {
  "cache": false,
  "inputs": ["tsFiles", "^tsFiles", "sharedGlobals"]
}
```

#### 5b. PR smoke gate (added to ci.yml)

Insert after the `Test affected` step in the `ci` job:

```yaml
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: E2E smoke tests (mocked API — PR gate)
        env:
          E2E_MOCK_AUTH: '1'
          E2E_USE_FIXTURES: '1'
        run: |
          npx nx affected -t e2e \
            --base=$NX_BASE --head=$NX_HEAD \
            --parallel=2 \
            -- --grep "@smoke"

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: |
            apps/*/e2e/playwright-report/
            apps/*/e2e/test-results/
          retention-days: 14
```

#### 5c. Post-merge live run (new job in ci.yml)

```yaml
  e2e-live:
    needs: [ci, security]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: uat
    strategy:
      matrix:
        app: [warehouse360, spc, trace2, platform]
      fail-fast: false
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - uses: astral-sh/setup-uv@v4
        with:
          enable-cache: true
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - name: Run E2E — ${{ matrix.app }}
        env:
          E2E_DATABRICKS_TOKEN: ${{ secrets.E2E_DATABRICKS_UAT_TOKEN }}
          DATABRICKS_HOST: ${{ secrets.DATABRICKS_HOST }}
        run: |
          npx playwright test \
            --config=apps/${{ matrix.app }}/e2e/playwright.config.ts \
            --reporter=blob
      - name: Upload blob report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: blob-report-${{ matrix.app }}
          path: apps/${{ matrix.app }}/e2e/blob-report/
          retention-days: 30

  e2e-merge-reports:
    needs: [e2e-live]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - uses: actions/download-artifact@v4
        with:
          pattern: blob-report-*
          merge-multiple: true
          path: all-blob-reports
      - run: npx playwright merge-reports --reporter html ./all-blob-reports
      - uses: actions/upload-artifact@v4
        with:
          name: playwright-merged-report
          path: playwright-report/
          retention-days: 30
```

#### 5d. Local developer workflow

```bash
# Run all E2E for one app (mocked)
E2E_MOCK_AUTH=1 E2E_USE_FIXTURES=1 npx nx e2e warehouse360-e2e

# Run only smoke tests across all affected apps
npx nx affected -t e2e -- --grep "@smoke"

# Headed browser for debugging
npx playwright test --config=apps/spc/e2e/playwright.config.ts --headed --debug

# Open last HTML report
npx playwright show-report apps/warehouse360/e2e/playwright-report
```

**Effort:** ~4 days

---

### Phase 6 — Governance & Hardening (Week 14, ~3 days)

**Goal:** Lock in standards, update the Definition of Done, establish flake budget.

See Section 8 (Governance & Success Metrics) for targets and protocols.

---

## 3. Folder Structure (Final State)

```
ConnectIO-RAD/
├── playwright.config.ts                    # Base config — extend, never run directly
├── libs/
│   └── shared-playwright/
│       ├── project.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                    # Re-exports all POs and fixtures
│           ├── pages/
│           │   ├── PlantContextBar.po.ts
│           │   ├── DataTable.po.ts
│           │   ├── KPICard.po.ts
│           │   ├── FilterBar.po.ts
│           │   ├── Drawer.po.ts
│           │   └── PlatformShell.po.ts
│           ├── fixtures/
│           │   ├── base.ts                 # Extended test() with PO fixtures
│           │   ├── mockApi.ts              # page.route() fixture JSON loader
│           │   └── {app}/                  # Per-app fixture JSON files
│           └── utils/
│               ├── auth.ts                 # Token header helpers
│               └── wait.ts                 # waitForDataLoad(), waitForChart()
└── apps/
    ├── warehouse360/e2e/
    │   ├── project.json
    │   ├── playwright.config.ts
    │   ├── pages/                          # App-specific POs (if any)
    │   └── tests/
    │       ├── control-tower.spec.ts
    │       ├── inventory.spec.ts
    │       ├── dispensary.spec.ts
    │       ├── inbound.spec.ts
    │       └── outbound.spec.ts
    ├── spc/e2e/
    │   ├── project.json
    │   ├── playwright.config.ts
    │   ├── pages/
    │   │   └── SPCFilterBar.po.ts
    │   └── tests/
    │       ├── filter-to-chart.spec.ts     # @smoke
    │       ├── point-exclusion.spec.ts
    │       ├── capability.spec.ts
    │       └── alarm-state.spec.ts
    ├── trace2/e2e/
    │   ├── project.json
    │   ├── playwright.config.ts
    │   └── tests/
    │       ├── forward-trace.spec.ts       # @smoke
    │       ├── reverse-trace.spec.ts
    │       ├── mass-balance.spec.ts
    │       └── map-view.spec.ts
    ├── platform/e2e/
    │   ├── project.json
    │   ├── playwright.config.ts
    │   └── tests/
    │       ├── module-switching.spec.ts    # @smoke
    │       ├── cross-app-context-bar.spec.ts
    │       ├── plant-selection.spec.ts
    │       └── deep-link.spec.ts
    ├── envmon/e2e/                         # Phase 4
    └── connectedquality/e2e/               # Phase 4
```

---

## 4. Testing Standards & Best Practices

### 4a. Locator Strategy (priority order)

1. `data-testid` for structural/interactive elements in shared-ui components
2. ARIA role + name for semantic elements (`getByRole('button', { name: 'Apply' })`)
3. Text content for headings and labels (`getByText`, `getByLabel`)
4. **Never:** CSS classes, element selectors, or nth-child positional selectors

### 4b. Test Organisation and Tagging

Tag critical-path tests with `@smoke` — these run on every PR:

```typescript
test('Filter bar drives control chart render @smoke', async ({ page }) => { ... })
```

The `--grep "@smoke"` flag in the PR CI step selects only these. Target: <20 smoke tests per app,
<60 seconds total per app.

### 4c. Data / Fixture Strategy for Dynamic Databricks Data

**For structure tests (PR/offline):** Use `mockApi.ts` with fixture JSON. The fixture captures a
representative real response once and is committed. Tests assert UI structure, not exact values.

**For live integration tests (post-merge only):** Use `expect.soft()` for numeric comparisons and
assert only stable structural properties:

```typescript
// Assert structure, not specific values
const count = await dataTable.rowCount()
expect(count).toBeGreaterThan(0)
// NOT: await expect(kpi).toHaveText('23,975.0 KG')
```

**Seed data for Trace2:** Maintain a small set of "stable" batch IDs in the UAT Databricks
workspace known to produce valid trace output. Document them in
`apps/trace2/e2e/fixtures/seed-batches.ts`.

### 4d. Handling Databricks Cold Starts

Databricks SQL warehouses can take 10–60 seconds to resume. The `waitForBackendWarm` utility
handles this:

```typescript
// libs/shared-playwright/src/utils/wait.ts

/** Waits for any /api/ request to complete, signalling the backend is warm. */
export async function waitForBackendWarm(page: Page, timeout = 90_000): Promise<void> {
  await page.waitForResponse(
    (r) => r.url().includes('/api/') && r.status() < 500,
    { timeout }
  )
}
```

App-level configs set `timeout: 90_000` for live test runs where a cold warehouse start is possible.

---

## 5. Shared Library Design (`libs/shared-playwright`)

### What goes in

| Module | Contents |
|---|---|
| `pages/PlantContextBar.po.ts` | `selectPlant()`, `selectedPlant()` — used by every app |
| `pages/DataTable.po.ts` | `rowCount()`, `rowWithText()`, `sortBy()`, `filterBy()` |
| `pages/KPICard.po.ts` | `getValue()`, `getLabel()`, `getTone()` |
| `pages/Drawer.po.ts` | `isOpen()`, `close()`, `getField()` |
| `pages/PlatformShell.po.ts` | `navigateTo()`, `activeModule()`, `pinModule()` |
| `pages/FilterBar.po.ts` | `setDatePreset()`, `commit()`, `reset()` |
| `fixtures/base.ts` | Extended `test()` with POs in context |
| `fixtures/mockApi.ts` | `mockAllApiRoutes(page, appName)` |
| `utils/wait.ts` | `waitForBackendWarm()`, `waitForChart()` |
| `utils/auth.ts` | `injectToken(page, token)` |

### What stays app-specific

App-specific page objects (e.g., `SPCFilterBarPO` with its material type-ahead, `TraceTreePO`
with its node traversal helpers) live in `apps/<x>/e2e/pages/`. They may extend shared POs but
capture behaviour unique to that app.

### Package export

```typescript
// libs/shared-playwright/src/index.ts
export { test, expect } from './fixtures/base'
export { PlantContextBarPO } from './pages/PlantContextBar.po'
export { DataTablePO } from './pages/DataTable.po'
export { KPICardPO } from './pages/KPICard.po'
export { DrawerPO } from './pages/Drawer.po'
export { PlatformShellPO } from './pages/PlatformShell.po'
export { FilterBarPO } from './pages/FilterBar.po'
export { mockAllApiRoutes } from './fixtures/mockApi'
export { waitForBackendWarm, waitForChart } from './utils/wait'
```

Add the path alias to `tsconfig.base.json`:

```json
"@connectio/shared-playwright": ["libs/shared-playwright/src/index.ts"]
```

---

## 6. Priority Test Coverage

### Tier 1 — `@smoke` (runs on every PR, mocked)

| App | Journey | Why |
|---|---|---|
| Platform | Module switching (W360 → CQ → POH) | Shell change breaks all sub-apps |
| SPC | Material filter → control chart renders | Most-used workflow; shared-ui chart integration |
| Warehouse360 | Plant select → Control Tower KPI cards load | PlantProvider + shared-ui DataTable integration |
| Trace2 | Batch ID input → forward trace tree renders | Most complex data flow in the system |

### Tier 2 — Full journeys (post-merge live runs only)

| App | Journey |
|---|---|
| Warehouse360 | Inventory stock table filter + bin drawer |
| Warehouse360 | Dispensary fulfilment action |
| Warehouse360 | Inbound receipt + outbound delivery drawers |
| SPC | Point exclusion modal → chart redraw |
| SPC | Capability panel Cpk/Pp values |
| Trace2 | Reverse trace + mass balance panel |
| Platform | Cross-app context bar (W360 batch → CQ) |
| Platform | Deep-link URL restore (`?module=spc&plant=X`) |
| EnvMon | MIC heatmap renders for plant |
| POH | OEE waterfall chart for date range |

---

## 7. CI/CD Integration Summary

| Run trigger | Scope | Browsers | Backend | Duration target |
|---|---|---|---|---|
| Every PR | `@smoke` on affected apps | Chromium | Mocked (`E2E_MOCK_AUTH=1`) | < 5 min |
| Merge to main | All tests, all apps | Chromium | Live UAT Databricks | < 15 min |
| Manual dispatch | Configurable | All 3 | Live UAT or prod | varies |

Nx caching is disabled for all `e2e` targets (`"cache": false`) — E2E results are never stale-
cached because the app state (Databricks data) changes between runs.

---

## 8. DDD Guardrails Update

E2E tests legitimately import across app and library boundaries. Update
`scripts/tests/test_ddd_architecture_guardrails.py` to exclude `e2e/` directories from the AST
walk:

```python
EXCLUDED_DIRS = {"e2e", "node_modules", "__pycache__", ".venv"}
```

---

## 9. Governance & Success Metrics

### Definition of Done update (add to CLAUDE.md)

> **5. E2E Regression Gate:** Any PR that modifies a shared library (`libs/shared-*`) or a
> critical user journey (filter bar, trace tree, plant selector) must include or verify at least
> one passing `@smoke` E2E test covering the affected surface.

### Targets

| Metric | Target | Measured |
|---|---|---|
| Flake rate | < 2% per test per week | Blob report fail-without-code-change count |
| Smoke suite wall time (PR) | < 90 seconds per app | GitHub Actions step timing |
| Full live suite wall time | < 15 minutes total | Parallel matrix job |
| Smoke coverage | 4 critical paths by end Phase 3 | Count of `@smoke` tests |
| Full journey coverage | 18 journeys by end Phase 4 | Test registry count |
| Retry budget | ≤ 2 retries in CI | `retries: 2` in base config |

### Flake Hunting Protocol

Any test that flakes 3× in a 2-week window is quarantined: tagged `@flaky`, excluded from the
smoke run, and tracked in a GitHub issue. It must be fixed or deleted before the next sprint ends.
No flaky test accumulation.

### Browser Matrix (progressive)

| Phase | Browsers |
|---|---|
| 1–3 | Chromium only |
| 4 | Add Firefox (manufacturing ops teams use Firefox on-site) |
| 5+ | Add Mobile Chrome (tablet use in dispensary) |

---

## 10. Immediate First Steps

```bash
# 1. Install the Nx Playwright plugin
npm install --save-dev @nx/playwright @playwright/test

# 2. Install Chromium binary
npx playwright install chromium

# 3. Create the shared-playwright library skeleton
mkdir -p libs/shared-playwright/src/{fixtures,pages,utils}

# 4. Add data-testid to shared-ui DataTable and KPI (the two most-used)
# Edit libs/shared-ui/src/components/DataTable.tsx
# Edit libs/shared-ui/src/components/KPI.tsx

# 5. Scaffold warehouse360-e2e project
mkdir -p apps/warehouse360/e2e/tests
# Create project.json and playwright.config.ts per Phase 1 above

# 6. Write and run the first test
E2E_MOCK_AUTH=1 npx playwright test \
  --config=apps/warehouse360/e2e/playwright.config.ts \
  apps/warehouse360/e2e/tests/control-tower.spec.ts
```
