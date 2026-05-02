import { GenericOverview } from '~/components/GenericOverview'

/** EnvMon Time-Lapse tab — animated heatmap playback. Full implementation pending. */
export function EnvHistory() {
  return (
    <GenericOverview
      eyebrow="ENVMON · MODULE 02 · PAGE 04"
      title="TIME-LAPSE"
      desc="Replay the past 90 days of environmental monitoring as an animated heatmap. Useful for pattern discovery — drains, drift, sanitation effectiveness."
      kpis={[
        { label: 'Window', value: '90', unit: 'd' },
        { label: 'Frames', value: '180', sub: '12h cadence' },
        { label: 'Sites in view', value: '1', sub: 'Charleville F2' },
        { label: 'Anomalies', value: '11', tone: 'warn' },
      ]}
      panels={[
        { num: 'A', title: 'Patterns detected', meta: 'AUTO', body: 'Morning shift wash cycle reduces F2 RTE-3 zone listeria risk by 38%. Two false-cleaned events on 2026-04-19 and 04-22 preceded the current rising trend.' },
        { num: 'B', title: 'Playback controls', meta: 'TIMELINE', body: 'Use the timeline scrubber on the floor plan page (toggle ▶ Play 90d) to drive playback. Speed presets: 1× · 4× · 30× · whole-window dissolve.' },
      ]}
    />
  )
}
