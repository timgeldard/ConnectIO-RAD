/** Reads a CSS custom property from the document root; returns fallback in SSR or when unset. */
function resolveCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

/**
 * Builds the ECharts theme object at registration time so palette colours are
 * sourced from Kerry CSS tokens rather than hard-coded hex values.
 *
 * Only token properties whose values are literal hex strings in kerry-tokens.css
 * (e.g. --valentia-slate) are resolved via getComputedStyle; derived tokens that
 * use color-mix() are not ECharts-parseable and retain hex fallbacks.
 */
export function buildReportingEChartsTheme(): Record<string, unknown> {
  return {
    color: [
      resolveCssVar('--valentia-slate', '#005776'),
      resolveCssVar('--jade',           '#44CF93'),
      resolveCssVar('--sage',           '#289BA2'),
      resolveCssVar('--sunrise',        '#F9C20A'),
      resolveCssVar('--sunset',         '#F24A00'),
      resolveCssVar('--innovation',     '#DFFF11'),
      resolveCssVar('--forest',         '#143700'),
      '#9CA3AF', // neutral grey — no Kerry brand token maps to this shade
    ],
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: resolveCssVar('--font-mono', "'IBM Plex Mono', 'Noto Sans', ui-sans-serif, system-ui"),
      fontSize: 11,
      color: '#4B6040', // --text-3 equivalent; color-mix() is not ECharts-parseable
    },
    line:        { itemStyle: { borderWidth: 2 } },
    scatter:     { itemStyle: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' } },
    axisPointer: { lineStyle: { color: 'rgba(0,87,118,0.15)' } }, // --chart-band equivalent
  }
}

export const REPORTING_CHART_GRID = { top: 16, right: 120, bottom: 32, left: 64 }
