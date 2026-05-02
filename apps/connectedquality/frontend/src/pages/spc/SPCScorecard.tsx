import { GenericOverview } from '~/components/GenericOverview'

/** SPC Scorecard tab — Cpk/Ppk table for all characteristics. Full table implementation pending. */
export function SPCScorecard() {
  return (
    <GenericOverview
      eyebrow="SPC · MODULE 03 · PAGE 04"
      title="SCORECARD"
      desc="Per-characteristic Cpk, Ppk, and OOC signal counts for all materials and lines in scope."
      kpis={[
        { label: 'Characteristics', value: '8' },
        { label: 'In control', value: '4', tone: 'good' },
        { label: 'Drifting', value: '3', tone: 'warn' },
        { label: 'Out of control', value: '1', tone: 'bad' },
      ]}
      panels={[
        { num: 'A', title: 'Worst performers', meta: 'WPC-80 · L4', body: 'Bulk density Cpk 0.86 — out of control (spray drying stage). Particle D50 Cpk 1.04 — drifting. Outlet temp Cpk 1.18 — drifting. All other characteristics within capability targets.' },
        { num: 'B', title: 'Action priorities', meta: 'REC', body: 'Spray drying bulk density has been deteriorating for 9 hours. Recommend immediate atomiser nozzle inspection and pressure adjustment. Escalate to process engineering if Cpk does not recover within 2 hours.' },
      ]}
    />
  )
}
