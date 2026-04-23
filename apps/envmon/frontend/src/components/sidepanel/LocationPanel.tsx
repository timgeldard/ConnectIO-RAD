import { useState } from 'react';
import { useEM } from '~/context/EMContext';
import { useLocationSummary } from '~/api/client';
import StatusPill from '~/components/ui/StatusPill';
import { IconX } from '~/components/ui/Icons';
import TrendTab from './TrendTab';
import LotsTab from './LotsTab';

const TABS = ['trend', 'lots'] as const;
type Tab = typeof TABS[number];

export default function LocationPanel() {
  const { view, selectedLocId, setSelectedLocId } = useEM();
  const plantId = view.plantId;
  const [tab, setTab] = useState<Tab>('trend');
  const { data: summary } = useLocationSummary(plantId, selectedLocId);

  if (!selectedLocId) return null;

  const meta = summary?.meta;
  const recentLot = summary?.recent_lots?.[0];

  return (
    <div className="side-panel">
      {/* Header */}
      <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--stroke-soft)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">Functional location</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--valentia-slate)', marginTop: 2 }}>
              {selectedLocId}
            </div>
            {meta?.func_loc_name && (
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6, letterSpacing: '-0.005em' }}>
                {meta.func_loc_name}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
              {meta?.plant_id ?? ''}{meta?.floor_id ? ` · Floor ${meta.floor_id}` : ''}
            </div>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={() => setSelectedLocId(null)} title="Close">
            <IconX size={14} />
          </button>
        </div>
        {recentLot && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatusPill status={recentLot.status} />
          </div>
        )}
        {summary?.mics && summary.mics.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {summary.mics.map((m) => (
              <span key={m} className="chip" style={{ fontSize: 11, padding: '2px 8px', cursor: 'default' }}>{m}</span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '0 20px', borderBottom: '1px solid var(--stroke-soft)' }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '10px 12px', fontSize: 12,
              borderBottom: tab === t ? '2px solid var(--valentia-slate)' : '2px solid transparent',
              color: tab === t ? 'var(--valentia-slate)' : 'var(--fg-muted)',
              fontWeight: 500, textTransform: 'capitalize', marginBottom: -1,
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="scroll-y" style={{ flex: 1, padding: '16px 20px' }}>
        {tab === 'trend' && <TrendTab plantId={plantId} funcLocId={selectedLocId} />}
        {tab === 'lots'  && <LotsTab  plantId={plantId} funcLocId={selectedLocId} />}
      </div>
    </div>
  );
}
