import type { Meta, StoryObj } from '@storybook/react'
import { GlobalFilterBar } from './GlobalFilterBar'
import { Button } from './Button'
import { Select } from './Select'

const meta: Meta<typeof GlobalFilterBar> = {
  title: 'shared-ui/GlobalFilterBar',
  component: GlobalFilterBar,
}
export default meta

type Story = StoryObj<typeof GlobalFilterBar>

export const WithButtons: Story = {
  args: {
    children: (
      <>
        <Button variant="ghost" active>30D</Button>
        <Button variant="ghost">90D</Button>
        <Button variant="ghost">365D</Button>
      </>
    ),
  },
}

export const WithSelect: Story = {
  args: {
    children: (
      <Select
        value="all"
        onChange={() => {}}
        options={[
          { value: 'all', label: 'All plants' },
          { value: 'charleville', label: 'Charleville' },
          { value: 'listowel', label: 'Listowel' },
        ]}
      />
    ),
  },
}
