import type { Meta, StoryObj } from '@storybook/react'
import { StatusPill } from './StatusPill'

const meta: Meta<typeof StatusPill> = {
  title: 'shared-ui/StatusPill',
  component: StatusPill,
  args: { status: 'ok' },
}
export default meta

type Story = StoryObj<typeof StatusPill>

export const Ok: Story = { args: { status: 'ok' } }
export const Warning: Story = { args: { status: 'warn' } }
export const Risk: Story = { args: { status: 'risk' } }
export const Info: Story = { args: { status: 'info' } }
export const Neutral: Story = { args: { status: 'neutral' } }
export const Pass: Story = { args: { status: 'pass' } }
export const Fail: Story = { args: { status: 'fail' } }
export const Compact: Story = { args: { status: 'ok', compact: true } }
export const WithCustomLabel: Story = { args: { status: 'ok', label: 'Released' } }
export const OutOfControl: Story = { args: { status: 'out-of-control' } }
