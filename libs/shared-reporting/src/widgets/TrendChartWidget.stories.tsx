import type { Meta, StoryObj } from '@storybook/react'
import { TrendChartWidget } from './TrendChartWidget'
import { makeTrendConfig } from '../helpers'

const meta: Meta<typeof TrendChartWidget> = {
  title: 'shared-reporting/TrendChartWidget',
  component: TrendChartWidget,
}
export default meta

type Story = StoryObj<typeof TrendChartWidget>

const weekPoints = [
  { label: 'Mon', value: 88.2 },
  { label: 'Tue', value: 91.0 },
  { label: 'Wed', value: 89.5 },
  { label: 'Thu', value: 93.1 },
  { label: 'Fri', value: 90.8 },
  { label: 'Sat', value: 87.4 },
  { label: 'Sun', value: 92.3 },
]

export const Default: Story = {
  args: {
    config: makeTrendConfig('oee-trend', 'OEE Trend'),
    props: { points: weekPoints, valueLabel: 'OEE %', description: 'Last 7 days' },
  },
}

export const LongSeries: Story = {
  args: {
    config: makeTrendConfig('yield-30d', 'Yield — 30 Day Trend'),
    props: {
      points: Array.from({ length: 30 }, (_, i) => ({
        label: `Day ${i + 1}`,
        value: 90 + Math.sin(i / 3) * 4 + (Math.random() * 2 - 1),
      })),
      valueLabel: 'Yield %',
    },
  },
}

export const Empty: Story = {
  args: {
    config: makeTrendConfig('empty', 'No Data'),
    props: { points: [] },
  },
}
