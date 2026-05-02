import type { ReactNode } from 'react'

type PillKind = 'good' | 'warn' | 'bad' | 'info' | 'muted'

interface PillProps {
  kind: PillKind
  children: ReactNode
}

/** Compact status pill with dot indicator — good / warn / bad / info / muted. */
export function Pill({ kind, children }: PillProps) {
  return (
    <span className={'cq-pill ' + kind}>
      <span className="dot" />
      {children}
    </span>
  )
}
