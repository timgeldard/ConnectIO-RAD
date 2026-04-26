import { useI18n } from '@connectio/shared-frontend-i18n';
import { useEM } from '~/context/EMContext';
import { useFloors } from '~/api/client';
import FilterBar from '~/components/controls/FilterBar';
import FloorPlan from '~/components/floorplan/FloorPlan';
import LocationPanel from '~/components/sidepanel/LocationPanel';
import type { PersonaId } from '~/types';

interface Props {
  plantId: string;
  floorId: string;
  personaId: PersonaId;
  onBack: () => void;
  onBackToSite: () => void;
  onChangeFloor: (floorId: string) => void;
}

export default function FloorView({ plantId, floorId, personaId, onBack, onBackToSite, onChangeFloor }: Props) {
  const { t } = useI18n();
  const { selectedLocId } = useEM();
  const { data: floors = [] } = useFloors(plantId);

  const currentFloor = floors.find((f) => f.floor_id === floorId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub-nav with breadcrumbs + floor switcher chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px', background: 'white', borderBottom: '1px solid var(--stroke-soft)' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>{t('envmon.site.back')}</button>
        <span style={{ color: 'var(--stroke)' }}>/</span>
        <button className="btn btn-ghost btn-sm" onClick={onBackToSite}>{plantId}</button>
        <span style={{ color: 'var(--stroke)' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{currentFloor?.floor_name ?? floorId}</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {floors.map((f) => (
            <button
              key={f.floor_id}
              className={`chip${f.floor_id === floorId ? ' active' : ''}`}
              style={{ fontSize: 11, padding: '3px 10px' }}
              onClick={() => onChangeFloor(f.floor_id)}
            >
              {f.floor_id}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar />

      {/* Floor plan area */}
      <div style={{ flex: 1, position: 'relative', background: '#FAFAF1', minHeight: 0 }}>
        <FloorPlan personaId={personaId} />
        {selectedLocId && <LocationPanel />}
      </div>
    </div>
  );
}
