import { useQuery } from '@tanstack/react-query'
import { GenericOverview } from '~/components/GenericOverview'
import { fetchJson } from '@connectio/shared-frontend-api'
import { Icon } from '~/components/Icon'
import { useTheme } from '@connectio/shared-ui'

/** EnvMon Time-Lapse tab — animated heatmap playback. Full implementation pending. */
export function EnvHistory() {
  const { theme } = useTheme()
  const params = new URLSearchParams(window.location.search)
  const plantId = params.get('plant_id') ?? params.get('plant')
  const floorId = params.get('floor')
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['cq', 'envmon', 'history', plantId, floorId],
    enabled: Boolean(plantId),
    queryFn: () => fetchJson<{ data_available?: boolean, reason?: string }>(`/api/cq/envmon/history?plant_id=${encodeURIComponent(plantId as string)}${floorId ? `&floor=${encodeURIComponent(floorId)}` : ''}&days=90`),
  })

  if (!plantId) {
    return <div data-theme={theme} style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>Select a plant or open EnvMon with a plant deep link to view time-lapse history.</div>
  }

  if (isLoading) {
    return <div data-theme={theme} style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>Loading time-lapse data…</div>
  }

  if (isError) {
    return (
      <div data-theme={theme} style={{ padding: 48, textAlign: 'center', color: 'var(--status-risk)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Icon name="close" size={48} style={{ display: 'block', margin: '0 auto 24px', opacity: 0.5 }} />
        <h2 style={{ fontSize: 24, fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)', marginBottom: 12 }}>Failed to load data</h2>
        <p style={{ color: 'var(--text-3)', fontSize: 16 }}>{(error as Error)?.message || 'An unknown error occurred.'}</p>
      </div>
    )
  }

  if (data?.data_available === false) {
    return (
      <div data-theme={theme} style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Icon name="clock" size={48} style={{ display: 'block', margin: '0 auto 24px', opacity: 0.5 }} />
        <h2 style={{ fontSize: 24, fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)', marginBottom: 12 }}>No time-lapse data available</h2>
        <p style={{ color: 'var(--text-3)', fontSize: 16 }}>{data.reason ?? 'The selected plant has no published time-lapse dataset yet.'}</p>
      </div>
    )
  }

  return (
    <GenericOverview
      eyebrow="ENVMON · MODULE 02 · PAGE 04"
      title="TIME-LAPSE"
      desc="Replay the past 90 days of environmental monitoring as an animated heatmap. Useful for pattern discovery — drains, drift, sanitation effectiveness."
      kpis={[
        { label: 'Window', value: '90', unit: 'd' },
        { label: 'Frames', value: '180', sub: '12h cadence' },
        { label: 'Sites in view', value: plantId ? '1' : '0', sub: floorId ? `${plantId} ${floorId}` : plantId || 'No plant selected' },
        { label: 'Anomalies', value: '11', tone: 'warn' },
      ]}
      panels={[
        { num: 'A', title: 'Patterns detected', meta: 'AUTO', body: 'Morning shift wash cycle reduces F2 RTE-3 zone listeria risk by 38%. Two false-cleaned events on 2026-04-19 and 04-22 preceded the current rising trend.' },
        { num: 'B', title: 'Playback controls', meta: 'TIMELINE', body: 'Use the timeline scrubber on the floor plan page (toggle ▶ Play 90d) to drive playback. Speed presets: 1× · 4× · 30× · whole-window dissolve.' },
      ]}
    />
  )
}
