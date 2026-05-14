import type { Meta, StoryObj } from '@storybook/react'
import { Form } from './Form'
import { Field } from './Field'
import { Button } from './Button'
import { Select } from './Select'

const meta: Meta<typeof Form> = {
  title: 'shared-ui/Form',
  component: Form,
}
export default meta

type Story = StoryObj<typeof Form>

export const Basic: Story = {
  args: {
    children: (
      <>
        <Field label="Material ID" htmlFor="mat" required>
          <input id="mat" type="text" placeholder="e.g. MAT-1234" style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid var(--line-1, #ddd)', width: '100%' }} />
        </Field>
        <Field label="Batch ID" htmlFor="bat">
          <input id="bat" type="text" placeholder="e.g. BATCH-5678" style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid var(--line-1, #ddd)', width: '100%' }} />
        </Field>
        <Button variant="primary" type="submit">Search</Button>
      </>
    ),
  },
}

export const Compact: Story = {
  args: {
    compact: true,
    children: (
      <>
        <Field label="Plant" htmlFor="plant" required>
          <Select
            value=""
            onChange={() => {}}
            options={[{ value: '', label: '— select —' }, { value: 'charleville', label: 'Charleville' }]}
          />
        </Field>
        <Field label="Floor" htmlFor="floor">
          <input id="floor" type="text" style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--line-1, #ddd)', width: '100%' }} />
        </Field>
      </>
    ),
  },
}
