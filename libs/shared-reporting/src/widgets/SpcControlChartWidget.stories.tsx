import type { Meta, StoryObj } from '@storybook/react'
import { SPCControlChartWidget } from './SpcControlChartWidget'
import { makeSpcConfig } from '../helpers'

const meta: Meta<typeof SPCControlChartWidget> = {
  title: 'shared-reporting/SpcControlChartWidget',
  component: SPCControlChartWidget,
}
export default meta

type Story = StoryObj<typeof SPCControlChartWidget>

const basePoints = Array.from({ length: 20 }, (_, i) => ({
  label: `S${i + 1}`,
  value: 100 + Math.sin(i / 2) * 3 + (Math.random() * 2 - 1),
}))

export const Default: Story = {
  args: {
    config: makeSpcConfig('fill-weight', 'Fill Weight X-bar Chart'),
    props: {
      points: basePoints,
      limits: { ucl: 106, cl: 100, lcl: 94, sigma1: 102, sigma2: 104 },
      valueLabel: 'grams',
    },
  },
}

export const WithSignals: Story = {
  args: {
    config: makeSpcConfig('temp-spc', 'Process Temperature'),
    props: {
      points: [
        ...basePoints.slice(0, 12),
        { label: 'S13', value: 107.2, signal: true },
        { label: 'S14', value: 108.1, signal: true },
        ...basePoints.slice(14),
      ],
      limits: { ucl: 106, cl: 100, lcl: 94 },
      valueLabel: '°C',
    },
  },
}

export const WithExcluded: Story = {
  args: {
    config: makeSpcConfig('viscosity', 'Viscosity (excl. startup)'),
    props: {
      points: [
        { label: 'S1', value: 85, excluded: true },
        { label: 'S2', value: 88, excluded: true },
        ...basePoints.slice(2).map((p, i) => ({ ...p, label: `S${i + 3}` })),
      ],
      limits: { ucl: 106, cl: 100, lcl: 94, sigma1: 102, sigma2: 104 },
    },
  },
}

export const Empty: Story = {
  args: {
    config: makeSpcConfig('empty', 'No Data'),
    props: { points: [] },
  },
}
