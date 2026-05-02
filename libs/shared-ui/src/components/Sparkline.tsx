interface SparklineProps {
  values: number[]
  color?: string
  width?: number
  height?: number
}

export function Sparkline({ values, color = 'var(--valentia-slate)', width = 90, height = 22 }: SparklineProps) {
  if (!values || values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const pts: [number, number][] = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - ((v - min) / range) * (height - 4) - 2,
  ])

  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`

  const [lastX, lastY] = pts[pts.length - 1]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      <path d={areaPath} fill={color} opacity={0.1} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
    </svg>
  )
}
