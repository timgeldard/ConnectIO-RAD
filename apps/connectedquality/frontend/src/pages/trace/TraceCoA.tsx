import { GenericOverview } from '~/components/GenericOverview'

/** Trace CoA tab — certificate of analysis generation and verification. */
export function TraceCoA() {
  return (
    <GenericOverview
      eyebrow="TRACE · MODULE 01 · PAGE 06"
      title="CERTIFICATE OF ANALYSIS"
      desc="CoA generation, attachment, and verification across upstream vendors and outbound shipments."
      kpis={[
        { label: 'Outbound CoAs', value: '42' },
        { label: 'Pending', value: '3', tone: 'warn' },
        { label: 'Vendor CoAs missing', value: '1', tone: 'warn' },
        { label: 'Auto-generated', value: '97', unit: '%', tone: 'good' },
      ]}
      panels={[
        { num: 'A', title: 'Specs vs. result', meta: 'WPC-80', body: 'Protein 80.4% (spec ≥80.0). Moisture 4.1% (spec ≤4.5). Fat 6.8% (spec ≤8.0). Bulk density 0.42 g/cc (spec 0.38–0.46). Particle D50 89µm (spec 80–100). All within spec.' },
        { num: 'B', title: 'Customer overrides', meta: '11 CUSTOMERS', body: 'Müller Foods requires extended micro panel; Lactalis requires 2-decimal protein reporting. Both are auto-applied by the CoA template engine.' },
      ]}
    />
  )
}
