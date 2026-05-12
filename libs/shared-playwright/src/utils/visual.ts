/* eslint-disable jsdoc/require-jsdoc */
import { expect, type Page, type Locator } from '@playwright/test'

/**
 * Capture and compare a screenshot of a specific component or the entire page.
 * Baseline screenshots are stored in the app's e2e/__screenshots__ directory.
 * 
 * @param element - The page or a locator to screenshot.
 * @param name - Unique name for the screenshot (e.g. 'kpi-card-ok-state').
 */
export async function assertVisualMatch(element: Page | Locator, name: string): Promise<void> {
  // We use standard toHaveScreenshot but wrap it to enforce naming conventions
  // and potentially apply standard masks (e.g. timestamps).
  await expect(element).toHaveScreenshot(`${name}.png`, {
    mask: [
      // Standard elements to mask to reduce noise (e.g. clock/timestamp elements)
      // element.page().locator('[data-testid="last-updated-ts"]')
    ],
    threshold: 0.1, // 10% diff tolerance for anti-aliasing
    animations: 'disabled',
  })
}
