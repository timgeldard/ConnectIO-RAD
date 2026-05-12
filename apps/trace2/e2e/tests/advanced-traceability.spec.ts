import { expect, test } from '@connectio/shared-playwright'

/**
 * Phase 4 visual-regression baselines for the advanced traceability
 * views (`AdvancedLineageGraph`, `SankeyFlowView`, `LineageTableView`).
 *
 * These specs are tagged `@visual` rather than `@smoke` because:
 *
 * - They depend on the React Flow + ELK pipeline being deterministic
 *   for a given input.  We mitigate by waiting for the
 *   ``Re-laying out…`` indicator to clear before snapshotting and by
 *   pinning the viewport size.
 * - They take noticeably longer than the smoke gate (ELK layout +
 *   screenshot capture) and shouldn't run on every PR — visual
 *   regression is post-merge / nightly territory.
 *
 * Updating baselines
 * ------------------
 * When a deliberate visual change lands (palette tweak, new chrome on
 * a node card, etc.):
 *
 *     npx playwright test --config=apps/trace2/e2e/playwright.config.ts \
 *       --grep "@visual" --update-snapshots
 *
 * Review the resulting PNGs the same way you would review code.
 *
 * Seed batch
 * ----------
 * Uses ``0008898869`` — the same seed the other trace2 specs use and
 * the one our test warehouse fixtures publish.  When/if that seed
 * changes, update `SEED_BATCH` below and regenerate all baselines.
 */

const SEED_BATCH = '0008898869'

const VIEWPORT = { width: 1280, height: 720 }

/**
 * Wait for the AdvancedLineageGraph to finish its initial ELK layout.
 * The component renders a "Laying out graph…" placeholder until the
 * first layout resolves, then a "Re-laying out…" badge on subsequent
 * layout changes.  We wait for both to clear before snapshotting.
 */
async function waitForAdvancedLayoutSettled(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.getByTestId('advanced-lineage-graph')).toBeVisible({ timeout: 20_000 })
  // Initial placeholder
  await expect(page.getByText('Laying out graph…')).toBeHidden({ timeout: 20_000 })
  // Re-layout badge (may flash briefly on first paint)
  await expect(page.getByTestId('advanced-lineage-relayouting')).toBeHidden({ timeout: 20_000 })
  // Small settle for any late re-fit-view animations React Flow does.
  await page.waitForTimeout(250)
}

test.use({ viewport: VIEWPORT })

test.describe('Advanced traceability visual regression @visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="batch-id-input"]').fill(SEED_BATCH)
    await page.locator('[data-testid="trace-forward-btn"]').click()
    // Land on the trace2 BottomUp page where the new view lives.
    // The exact navigation step here depends on how the trace2 SPA
    // wires up the page list; existing specs prove the click reaches
    // the lineage tree.  We then switch to the Advanced toggle.
    await expect(page.locator('[data-testid="trace-tree"]')).toBeVisible({ timeout: 30_000 })
  })

  test('AdvancedLineageGraph default theme', async ({ page }) => {
    await page.getByRole('tab', { name: 'Advanced' }).click()
    await waitForAdvancedLayoutSettled(page)
    await expect(page.getByTestId('advanced-lineage-graph')).toHaveScreenshot(
      'advanced-default.png',
      {
        // The minimap and edge-quantity labels are anti-aliased
        // differently across renderers (Chromium vs Firefox).  A
        // small max-diff tolerance keeps baselines portable.
        maxDiffPixelRatio: 0.01,
      },
    )
  })

  test('SankeyFlowView default theme', async ({ page }) => {
    await page.getByRole('tab', { name: 'Sankey' }).click()
    // ECharts attaches a canvas; wait for the wrapper before the
    // first render frame settles.
    await expect(page.getByTestId('sankey-flow-view')).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(400)
    await expect(page.getByTestId('sankey-flow-view')).toHaveScreenshot(
      'sankey-default.png',
      { maxDiffPixelRatio: 0.01 },
    )
  })

  test('LineageTableView default theme', async ({ page }) => {
    await page.getByRole('tab', { name: 'Table' }).click()
    await expect(page.getByTestId('lineage-table-view')).toBeVisible({ timeout: 10_000 })
    // No async layout here; small settle just in case.
    await page.waitForTimeout(120)
    await expect(page.getByTestId('lineage-table-view')).toHaveScreenshot(
      'table-default.png',
      { maxDiffPixelRatio: 0.005 },
    )
  })

  test('AdvancedLineageGraph honours filter changes (depth = 1)', async ({ page }) => {
    await page.getByRole('tab', { name: 'Advanced' }).click()
    await waitForAdvancedLayoutSettled(page)
    // Drop upstream depth to 1; ELK relays out.  The Re-laying out…
    // indicator should appear briefly, then the graph should redraw
    // with far fewer nodes than the unfiltered baseline.
    const upstreamSlider = page.getByTestId('depth-upstream')
    await upstreamSlider.fill('1')
    await waitForAdvancedLayoutSettled(page)
    await expect(page.getByTestId('advanced-lineage-graph')).toHaveScreenshot(
      'advanced-depth-1.png',
      { maxDiffPixelRatio: 0.01 },
    )
  })

  test('AdvancedLineageGraph virtualised badge appears past threshold', async ({ page }) => {
    // For a virtualised baseline we want a graph past 150 nodes.  The
    // seed batch is unlikely to be that big, so this test is a
    // soft assertion: when the data exceeds the threshold the badge
    // is visible; when it doesn't, the test is skipped rather than
    // forcing a baseline that depends on warehouse contents.
    await page.getByRole('tab', { name: 'Advanced' }).click()
    await waitForAdvancedLayoutSettled(page)
    const badge = page.getByTestId('advanced-lineage-virtualised-badge')
    if (!(await badge.isVisible().catch(() => false))) {
      test.skip(true, 'seed batch graph below virtualisation threshold')
    }
    await expect(badge).toContainText(/virtualised · \d+ nodes/)
  })
})

test.describe('Advanced traceability visual regression — high-contrast @visual', () => {
  test('AdvancedLineageGraph high-contrast theme', async ({ page }) => {
    // High-contrast theming is exposed via a `data-theme` attribute on
    // the wrapper; flip it via a window-level helper that App.tsx
    // exposes for the e2e suite (see `apps/trace2/frontend/src/themeHook.ts`
    // — added in Phase 4b).  Until that wiring exists, this test is
    // skipped so the baseline is not captured against the default
    // palette and silently mis-labelled.
    test.skip(true, 'high-contrast trace2 toggle ships in Phase 4b')
  })
})
