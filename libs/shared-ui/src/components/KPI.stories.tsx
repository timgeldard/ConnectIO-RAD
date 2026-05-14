import type { Meta, StoryObj } from '@storybook/react'
import { KPI } from './KPI'

const meta: Meta<typeof KPI> = {
  title: 'shared-ui/KPI',
  component: KPI,
  args: { label: 'OEE', value: '87.4', unit: '%' },
}
export default meta

type Story = StoryObj<typeof KPI>

export const Neutral: Story = { args: { tone: 'neutral' } }
export const Ok: Story = { args: { tone: 'ok', delta: '+2.1%', trend: 'up', subtext: 'vs prior 7 days' } }
export const Warn: Story = { args: { label: 'Yield', value: '93.1', tone: 'warn', delta: '-1.3%', trend: 'down' } }
export const Risk: Story = { args: { label: 'Unplanned Downtime', value: '4.2', unit: 'h', tone: 'risk', delta: '+18%', trend: 'up' } }
export const WithSparkline: Story = {
  args: {
    tone: 'ok',
    sparkline: [80, 83, 85, 84, 87, 88, 87],
  },
}
export const WithProgressBar: Story = { args: { label: 'Capacity Used', value: '72', tone: 'ok', progressBar: 72 } }
export const WithIcon: Story = { args: { icon: 'activity', tone: 'ok' } }
