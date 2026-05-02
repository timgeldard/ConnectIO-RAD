import { useI18n } from '@connectio/shared-frontend-i18n'
import { usePlantSelection } from '~/context/PlantContext'

/**
 * 40px context bar rendered in the PlatformShell contextBar slot.
 * Exposes a plant selector dropdown driven by PlantContext.
 */
export function PlantContextBar() {
  const { t } = useI18n()
  const { plants, selectedPlantId, setSelectedPlantId, loading } = usePlantSelection()

  return (
    <div
      className="connectio-ctx-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 16px',
        height: 40,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        fontSize: 12,
      }}
    >
      <label
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
        title={t('warehouse.plant.selector')}
      >
        <span style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
          {t('warehouse.plant.selector')}
        </span>
        <select
          aria-label={t('warehouse.plant.selector')}
          value={selectedPlantId}
          disabled={loading || plants.length < 2}
          onChange={(e) => setSelectedPlantId(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--fg)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            cursor: loading || plants.length < 2 ? 'default' : 'pointer',
          }}
        >
          {plants.map((plant) => (
            <option key={plant.plant_id} value={plant.plant_id}>
              {plant.plant_name && plant.plant_name !== plant.plant_id
                ? `${plant.plant_name} · ${plant.plant_id}`
                : plant.plant_id}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
