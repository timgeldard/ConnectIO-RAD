const items = [
  { label: 'Healthy (< 2% rejection)',   color: 'var(--status-ok)'   },
  { label: 'Warning (2–10% rejection)',  color: 'var(--status-warn)' },
  { label: 'Critical (≥ 10% rejection)', color: 'var(--status-risk)' },
  { label: 'OOC Signal Present',         color: 'var(--status-risk)' },
]

export default function ProcessFlowLegend() {
  return (
    <div style={{
      position: 'absolute', bottom: 14, right: 14, zIndex: 10,
      borderRadius: 10, border: '1px solid var(--line-1)',
      background: 'var(--surface-1)', padding: '10px 14px',
      boxShadow: 'var(--shadow-card)',
    }}>
      <p style={{ margin: '0 0 8px', fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Node health
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-2)' }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: item.color, flexShrink: 0 }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
