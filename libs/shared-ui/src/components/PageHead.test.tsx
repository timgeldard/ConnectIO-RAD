import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PageHead } from './PageHead'

describe('PageHead', () => {
  it('renders the title', () => {
    render(<PageHead title="Batch Traceability" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Batch Traceability')
  })

  it('renders eyebrow label when provided', () => {
    render(<PageHead title="SPC" eyebrow="ConnectedQuality / SPC" />)
    expect(screen.getByText('ConnectedQuality / SPC')).toBeInTheDocument()
  })

  it('does not render eyebrow when omitted', () => {
    render(<PageHead title="SPC" />)
    expect(screen.queryByText('ConnectedQuality / SPC')).not.toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<PageHead title="SPC" desc="Rolling 30-day window." />)
    expect(screen.getByText('Rolling 30-day window.')).toBeInTheDocument()
  })

  it('renders action slot', () => {
    render(<PageHead title="SPC" actions={<button>Export</button>} />)
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
  })
})
