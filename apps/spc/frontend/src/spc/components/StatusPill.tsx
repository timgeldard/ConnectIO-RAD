import type { ReactNode } from 'react'
import { StatusPill } from '@connectio/shared-ui'

export type StatusPillStatus =
  | 'in-control'           // No SPC violations AND Cpk >= threshold
  | 'warning'              // No SPC violations BUT Cpk < threshold
  | 'out-of-control'       // SPC violation present
  | 'out-of-control-high'  // Violation AND Cpk < threshold
  | 'unknown'              // Insufficient data

/** Helper: derive status from SPC + capability values */
export function deriveStatus(
  hasViolations: boolean,
  cpk: number | null | undefined,
  cpkThreshold = 1.0,
): StatusPillStatus {
  if (cpk == null) return hasViolations ? 'out-of-control' : 'unknown'
  const capable = cpk >= cpkThreshold
  if (hasViolations && !capable) return 'out-of-control-high'
  if (hasViolations)             return 'out-of-control'
  if (!capable)                  return 'warning'
  return 'in-control'
}

/** Helper: derive a text-color style from GRR percentage for MSA verdicts. */
export function grrStatusClass(grrPct: number | null | undefined): { colorStyle: string; verdict: string } {
  if (grrPct == null) return { colorStyle: 'var(--text-3)',      verdict: 'Unknown'                  }
  if (grrPct < 10)    return { colorStyle: 'var(--status-ok)',   verdict: 'Acceptable'               }
  if (grrPct < 30)    return { colorStyle: 'var(--status-warn)', verdict: 'Conditionally Acceptable' }
  return                     { colorStyle: 'var(--status-risk)', verdict: 'Not Acceptable'           }
}

/** Shared composition — StatusPill alongside explanatory children */
export function StatusPillWithReason({
  status,
  children,
}: {
  status: StatusPillStatus
  children?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
      <StatusPill status={status} />
      {children && (
        <span style={{ fontSize: '0.875rem', color: 'var(--text-3)' }}>{children}</span>
      )}
    </div>
  )
}
