import type { Meta, StoryObj } from '@storybook/react'
import { Card } from './Card'

const meta: Meta<typeof Card> = {
  title: 'shared-ui/Card',
  component: Card,
  args: { children: 'Card body content' },
}
export default meta

type Story = StoryObj<typeof Card>

export const Default: Story = {}
export const WithTitle: Story = { args: { title: 'Material Summary' } }
export const WithTitleAndMeta: Story = { args: { title: 'Batch Overview', meta: 'Updated 5m ago' } }
export const WithAction: Story = { args: { title: 'Control Chart', action: <button>View all</button> } }
export const Dark: Story = { args: { variant: 'dark', title: 'Dark Variant' } }
export const NoPadding: Story = { args: { title: 'No Padding', noPad: true } }
export const WithNumericValue: Story = { args: { title: 'Batch Count', num: '1,240', meta: 'active batches' } }
