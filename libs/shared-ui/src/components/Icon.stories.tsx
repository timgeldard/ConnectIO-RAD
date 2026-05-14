import type { Meta, StoryObj } from '@storybook/react'
import { Icon } from './Icon'

const meta: Meta<typeof Icon> = {
  title: 'shared-ui/Icon',
  component: Icon,
  args: { name: 'check', size: 24 },
}
export default meta

type Story = StoryObj<typeof Icon>

export const Default: Story = {}
export const Small: Story = { args: { size: 16 } }
export const Large: Story = { args: { size: 40 } }
export const Colored: Story = { args: { color: 'var(--status-ok, #28a745)' } }
export const AlertTriangle: Story = { args: { name: 'alert-triangle', color: 'var(--status-warn, #ffc107)' } }
export const Activity: Story = { args: { name: 'activity' } }
export const Factory: Story = { args: { name: 'factory' } }
export const Package: Story = { args: { name: 'package' } }
