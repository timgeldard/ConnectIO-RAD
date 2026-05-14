import type { Meta, StoryObj } from '@storybook/react'
import { PageHead } from './PageHead'
import { Button } from './Button'

const meta: Meta<typeof PageHead> = {
  title: 'shared-ui/PageHead',
  component: PageHead,
  args: { title: 'Batch Traceability' },
}
export default meta

type Story = StoryObj<typeof PageHead>

export const TitleOnly: Story = {}
export const WithEyebrow: Story = { args: { eyebrow: 'ConnectedQuality / Trace' } }
export const WithDescription: Story = {
  args: {
    eyebrow: 'Environmental Monitoring',
    title: 'Charleville Floor 1',
    desc: 'Showing 90-day microbiological inspection results with exponential decay scoring.',
  },
}
export const WithActions: Story = {
  args: {
    eyebrow: 'SPC',
    title: 'VISC-321 Control Chart',
    actions: (
      <>
        <Button variant="ghost" size="sm">Baselines</Button>
        <Button variant="primary" size="sm">Export</Button>
      </>
    ),
  },
}
