interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

const shimmer: React.CSSProperties = {
  background: 'var(--surface-sunken)',
  borderRadius: 4,
  display: 'block',
}

import type React from 'react'

export function Skeleton({ className, style }: SkeletonProps) {
  return <div className={className} style={{ ...shimmer, width: '100%', height: '2.5rem', ...style }} aria-hidden="true" />
}

Skeleton.Text = function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={className} aria-busy="true" aria-label="Loading text" style={{ display: 'grid', gap: '0.5rem' }}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} style={{ ...shimmer, width: i === lines - 1 ? '60%' : '100%', height: '1rem' }} aria-hidden="true" />
      ))}
    </div>
  )
}

Skeleton.Chart = function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={className} aria-busy="true" aria-label="Loading chart" style={{ display: 'grid', gap: '0.5rem' }}>
      <div style={{ ...shimmer, width: '100%', height: '280px' }} aria-hidden="true" />
      <div style={{ ...shimmer, width: '100%', height: '160px' }} aria-hidden="true" />
    </div>
  )
}

Skeleton.Table = function SkeletonTable({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={className} aria-busy="true" aria-label="Loading table" style={{ display: 'grid', gap: '0.5rem' }}>
      <div style={{ ...shimmer, width: '100%', height: '2rem' }} aria-hidden="true" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ ...shimmer, width: '100%', height: '2.5rem' }} aria-hidden="true" />
      ))}
    </div>
  )
}
