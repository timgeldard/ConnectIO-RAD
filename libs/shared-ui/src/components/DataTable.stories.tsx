import type { Meta, StoryObj } from '@storybook/react'
import { DataTable } from './DataTable'

interface BatchRow {
  batch_id: string
  material: string
  qty: number
  status: string
}

const ROWS: BatchRow[] = [
  { batch_id: 'B1001', material: 'Hydrolysate A', qty: 1200, status: 'Released' },
  { batch_id: 'B1002', material: 'Enzyme Blend B', qty: 850, status: 'In QI' },
  { batch_id: 'B1003', material: 'Hydrolysate A', qty: 1100, status: 'Released' },
  { batch_id: 'B1004', material: 'Concentrate C', qty: 400, status: 'Blocked' },
]

const meta: Meta<typeof DataTable<BatchRow>> = {
  title: 'shared-ui/DataTable',
  component: DataTable,
  args: {
    rows: ROWS,
    columns: [
      { header: 'Batch ID', key: 'batch_id', mono: true },
      { header: 'Material', key: 'material' },
      { header: 'Qty (kg)', key: 'qty', align: 'right', num: true },
      { header: 'Status', key: 'status' },
    ],
  },
}
export default meta

type Story = StoryObj<typeof DataTable<BatchRow>>

export const Default: Story = {}
export const Dense: Story = { args: { dense: true } }
export const Loading: Story = { args: { loading: true } }
export const WithSort: Story = { args: { sortKey: 'batch_id', sortDir: 'asc' } }
export const Clickable: Story = { args: { onRowClick: (row) => alert(`Clicked: ${row.batch_id}`) } }
export const WithEmphasized: Story = { args: { emphasize: (row) => row.status === 'Blocked' } }
