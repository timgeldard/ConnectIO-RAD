import { GenericOverview } from '~/components/GenericOverview'

/** SPC Overview tab — capability index and OOC summary. */
export function SPCOverview() {
  return (
    <GenericOverview
      eyebrow="SPC · MODULE 03 · PAGE 01"
      title="OVERVIEW"
      desc="Statistical process control across all materials and lines in scope. Live capability indices, OOC signals, multivariate health."
      kpis={[
        { label: 'Charts live', value: '318' },
        { label: 'Avg Cpk', value: '1.41', tone: 'good' },
        { label: 'Avg Ppk', value: '1.22', tone: 'warn' },
        { label: 'OOC · 24h', value: '5', tone: 'warn' },
        { label: 'Multivariate breaches', value: '1', tone: 'bad' },
        { label: 'Window', value: '12w', sub: 'rolling' },
      ]}
      panels={[
        { num: 'A', title: 'Chart families', meta: '5 TYPES', body: 'I-MR · X̄-R · EWMA · CUSUM · Hotelling T² · P-charts. Rule sets: WECO (1–4) and Nelson (1–8). σ-level overrides per characteristic; sample window 30/60/80.' },
        { num: 'B', title: 'Process flow & scorecard', meta: 'PAGE 02 / 04', body: 'Process DAG colours stages by Cpk health; scorecard surfaces every characteristic against its targets. The dryer outlet has been drifting for 9 hours — see page 03 for the I-MR detail.' },
      ]}
    />
  )
}
