import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'
import { Icon } from './Icon'

const meta: Meta<typeof Button> = {
  title: 'shared-ui/Button',
  component: Button,
  args: { children: 'Click me' },
}
export default meta

type Story = StoryObj<typeof Button>

export const Primary: Story = { args: { variant: 'primary' } }
export const Ghost: Story = { args: { variant: 'ghost' } }
export const Danger: Story = { args: { variant: 'danger' } }
export const Secondary: Story = { args: { variant: 'secondary' } }
export const Small: Story = { args: { size: 'sm', variant: 'primary' } }
export const Large: Story = { args: { size: 'lg', variant: 'primary' } }
export const WithIcon: Story = { args: { variant: 'primary', icon: <Icon name="plus" size={16} /> } }
export const Loading: Story = { args: { variant: 'primary', loading: true } }
export const Disabled: Story = { args: { variant: 'primary', disabled: true } }
export const Active: Story = { args: { variant: 'ghost', active: true } }
