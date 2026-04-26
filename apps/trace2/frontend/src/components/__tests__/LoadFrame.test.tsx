import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LoadFrame } from '../LoadFrame'
import React from 'react'

describe('LoadFrame', () => {
  it('renders loading state', () => {
    const state = { kind: 'loading' } as any
    render(
      <LoadFrame state={state} eyebrow="TEST" loadingTitle="Testing...">
        {() => <div />}
      </LoadFrame>
    )
    expect(screen.getByText('Testing...')).toBeInTheDocument()
  })

  it('renders error state', () => {
    const state = { kind: 'error', error: 'Failed to load' } as any
    render(
      <LoadFrame state={state} eyebrow="TEST" loadingTitle="Testing...">
        {() => <div />}
      </LoadFrame>
    )
    expect(screen.getByText(/Couldn't load page data/i)).toBeInTheDocument()
  })

  it('renders content when ready', () => {
    const state = { kind: 'ready', data: { name: 'World' } } as any
    render(
      <LoadFrame state={state} eyebrow="TEST" loadingTitle="Testing...">
        {(data: any) => <div>Hello {data.name}</div>}
      </LoadFrame>
    )
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })
})
