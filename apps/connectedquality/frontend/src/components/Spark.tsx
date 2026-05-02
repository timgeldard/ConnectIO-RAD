interface SparkProps {
  data: number[]
  color?: string
  w?: number
  h?: number
}

/** Inline sparkline polyline SVG for KPI tiles and table rows. */
export function Spark({ data, color = 'var(--cq-accent)', w = 70, h = 22 }: SparkProps) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const step = w / (data.length - 1)
  const pts = data
    .map((d, i) => `${(i * step).toFixed(1)},${(h - ((d - min) / range) * h).toFixed(1)}`)
    .join(' ')
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" />
    </svg>
  )
}
