import { GenericOverview } from '~/components/GenericOverview'

/** Trace Quality tab — inspection lots, deviations, CAPAs. */
export function TraceQuality() {
  return (
    <GenericOverview
      eyebrow="TRACE · MODULE 01 · PAGE 05"
      title="QUALITY"
      desc="Inspection lots, usage decisions, deviations and CAPAs for the active batch."
      kpis={[
        { label: 'Insp. lots', value: '12' },
        { label: 'Open deviations', value: '1', tone: 'warn' },
        { label: 'CAPAs', value: '0', tone: 'good' },
        { label: 'Usage decision', value: 'Hold', tone: 'warn' },
      ]}
      panels={[
        { num: 'A', title: 'Open inspection', meta: 'LOT 4500238812', body: 'Pending micro release — listeria + coliforms expected back at 16:00 UTC. Once cleared, batch flips from QI-hold to UNRESTRICTED-100.' },
        { num: 'B', title: 'Recent deviations', meta: '30D', body: 'DV-2026-0411 · spray dryer outlet temp excursion +1.8°C for 11 minutes during shift change. Closed without product impact, root cause: PID re-tune missed.' },
      ]}
    />
  )
}
