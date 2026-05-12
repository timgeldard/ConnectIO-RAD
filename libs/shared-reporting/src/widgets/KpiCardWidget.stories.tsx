import type { Meta, StoryObj } from '@storybook/react'
import { KpiCardWidget } from './KpiCardWidget'
import { makeKpiConfig } from '../helpers'

const meta: Meta<typeof KpiCardWidget> = {
  title: 'shared-reporting/KpiCardWidget',
  component: KpiCardWidget,
  args: {
    config: makeKpiConfig('demo', 'OEE'),
    props: {},
  },
}
export default meta

type Story = StoryObj<typeof KpiCardWidget>

export const Default: Story = {
  args: {
    config: makeKpiConfig('oee', 'OEE'),
    props: { value: '87.4', unit: '%', tone: 'ok', delta: '+2.1%', trend: 'up', subtext: 'vs prior 7 days' },
  },
}

export const AtRisk: Story = {
  args: {
    config: makeKpiConfig('downtime', 'Unplanned Downtime'),
    props: { value: '4.2', unit: 'h', tone: 'risk', delta: '+18%', trend: 'up', subtext: 'rolling 30D' },
  },
}

export const Warning: Story = {
  args: {
    config: makeKpiConfig('yield', 'Yield'),
    props: { value: '93.1', unit: '%', tone: 'warn', delta: '-1.3%', trend: 'down' },
  },
}

export const WithSparkline: Story = {
  args: {
    config: makeKpiConfig('throughput', 'Throughput'),
    props: {
      value: '1,240',
      unit: 'kg/h',
      tone: 'ok',
      sparkline: [980, 1050, 1100, 1200, 1180, 1240, 1240],
    },
  },
}

export const WithProgress: Story = {
  args: {
    config: makeKpiConfig('capacity', 'Capacity Used'),
    props: { value: '72', unit: '%', tone: 'ok', progressBar: 72 },
  },
}

export const Loading: Story = {
  args: {
    config: makeKpiConfig('orders', 'Open Orders'),
    props: { value: '…', tone: 'neutral' },
  },
}
