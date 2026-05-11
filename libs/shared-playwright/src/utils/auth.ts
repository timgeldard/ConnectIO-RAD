/* eslint-disable jsdoc/require-jsdoc */
import type { BrowserContext } from '@playwright/test'

/**
 * Injects the Databricks access token into all requests made by the given
 * browser context. In dev/test mode the backend accepts any non-empty value;
 * in UAT/prod CI the E2E_DATABRICKS_TOKEN env var must hold a valid PAT.
 */
export async function injectToken(context: BrowserContext, token?: string): Promise<void> {
  const resolved = token ?? process.env.E2E_DATABRICKS_TOKEN ?? 'e2e-dev-token'
  await context.setExtraHTTPHeaders({ 'x-forwarded-access-token': resolved })
}
