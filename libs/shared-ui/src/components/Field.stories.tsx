import type { Meta, StoryObj } from '@storybook/react'
import { Field } from './Field'

const inputStyle = { padding: '6px 10px', borderRadius: 4, border: '1px solid var(--line-1, #ddd)', width: '100%' }

const meta: Meta<typeof Field> = {
  title: 'shared-ui/Field',
  component: Field,
  args: {
    label: 'Material ID',
    htmlFor: 'demo',
    children: <input id="demo" type="text" placeholder="MAT-1234" style={inputStyle} />,
  },
}
export default meta

type Story = StoryObj<typeof Field>

export const Default: Story = {}
export const Required: Story = { args: { required: true } }
export const WithHelp: Story = { args: { help: 'Enter the SAP material number from the BOM.' } }
export const WithError: Story = { args: { error: 'Material not found — check the ID and try again.', required: true } }
export const HelpSuppressedByError: Story = {
  args: {
    help: 'This help text is hidden when an error is shown.',
    error: 'Validation failed.',
  },
}
