// Kerry Design System multi-series palette
// Source: Kerry Brand Guidelines 2024 FINAL (v1, July 2024)
export const SPC_ECHARTS_THEME = {
  color: [
    '#005776', // Valentia Slate — primary series
    '#44CF93', // Jade
    '#289BA2', // Sage
    '#F9C20A', // Sunrise
    '#F24A00', // Sunset
    '#DFFF11', // Innovation
    '#143700', // Forest
    '#9CA3AF', // muted fallback
  ],
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily: "'IBM Plex Mono', 'Noto Sans', ui-sans-serif, system-ui",
    fontSize: 11,
    color: '#4B6040', // Forest 55% — matches --text-3
  },
  line: { itemStyle: { borderWidth: 2 } },
  scatter: { itemStyle: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' } },
  axisPointer: { lineStyle: { color: 'rgba(0,87,118,0.15)' } },
}

/** Shared grid padding — use in every chart's option object */
export const CHART_GRID = { top: 16, right: 120, bottom: 32, left: 64 }
