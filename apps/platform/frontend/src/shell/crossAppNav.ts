import type { ConnectIOModule, CrossAppContext } from '@connectio/shared-ui/shell'
import { moduleHref } from './LandingCard'

/**
 * Builds a platform shell URL that navigates to a target module and preserves
 * the cross-app context (entity, processOrderId, from) so the context bar renders.
 *
 * The resulting URL is on the platform portal itself (?module=<target>), not
 * on the integrated SPA. Use this when initiating drill-downs from within the
 * platform — e.g. "Open this process order in POH".
 */
export function buildCrossAppUrl(
  targetModule: ConnectIOModule,
  ctx: CrossAppContext,
  fromModuleId: string,
): string {
  const params = new URLSearchParams()
  params.set('module', targetModule.moduleId)
  if (targetModule.defaultTab) params.set('tab', targetModule.defaultTab)
  params.set('entity', ctx.entity)
  params.set('from', fromModuleId)
  if (ctx.processOrderId) params.set('processOrderId', ctx.processOrderId)
  return `?${params.toString()}`
}

/**
 * Builds the direct SPA URL for a target module with cross-app context params
 * threaded through. Used when the "Open in [SPA]" CTA should carry context
 * directly into the target application.
 */
export function buildSpaContextUrl(
  targetModule: ConnectIOModule,
  ctx: CrossAppContext,
  activeTabId?: string,
): string {
  const base = moduleHref(targetModule, activeTabId)
  const params = new URLSearchParams()
  params.set('entity', ctx.entity)
  if (ctx.from) params.set('from', ctx.from)
  if (ctx.processOrderId) params.set('processOrderId', ctx.processOrderId)
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}${params.toString()}`
}
