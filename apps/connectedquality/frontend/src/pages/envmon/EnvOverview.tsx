import { GenericOverview } from '~/components/GenericOverview'

/** EnvMon Site tab — per-site compliance overview. */
export function EnvOverview() {
  return (
    <GenericOverview
      eyebrow="ENVMON · MODULE 02 · PAGE 02"
      title="SITE — CHARLEVILLE"
      desc="Per-site environmental monitoring. Floor-by-floor compliance, decayed organism risk, and CAR coverage."
      kpis={[
        { label: 'Locations', value: '187' },
        { label: 'Swabs · 90D', value: '612' },
        { label: 'Compliance', value: '94.1', unit: '%', tone: 'warn' },
        { label: 'Open warnings', value: '4', tone: 'warn' },
        { label: 'Open fails', value: '1', tone: 'bad' },
        { label: 'Last MIC sweep', value: '03:18', sub: 'Today · F2 night shift' },
      ]}
      panels={[
        { num: 'A', title: 'Floor breakdown', meta: 'F1 · F2 · F3', body: 'F1 raw intake / wash bay — 0 fails, 1 warning. F2 RTE process — 1 listeria fail in zone RTE-3, 3 warnings rising. F3 packaging — clean. F2 floor plan is on the next page.' },
        { num: 'B', title: 'Calibration & decay', meta: 'MODEL', body: 'Risk score uses organism-specific exponential decay (λ Listeria 0.21 d⁻¹ · Salmonella 0.18 d⁻¹). Continuous-mode sensitivity is 0.62 ×; deterministic mode is available for audits.' },
      ]}
    />
  )
}
