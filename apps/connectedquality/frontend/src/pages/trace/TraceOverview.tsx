import { GenericOverview } from '~/components/GenericOverview'

const readTraceContext = () => {
  const params = new URLSearchParams(window.location.search)
  return {
    plant: params.get('plant') ?? params.get('plant_id') ?? 'Not selected',
    material: params.get('material') ?? params.get('material_id') ?? 'Not selected',
    batch: params.get('batch') ?? params.get('batch_id') ?? 'Not selected',
  }
}

/** Trace module overview — batch health summary. */
export function TraceOverview() {
  const ctx = readTraceContext()
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
        { num: 'B', title: 'Active context', meta: 'DEEP LINK', body: `Plant ${ctx.plant}. Material ${ctx.material}. Batch ${ctx.batch}. Switching context above will cascade into every page in the module.` },
      ]}
    />
  )
}
