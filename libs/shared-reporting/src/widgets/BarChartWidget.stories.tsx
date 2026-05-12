import type { Meta, StoryObj } from '@storybook/react'
import { BarChartWidget } from './BarChartWidget'
import { makeBarConfig } from '../helpers'

const meta: Meta<typeof BarChartWidget> = {
  title: 'shared-reporting/BarChartWidget',
  component: BarChartWidget,
}
export default meta

type Story = StoryObj<typeof BarChartWidget>

export const Default: Story = {
  args: {
    config: makeBarConfig('downtime-by-line', 'Downtime by Line'),
    props: {
      categories: ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'],
      series: [{ name: 'Downtime (h)', data: [2.4, 0.8, 3.1, 1.5, 0.4] }],
      valueLabel: 'Hours',
    },
  },
}

export const Grouped: Story = {
  args: {
    config: makeBarConfig('oee-comparison', 'OEE by Line — Shift Comparison'),
    props: {
      categories: ['Line 1', 'Line 2', 'Line 3', 'Line 4'],
      series: [
        { name: 'Shift A', data: [88, 91, 85, 93] },
        { name: 'Shift B', data: [84, 87, 90, 89] },
        { name: 'Shift C', data: [92, 88, 86, 91] },
      ],
      valueLabel: 'OEE %',
    },
  },
}

export const Horizontal: Story = {
  args: {
    config: makeBarConfig('reject-reasons', 'Reject Reasons'),
    props: {
      categories: ['Contamination', 'Overweight', 'Underweight', 'Labelling', 'Foreign body'],
      series: [{ name: 'Count', data: [42, 28, 17, 11, 5] }],
      horizontal: true,
    },
  },
}

export const Empty: Story = {
  args: {
    config: makeBarConfig('empty', 'No Data'),
    props: { categories: [], series: [] },
  },
}
