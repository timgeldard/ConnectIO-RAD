import { GenericOverview } from '~/components/GenericOverview'

/** Trace module overview — batch health summary. */
export function TraceOverview() {
  return (
    <GenericOverview
      eyebrow="TRACE · MODULE 01 · PAGE 01"
      title="OVERVIEW"
      desc="Module landing for batch traceability. Health summary across all batches, materials, and plants in scope of the active context."
      kpis={[
        { label: 'Active batches', value: '1,284' },
        { label: 'Trace coverage', value: '99.2', unit: '%', tone: 'good' },
        { label: 'Open recalls', value: '3', tone: 'bad' },
        { label: 'QI · in hold', value: '27', tone: 'warn' },
        { label: 'CoAs missing', value: '2', tone: 'warn' },
        { label: 'MTTR · trace', value: '11', unit: 'min', sub: 'rolling 30d' },
      ]}
      panels={[
        { num: 'A', title: "What's in this module", meta: '11 PAGES', body: 'Recall readiness · Lineage (forward/backward) · Mass balance · Quality records · CoAs · Supplier risk · Batch-level audit trail. The 03–04 pages are most-used during recall investigation; the rest support release decisions.' },
        { num: 'B', title: 'Active context', meta: 'GLOBAL', body: 'Plant Charleville · IE. Material WPC-80 / 1kg pouch · 20582002. Batch 0008898869. Window 90 days. Switching context above will cascade into every page in the module.' },
      ]}
    />
  )
}
