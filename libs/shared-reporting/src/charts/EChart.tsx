import type { ComponentProps } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { echarts } from './echartsCore'

type BaseProps = ComponentProps<typeof ReactEChartsCore>

/** Props for the shared EChart wrapper. Extends all ReactEChartsCore props. */
export interface EChartProps extends BaseProps {
  /** Accessible label applied to the wrapping `role="img"` div. */
  ariaLabel?: string
  /** `data-testid` for the wrapping div; set per-instance to keep test IDs unique. */
  testId?: string
}

export function EChart({ ariaLabel, testId, theme = 'connectio-reporting', ...props }: EChartProps) {
  return (
    <div data-testid={testId} role="img" aria-label={ariaLabel}>
      <ReactEChartsCore echarts={echarts} theme={theme} {...props} />
    </div>
  )
}
