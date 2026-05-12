import type { Meta, StoryObj } from '@storybook/react'
import { ParetoChartWidget } from './ParetoChartWidget'
import { makeParetoConfig } from '../helpers'

const meta: Meta<typeof ParetoChartWidget> = {
  title: 'shared-reporting/ParetoChartWidget',
  component: ParetoChartWidget,
}
export default meta

type Story = StoryObj<typeof ParetoChartWidget>

export const Default: Story = {
  args: {
    config: makeParetoConfig('downtime-causes', 'Downtime Causes (Pareto)'),
    props: {
      items: [
        { label: 'Changeover', value: 124 },
        { label: 'Mechanical fault', value: 87 },
        { label: 'Material shortage', value: 56 },
        { label: 'Quality hold', value: 43 },
        { label: 'Planned maintenance', value: 31 },
        { label: 'Other', value: 18 },
      ],
      valueLabel: 'Minutes',
    },
  },
}

export const FewItems: Story = {
  args: {
    config: makeParetoConfig('reject-pareto', 'Rejection Causes'),
    props: {
      items: [
        { label: 'Contamination', value: 42 },
        { label: 'Overweight', value: 28 },
        { label: 'Underweight', value: 17 },
      ],
      valueLabel: 'Rejects',
      cumulativeLabel: 'Cumul. %',
    },
  },
}

export const Empty: Story = {
  args: {
    config: makeParetoConfig('empty', 'No Data'),
    props: { items: [] },
  },
}
