import type { ExcludedPoint, ExclusionAuditSnapshot } from '../types'

function formatLimit(value: number | null | undefined) {
  return value == null ? '—' : Number(value).toFixed(4)
}

interface ExcludedPointsPanelProps {
  snapshot: ExclusionAuditSnapshot | null
  currentPoints?: ExcludedPoint[]
  onRestorePoint?: (point: ExcludedPoint) => void
  onRestoreAll: () => void
  saving: boolean
}

const S = {
  panel: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' },
  header: { display: 'flex', flexWrap: 'wrap' as const, alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' },
  title: { margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)' },
  subtitle: { margin: '0.125rem 0 0', fontSize: '0.75rem', color: 'var(--text-3)' },
  meta: { display: 'flex', flexWrap: 'wrap' as const, gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-3)' },
  diffGrid: { display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr' },
  diffCard: { display: 'flex', flexDirection: 'column' as const, gap: '0.25rem', padding: '0.75rem', fontSize: '0.875rem', background: 'var(--surface-2)', border: '1px solid var(--line-1)', borderRadius: 6, color: 'var(--text-1)' },
  diffCardActive: { background: 'var(--status-info-bg)', borderColor: 'var(--status-info)' },
  diffLabel: { fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em', color: 'var(--text-3)' },
  empty: { padding: '0.75rem', fontSize: '0.875rem', background: 'var(--surface-2)', borderRadius: 6, color: 'var(--text-3)' },
  listItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.5rem 0.75rem', border: '1px solid var(--line-1)', borderRadius: 6 },
  listItemMain: { display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-1)' },
}

export default function ExcludedPointsPanel({
  snapshot,
  currentPoints = [],
  onRestorePoint,
  onRestoreAll,
  saving,
}: ExcludedPointsPanelProps) {
  const pointCount = snapshot?.excluded_count ?? currentPoints.length ?? 0
  const points = currentPoints.length > 0 ? currentPoints : (snapshot?.excluded_points ?? [])
  const before = snapshot?.before_limits ?? null
  const after = snapshot?.after_limits ?? null

  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 10, padding: '1rem' }}>
      <section style={S.panel}>
        <div style={S.header}>
          <div>
            <h3 style={S.title}>Excluded Points</h3>
            <p style={S.subtitle}>
              {pointCount} active exclusion{pointCount === 1 ? '' : 's'} for this chart scope
            </p>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onRestoreAll}
            disabled={saving || pointCount === 0}
          >
            Restore All
          </button>
        </div>

        {(snapshot?.user_id || snapshot?.event_ts) && (
          <div style={S.meta}>
            {snapshot?.user_id && <span>By {snapshot.user_id}</span>}
            {snapshot?.event_ts && <span>{String(snapshot.event_ts).replace('T', ' ').slice(0, 19)}</span>}
            {snapshot?.stratify_by && <span>Scope {snapshot.stratify_by.replace(/_/g, ' ')}</span>}
            {snapshot?.justification && <span>{snapshot.justification}</span>}
          </div>
        )}

        <div style={S.diffGrid}>
          <div style={S.diffCard}>
            <span style={S.diffLabel}>Before</span>
            <strong>CL {formatLimit(before?.cl)}</strong>
            <span>UCL {formatLimit(before?.ucl)} · LCL {formatLimit(before?.lcl)}</span>
          </div>
          <div style={{ ...S.diffCard, ...S.diffCardActive }}>
            <span style={S.diffLabel}>After</span>
            <strong>CL {formatLimit(after?.cl)}</strong>
            <span>UCL {formatLimit(after?.ucl)} · LCL {formatLimit(after?.lcl)}</span>
          </div>
        </div>

        {points.length === 0 ? (
          <div style={S.empty}>
            No persisted exclusions for this chart yet. Excluded points will appear here with their audit trail.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {points.map((point, index) => {
              const pointKey = `${point.batch_id}-${point.sample_seq}-${point.plant_id ?? ''}-${point.stratify_value ?? ''}-${point.original_index ?? `saved-${index}`}`
              return (
                <div key={pointKey} style={S.listItem}>
                  <div style={S.listItemMain}>
                    <strong>{point.batch_id ?? 'Point'}</strong>
                    <span>Sample {point.sample_seq ?? '—'}</span>
                    {point.batch_date && <span>{String(point.batch_date).slice(0, 10)}</span>}
                    {point.value != null && <span>Value {Number(point.value).toFixed(4)}</span>}
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onRestorePoint?.(point)}
                    disabled={saving}
                  >
                    Restore
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
