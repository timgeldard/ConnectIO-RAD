import { GenericOverview } from '~/components/GenericOverview'

const readBatchContext = () => {
  const params = new URLSearchParams(window.location.search)
  return params.get('batch') ?? params.get('batch_id') ?? 'Not selected'
}

/** Trace Lineage tab — upstream/downstream graph. Full SVG implementation pending. */
export function TraceLineage() {
  const batch = readBatchContext()
  return (
    <GenericOverview
      eyebrow="TRACE · MODULE 01 · PAGE 03"
      title="LINEAGE"
      desc="Forward and backward trace across 3 upstream and 2 downstream levels. Node-link graph with depth controls."
      kpis={[
        { label: 'Upstream levels', value: '3' },
        { label: 'Downstream levels', value: '2' },
        { label: 'Total nodes', value: '17' },
        { label: 'Focal batch', value: batch },
      ]}
      panels={[
        { num: 'A', title: 'Upstream materials', meta: 'DEPTH 3', body: 'Whey concentrate (Glanbia · IE) → WPC-80 base mix → WPC-80 wet feed. Skim milk powder (Aurivo · IE) · Lactose mono (Lactosan · DK) · Process aid A12 (Kerry · NL).' },
        { num: 'B', title: 'Downstream shipments', meta: 'DEPTH 2', body: 'Dispatched to 8 direct customers (Müller · Lactalis · Pascual · Arla · FrieslandCampina · Danone · Ehrmann · Yoplait). Second-tier customers via repacking at Aretsried and Laval.' },
      ]}
    />
  )
}
