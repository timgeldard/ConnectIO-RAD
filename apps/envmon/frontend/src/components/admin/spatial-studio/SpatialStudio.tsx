/**
 * SpatialStudio — top-level page for the Spatial Studio admin tool.
 *
 * Reads the current plant from {@link useEM} and fetches the floor list.
 * When no plant is selected the user is prompted to select one first.
 * When no floor is selected a floor-picker grid is shown.
 * Once a floor is chosen {@link StudioShell} is rendered.
 */

import { useState } from 'react';
import { useI18n } from '@connectio/shared-frontend-i18n';
import { useEM } from '~/context/EMContext';
import { useFloors } from '~/api/client';
import StudioShell from './StudioShell';
import type { FloorInfo } from '~/types';

/** Spatial Studio page — floor selector + authoring shell. */
export default function SpatialStudio() {
  const { t } = useI18n();
  const { view } = useEM();
  const plantId = view.plantId;

  const { data: floors = [], isLoading } = useFloors(plantId);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);

  if (!plantId) {
    return (
      <div style={centreStyle}>
        <div style={promptStyle}>{t('envmon.studio.selectPlant')}</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={centreStyle}>
        <div style={promptStyle}>{t('envmon.studio.loadingFloors')}</div>
      </div>
    );
  }

  if (floors.length === 0) {
    return (
      <div style={centreStyle}>
        <div style={promptStyle}>{t('envmon.studio.noFloors')}</div>
      </div>
    );
  }

  if (!selectedFloorId) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 16 }}>
          {t('envmon.studio.selectFloor')}
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}
          data-testid="floor-selector"
        >
          {floors.map((floor: FloorInfo) => (
            <button
              key={floor.floor_id}
              onClick={() => setSelectedFloorId(floor.floor_id)}
              style={{
                padding: '16px 20px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--surface)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)', marginBottom: 4 }}>
                {floor.floor_name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {floor.location_count} locations
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const selectedFloor = floors.find((f: FloorInfo) => f.floor_id === selectedFloorId)!;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Back-to-floors strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
        }}
      >
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setSelectedFloorId(null)}
          style={{ fontSize: 12 }}
          aria-label="Back to floor selector"
        >
          {t('envmon.studio.backToFloors')}
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
          {selectedFloor?.floor_name ?? selectedFloorId}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('envmon.studio.label')}</span>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <StudioShell plantId={plantId} floorId={selectedFloorId} floor={selectedFloor} />
      </div>
    </div>
  );
}

const centreStyle: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const promptStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-3)',
  textAlign: 'center',
  maxWidth: 320,
  lineHeight: 1.5,
};
