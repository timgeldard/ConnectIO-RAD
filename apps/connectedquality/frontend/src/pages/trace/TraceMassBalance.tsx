import { GenericOverview } from '~/components/GenericOverview'

/** Trace Mass Balance tab — input/output reconciliation. Full chart implementation pending. */
export function TraceMassBalance() {
  return (
    <GenericOverview
      eyebrow="TRACE · MODULE 01 · PAGE 04"
      title="MASS BALANCE"
      desc="Input vs. output reconciliation for the active batch. Variance breakdown by stage with tolerance thresholds."
      kpis={[
        { label: 'Input', value: '12,820', unit: 'kg' },
        { label: 'Output', value: '12,400', unit: 'kg', tone: 'good' },
        { label: 'Variance', value: '420', unit: 'kg', tone: 'warn' },
        { label: 'Variance %', value: '3.28', unit: '%', tone: 'warn', sub: 'threshold 5%' },
      ]}
      panels={[
        { num: 'A', title: 'Stage breakdown', meta: 'WPC-80 LINE 4', body: 'Dryer inlet 12,820 kg → spray drying −280 kg moisture loss (expected) → powder output 12,540 kg → packaging yield loss −140 kg → final 12,400 kg. Variance within tolerance.' },
        { num: 'B', title: 'Tolerance status', meta: 'PASS', body: 'Variance 3.28% vs. threshold 5.0%. Both absolute (≤500 kg) and relative (≤5%) checks pass. No mass balance exception raised.' },
      ]}
    />
  )
}
