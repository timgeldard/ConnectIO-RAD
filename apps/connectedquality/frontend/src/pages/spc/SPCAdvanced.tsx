import { GenericOverview } from '~/components/GenericOverview'

/** SPC Multivariate tab — Hotelling T² and PCA. Full implementation pending. */
export function SPCAdvanced() {
  return (
    <GenericOverview
      eyebrow="SPC · MODULE 03 · PAGE 05"
      title="MULTIVARIATE"
      desc="Hotelling T² and PCA decomposition. Used when individual univariate charts look in-control but their joint distribution drifts."
      kpis={[
        { label: 'T² limit (α=0.01)', value: '16.3' },
        { label: 'Latest T²', value: '21.7', tone: 'bad' },
        { label: 'Components retained', value: '3', sub: '92% var. explained' },
        { label: 'Window', value: '240', sub: 'samples' },
        { label: 'Variables', value: '7' },
      ]}
      panels={[
        { num: 'A', title: 'Top loadings', meta: 'PC1 · 54%', body: 'Outlet temperature (0.52) · Moisture (-0.46) · Feed rate (0.41). The current breach is moving along PC1 — i.e. classic over-dry / over-temp drift.' },
        { num: 'B', title: 'Suggested action', meta: 'REC', body: 'Drop outlet setpoint 1.5°C and reduce feed rate by 3% for one shift. If drift persists, inspect atomiser nozzle wear.' },
      ]}
    />
  )
}
