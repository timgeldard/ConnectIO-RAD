import type { Meta, StoryObj } from '@storybook/react'
import { ChartContainer } from './ChartContainer'

const PlaceholderChart = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, background: 'var(--surface-sunken, #f5f5f5)', borderRadius: 4, color: 'var(--text-3, #888)' }}>
    Chart placeholder
  </div>
)

const meta: Meta<typeof ChartContainer> = {
  title: 'shared-ui/ChartContainer',
  component: ChartContainer,
  args: { children: <PlaceholderChart /> },
}
export default meta

type Story = StoryObj<typeof ChartContainer>

export const NoHeader: Story = {}
export const WithTitle: Story = { args: { title: 'VISC-321 Control Chart' } }
export const WithTitleAndDescription: Story = {
  args: {
    title: 'VISC-321 Control Chart',
    description: 'Rolling 30-day window. UCL/LCL computed from historical baselines.',
  },
}
export const TallContainer: Story = { args: { title: 'Mass Balance', height: 420 } }
