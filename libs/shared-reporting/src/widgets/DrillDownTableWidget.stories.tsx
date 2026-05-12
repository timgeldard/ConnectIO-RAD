import type { Meta, StoryObj } from '@storybook/react'
import { DrillDownTableWidget } from './DrillDownTableWidget'
import { makeTableConfig } from '../helpers'

const meta: Meta<typeof DrillDownTableWidget> = {
  title: 'shared-reporting/DrillDownTableWidget',
  component: DrillDownTableWidget,
}
export default meta

type Story = StoryObj<typeof DrillDownTableWidget>

const orderColumns = [
  { key: 'order_id', label: 'Order ID', width: 120 },
  { key: 'material', label: 'Material', width: 160 },
  { key: 'plant', label: 'Plant', width: 80 },
  { key: 'qty', label: 'Qty (kg)', width: 90, align: 'right' as const },
  { key: 'status', label: 'Status', width: 100 },
]

const orderRows = [
  { order_id: 'PO-1001', material: 'Salt M0201', plant: 'P01', qty: '2,400', status: 'Confirmed' },
  { order_id: 'PO-1002', material: 'Sugar M0402', plant: 'P02', qty: '1,800', status: 'In Progress' },
  { order_id: 'PO-1003', material: 'Starch M0112', plant: 'P01', qty: '900', status: 'Completed' },
  { order_id: 'PO-1004', material: 'Casein M0315', plant: 'P03', qty: '3,100', status: 'Confirmed' },
  { order_id: 'PO-1005', material: 'Pepper M0709', plant: 'P02', qty: '450', status: 'On Hold' },
]

export const Default: Story = {
  args: {
    config: makeTableConfig('order-list', 'Order Detail'),
    props: { columns: orderColumns, rows: orderRows },
  },
}

export const WithScrollLimit: Story = {
  args: {
    config: makeTableConfig('order-scroll', 'Orders — Scrollable'),
    props: {
      columns: orderColumns,
      rows: Array.from({ length: 20 }, (_, i) => ({
        order_id: `PO-${1000 + i}`,
        material: `Material ${i}`,
        plant: `P0${(i % 3) + 1}`,
        qty: String((i + 1) * 500),
        status: i % 3 === 0 ? 'Confirmed' : i % 3 === 1 ? 'In Progress' : 'Completed',
      })),
      maxHeight: 280,
    },
  },
}

export const Empty: Story = {
  args: {
    config: makeTableConfig('empty', 'No Results'),
    props: { columns: orderColumns, rows: [], emptyMessage: 'No orders match the selected filters.' },
  },
}
