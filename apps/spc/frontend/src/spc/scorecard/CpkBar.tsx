interface CpkBarProps {
  cpk: number | null | undefined
}

export default function CpkBar({ cpk }: CpkBarProps) {
  if (cpk == null) return <span style={{ color: 'var(--text-3)', fontSize: 11 }}>N/A</span>
  const pct = Math.min(100, (cpk / 2) * 100)
  const color = cpk >= 1.33 ? 'var(--status-ok)' : cpk >= 1 ? 'var(--status-warn)' : 'var(--status-risk)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--surface-2)', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
        <div style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: 'var(--line-strong)' }} />
        <div style={{ position: 'absolute', left: '66.5%', top: -2, bottom: -2, width: 1, background: 'var(--text-3)' }} />
      </div>
      <span className="mono" style={{ fontSize: 12, fontWeight: 600, color, minWidth: 34, textAlign: 'right' }}>
        {cpk.toFixed(2)}
      </span>
    </div>
  )
}
