/* eslint-disable jsdoc/require-jsdoc */
import React from 'react'
import { useI18n } from '@connectio/shared-frontend-i18n'
import { usePlantSelection } from './index'

/**
 * Props for the shared PlantContextBar component.
 */
export interface PlantContextBarProps {
  /** Optional custom label for the selector. Defaults to shared.plant.selector. */
  label?: string
  /** Optional custom style for the container. */
  style?: React.CSSProperties
}

/**
 * 40px context bar typically rendered in the PlatformShell contextBar slot.
 * Exposes a plant selector dropdown driven by PlantContext.
 */
export function PlantContextBar({ label, style }: PlantContextBarProps) {
  const { t } = useI18n()
  const { plants, selectedPlantId, setSelectedPlantId, loading, error } = usePlantSelection()

  const displayLabel = label ?? t('shared.plant.selector')

  return (
    <div
      data-testid="topbar-plant-selector"
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
        ...style,
      }}
    >
      <label
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
        title={displayLabel}
      >
        <span style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
          {displayLabel}
        </span>
        <select
          data-testid="plant-selector-dropdown"
          aria-label={displayLabel}
          value={selectedPlantId}
          disabled={loading || plants.length === 0}
          onChange={(e) => setSelectedPlantId(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--fg)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            cursor: loading || plants.length === 0 ? 'default' : 'pointer',
          }}
        >
          {plants.length === 0 && (
            <option value="">
              {loading ? t('shared.plant.loading') : t('shared.plant.none')}
            </option>
          )}
          {plants.map((plant) => (
            <option key={plant.plant_id} value={plant.plant_id} data-plant-id={plant.plant_id}>
              {plant.plant_name && plant.plant_name !== plant.plant_id
                ? `${plant.plant_name} · ${plant.plant_id}`
                : plant.plant_id}
            </option>
          ))}
        </select>
      </label>
      {error && <span style={{ color: 'var(--status-risk)', fontSize: 11 }}>{t('shared.plant.unavailable')}</span>}
    </div>
  )
}
