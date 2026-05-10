import type { ComponentProps } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { echarts } from './echartsCore'

type BaseProps = ComponentProps<typeof ReactEChartsCore>

export interface EChartProps extends BaseProps {
  ariaLabel?: string
  testId?: string
}

export function EChart({ ariaLabel, testId, theme = 'connectio-reporting', ...props }: EChartProps) {
  return (
    <div data-testid={testId} role="img" aria-label={ariaLabel}>
      <ReactEChartsCore echarts={echarts} theme={theme} {...props} />
    </div>
  )
}
