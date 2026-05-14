import type { Meta, StoryObj } from '@storybook/react'
import { TopBar } from './TopBar'
import { Button } from './Button'

const meta: Meta<typeof TopBar> = {
  title: 'shared-ui/TopBar',
  component: TopBar,
}
export default meta

type Story = StoryObj<typeof TopBar>

export const Minimal: Story = {
  args: {
    breadcrumbs: [{ label: 'Home' }],
  },
}

export const WithSearch: Story = {
  args: {
    breadcrumbs: [{ label: 'EnvMon' }, { label: 'Charleville' }],
    search: { value: '', onChange: () => {}, placeholder: 'Search locations…' },
  },
}

export const WithActions: Story = {
  args: {
    breadcrumbs: [{ label: 'SPC' }, { label: 'VISC-321' }],
    actions: <Button variant="primary" size="sm">Export</Button>,
  },
}

export const DeepBreadcrumbs: Story = {
  args: {
    breadcrumbs: [
      { label: 'Home', icon: 'home' },
      { label: 'ConnectedQuality' },
      { label: 'Trace' },
      { label: 'Batch 1234' },
    ],
  },
}
