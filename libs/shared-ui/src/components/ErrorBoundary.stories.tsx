import type { Meta, StoryObj } from '@storybook/react'
import { ErrorBoundary } from './ErrorBoundary'

function ThrowingChild() {
  throw new Error('Simulated render error')
}

const meta: Meta<typeof ErrorBoundary> = {
  title: 'shared-ui/ErrorBoundary',
  component: ErrorBoundary,
}
export default meta

type Story = StoryObj<typeof ErrorBoundary>

export const Idle: Story = {
  args: { children: <p>Content renders normally here.</p> },
}

export const Triggered: Story = {
  args: {
    children: <ThrowingChild />,
    message: 'Something went wrong',
    description: 'The chart could not be rendered.',
    retryLabel: 'Try again',
  },
}

export const WithCustomMessage: Story = {
  args: {
    children: <ThrowingChild />,
    message: 'Data unavailable',
    description: 'The warehouse is temporarily unreachable.',
  },
}
