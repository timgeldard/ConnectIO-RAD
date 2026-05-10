import type { ComponentProps } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { echarts } from './echartsCore'

type BaseProps = ComponentProps<typeof ReactEChartsCore>

export interface EChartProps extends BaseProps {
  ariaLabel?: string
}

export function EChart({ ariaLabel, theme = 'connectio-reporting', ...props }: EChartProps) {
  return (
    <div data-testid="control-chart-svg" role="img" aria-label={ariaLabel}>
      <ReactEChartsCore echarts={echarts} theme={theme} {...props} />
    </div>
  )
}
