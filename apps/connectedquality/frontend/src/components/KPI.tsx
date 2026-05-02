import type { ReactNode } from 'react'

export type KpiTone = 'good' | 'warn' | 'bad' | ''

interface KpiProps {
  label: string
  value: ReactNode
  unit?: string
  sub?: string
  tone?: KpiTone
  spark?: ReactNode
}

/** Dense KPI tile with label, numeric value, optional unit and sub-label. */
export function KPI({ label, value, unit, sub, tone = '', spark }: KpiProps) {
  return (
    <div className={'cq-kpi ' + tone}>
      <div className="lbl">{label}</div>
      <div className="val">
        {value}
        {unit != null && <span className="unit">{unit}</span>}
      </div>
      {sub != null && <div className="sub">{sub}</div>}
      {spark}
    </div>
  )
}
