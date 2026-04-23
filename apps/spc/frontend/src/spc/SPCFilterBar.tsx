import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { shallowEqual, useSPCDispatch, useSPCSelector } from './SPCContext'
import { Icon } from '../components/ui/Icon'
import FieldHelp from './components/FieldHelp'
import { useValidateMaterial } from './hooks/useMaterials'
import { usePlants } from './hooks/usePlants'
import { useCharacteristics } from './hooks/useCharacteristics'
import { getRecentMaterials, addRecentMaterial } from './hooks/useRecentMaterials'
import type { MaterialRef, MicRef, PlantRef, StratifyByKey } from './types'

const FILTER_COMMIT_DEBOUNCE_MS = 300
const MAX_VISIBLE_MIC_OPTIONS = 100

// ── Helpers ───────────────────────────────────────────────────────────────────

function serializeMicKey(mic: Pick<MicRef, 'mic_id' | 'operation_id'> | null | undefined): string {
  if (!mic) return ''
  return JSON.stringify({ mic_id: mic.mic_id, operation_id: mic.operation_id ?? null })
}

function multivariateSelectionKey(mic: Pick<MicRef, 'mic_id' | 'operation_id'> | null | undefined): string {
  if (!mic) return ''
  return `${mic.mic_id}||${mic.operation_id ?? 'NO_OP'}`
}

/** YYYY-MM-DD in local time — avoids toISOString UTC shift in negative-offset timezones */
function toLocalDateString(d: Date): string {
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Default date range: last 12 months from today */
function defaultDateRange(): { from: string; to: string } {
  const to   = new Date()
  const from = new Date(to)
  from.setFullYear(from.getFullYear() - 1)
  return { from: toLocalDateString(from), to: toLocalDateString(to) }
}

// ── Date presets ──────────────────────────────────────────────────────────────

type DatePreset = { label: string; days?: number; getRange?: () => { from: string; to: string } }

const DATE_PRESETS: DatePreset[] = [
  { label: '30d', days: 30  },
  { label: '90d', days: 90  },
  { label: '6m',  days: 183 },
  { label: '1y',  days: 365 },
  {
    label: 'YTD',
    getRange: () => {
      const now = new Date()
      return { from: toLocalDateString(new Date(now.getFullYear(), 0, 1)), to: toLocalDateString(now) }
    },
  },
]

function resolvePresetRange(preset: DatePreset): { from: string; to: string } {
  if (preset.getRange) return preset.getRange()
  const to   = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - preset.days!)
  return { from: toLocalDateString(from), to: toLocalDateString(to) }
}

// ── Chart type label helper ───────────────────────────────────────────────────

function chartTypeLabel(chartType: string | null | undefined): string {
  if (chartType === 'xbar_r')  return 'X̄-R chart'
  if (chartType === 'xbar_s')  return 'X̄-S chart'
  if (chartType === 'p_chart') return 'Attribute chart'
  return 'I-MR chart'
}

function formatMicLabel(mic: Pick<MicRef, 'mic_id' | 'mic_name' | 'operation_id' | 'chart_type' | 'batch_count'> | null | undefined): string {
  if (!mic) return ''
  const baseLabel = mic.mic_name || mic.mic_id || 'Unknown characteristic'
  const operationPart = mic.operation_id ? ` · Op ${mic.operation_id}` : ''
  const batchPart = mic.batch_count ? ` (${mic.batch_count} batches)` : ''
  const attributePrefix = mic.chart_type === 'p_chart' ? '[Attribute] ' : ''
  return `${attributePrefix}${baseLabel}${operationPart}${batchPart}`
}

// ── Stratify options ──────────────────────────────────────────────────────────

const STRATIFY_OPTIONS: Array<{ value: StratifyByKey; label: string }> = [
  { value: 'plant_id',          label: 'Plant'          },
  { value: 'inspection_lot_id', label: 'Inspection Lot' },
  { value: 'operation_id',      label: 'Operation'      },
]

const FLOW_DEPTH_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const depth = index + 1
  return { value: depth, label: `Depth ${depth}` }
})

// ── Props ─────────────────────────────────────────────────────────────────────

interface SPCFilterBarProps {
  embedded?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SPCFilterBar({ embedded = false }: SPCFilterBarProps) {
  const dispatch = useSPCDispatch()
  const state = useSPCSelector(
    current => ({
      selectedMaterial: current.selectedMaterial,
      selectedPlant: current.selectedPlant,
      selectedMIC: current.selectedMIC,
      selectedMultivariateMicIds: current.selectedMultivariateMicIds,
      processFlowUpstreamDepth: current.processFlowUpstreamDepth,
      processFlowDownstreamDepth: current.processFlowDownstreamDepth,
      dateFrom: current.dateFrom,
      dateTo: current.dateTo,
      stratifyBy: current.stratifyBy,
    }),
    shallowEqual,
  )
  const { validateMaterial, clearError, validating, error: validateError } = useValidateMaterial()
  const { plants, loading: plantsLoading }                                 = usePlants(state.selectedMaterial?.material_id)
  const { characteristics, attrCharacteristics, loading: charsLoading }   = useCharacteristics(
    state.selectedMaterial?.material_id,
    state.selectedPlant?.plant_id,
  )

  const [collapsed,   setCollapsed]   = useState(false)
  const [inputValue,  setInputValue]  = useState('')
  const [notFound,    setNotFound]    = useState(false)
  const [pendingPlantId, setPendingPlantId] = useState(() => state.selectedPlant?.plant_id ?? '')
  const [pendingDateFrom, setPendingDateFrom] = useState(() => state.dateFrom ?? '')
  const [pendingDateTo, setPendingDateTo] = useState(() => state.dateTo ?? '')
  const [micSearch, setMicSearch] = useState('')
  const [recents]                     = useState<MaterialRef[]>(() => getRecentMaterials())
  const prevMICRef                    = useRef<string | null>(null)
  const defaults                      = useMemo(() => defaultDateRange(), [])

  const allCharacteristics = useMemo(
    () =>
      [...characteristics, ...attrCharacteristics].sort((a, b) =>
        (a.mic_name || '').localeCompare(b.mic_name || ''),
      ),
    [characteristics, attrCharacteristics],
  )
  const quantitativeCharacteristics = useMemo(
    () =>
      [...characteristics].sort((a, b) =>
        (a.mic_name || '').localeCompare(b.mic_name || ''),
      ),
    [characteristics],
  )
  const selectedMultivariateSet = useMemo(
    () => new Set(state.selectedMultivariateMicIds),
    [state.selectedMultivariateMicIds],
  )

  const selectedMicValue = useMemo(() => serializeMicKey(state.selectedMIC), [state.selectedMIC])
  const filteredCharacteristics = useMemo(() => {
    const term = micSearch.trim().toLowerCase()
    if (!term) return allCharacteristics
    return allCharacteristics.filter(characteristic => {
      const label = formatMicLabel(characteristic).toLowerCase()
      const micId = String(characteristic.mic_id ?? '').toLowerCase()
      return label.includes(term) || micId.includes(term)
    })
  }, [allCharacteristics, micSearch])
  const visibleCharacteristics = useMemo(() => {
    if (!state.selectedMIC) {
      return filteredCharacteristics.slice(0, MAX_VISIBLE_MIC_OPTIONS)
    }
    const selectedKey = serializeMicKey(state.selectedMIC)
    const selectedCharacteristic =
      allCharacteristics.find(characteristic => serializeMicKey(characteristic) === selectedKey) ?? null
    const withoutSelected = filteredCharacteristics.filter(
      characteristic => serializeMicKey(characteristic) !== selectedKey,
    )
    const visible = withoutSelected.slice(0, Math.max(0, MAX_VISIBLE_MIC_OPTIONS - (selectedCharacteristic ? 1 : 0)))
    return selectedCharacteristic ? [selectedCharacteristic, ...visible] : visible
  }, [allCharacteristics, filteredCharacteristics, state.selectedMIC])

  useEffect(() => {
    setPendingPlantId(state.selectedPlant?.plant_id ?? '')
  }, [state.selectedPlant?.plant_id])

  useEffect(() => {
    setPendingDateFrom(state.dateFrom ?? '')
  }, [state.dateFrom])

  useEffect(() => {
    setPendingDateTo(state.dateTo ?? '')
  }, [state.dateTo])

  useEffect(() => {
    setMicSearch('')
  }, [state.selectedMaterial?.material_id, state.selectedPlant?.plant_id])

  // Auto-clear plant when it's no longer valid for the selected material
  useEffect(() => {
    if (plantsLoading || !state.selectedPlant) return
    const stillValid = plants.some(p => p.plant_id === state.selectedPlant?.plant_id)
    if (!stillValid) dispatch({ type: 'SET_PLANT', payload: null })
  }, [dispatch, plants, plantsLoading, state.selectedPlant])

  // Auto-select plant when exactly one is available
  useEffect(() => {
    if (plantsLoading || state.selectedPlant || plants.length !== 1) return
    dispatch({ type: 'SET_PLANT', payload: plants[0] as PlantRef })
  }, [dispatch, plants, plantsLoading, state.selectedPlant])

  // Auto-clear MIC when it's no longer valid for the current material / plant
  useEffect(() => {
    if (charsLoading || !state.selectedMIC) return
    const selected = state.selectedMIC
    const match = allCharacteristics.find(c => {
      if (selected.operation_id != null) {
        return c.mic_id === selected.mic_id && c.operation_id === selected.operation_id
      }
      // Fallback for old bookmarks/saved views without operation_id — match on mic_id + mic_name
      return c.mic_id === selected.mic_id && (c.mic_name ?? null) === (selected.mic_name ?? null)
    })
    if (match) {
      // Always dispatch with full resolved MIC — upgrades state that lacked operation_id
      if (
        match.operation_id !== selected.operation_id ||
        match.mic_name !== selected.mic_name ||
        match.chart_type !== selected.chart_type
      ) {
        dispatch({ type: 'SET_MIC', payload: match as MicRef })
      }
    } else {
      dispatch({ type: 'SET_MIC', payload: null })
    }
  }, [allCharacteristics, charsLoading, dispatch, state.selectedMIC])

  // Keep multivariate selections aligned with the current material / plant scope.
  useEffect(() => {
    if (charsLoading) return
    const validMicIds = new Set(quantitativeCharacteristics.map(characteristic => multivariateSelectionKey(characteristic)))
    const keysByMicId = quantitativeCharacteristics.reduce<Record<string, string[]>>((acc, characteristic) => {
      const key = multivariateSelectionKey(characteristic)
      acc[characteristic.mic_id] = [...(acc[characteristic.mic_id] ?? []), key]
      return acc
    }, {})
    const nextIds = Array.from(new Set(state.selectedMultivariateMicIds.flatMap(micId => {
      if (validMicIds.has(micId)) return [micId]
      const upgraded = keysByMicId[micId]
      return upgraded?.length === 1 ? upgraded : []
    })))
    if (nextIds.length !== state.selectedMultivariateMicIds.length) {
      dispatch({ type: 'SET_MULTIVARIATE_MIC_IDS', payload: nextIds })
    }
  }, [charsLoading, dispatch, quantitativeCharacteristics, state.selectedMultivariateMicIds])

  // Auto-collapse when a MIC is freshly selected
  useEffect(() => {
    const micId = state.selectedMIC?.mic_id ?? null
    if (micId && micId !== prevMICRef.current) setCollapsed(true)
    prevMICRef.current = micId
  }, [state.selectedMIC?.mic_id])

  useEffect(() => {
    if (pendingDateFrom === (state.dateFrom ?? '') && pendingDateTo === (state.dateTo ?? '')) return
    const timeoutId = window.setTimeout(() => {
      if (pendingDateFrom !== (state.dateFrom ?? '')) {
        dispatch({ type: 'SET_DATE_FROM', payload: pendingDateFrom })
      }
      if (pendingDateTo !== (state.dateTo ?? '')) {
        dispatch({ type: 'SET_DATE_TO', payload: pendingDateTo })
      }
    }, FILTER_COMMIT_DEBOUNCE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [dispatch, pendingDateFrom, pendingDateTo, state.dateFrom, state.dateTo])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleValidate = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    setNotFound(false)
    const result = await validateMaterial(trimmed)
    if (result?.valid) {
      const material: MaterialRef = {
        material_id:   result.material_id   ?? trimmed,
        material_name: result.material_name ?? null,
      }
      addRecentMaterial(material)
      dispatch({ type: 'SET_MATERIAL', payload: material })
    } else if (result && !result.valid) {
      setNotFound(true)
    }
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') void handleValidate()
  }

  const handlePlantChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextPlantId = event.target.value
    setPendingPlantId(nextPlantId)
    const plant = plants.find(candidate => candidate.plant_id === nextPlantId) ?? null
    dispatch({ type: 'SET_PLANT', payload: plant as PlantRef | null })
  }

  const handleMICChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (!event.target.value) { dispatch({ type: 'SET_MIC', payload: null }); return }
    const mic = allCharacteristics.find(c => serializeMicKey(c) === event.target.value) ?? null
    dispatch({ type: 'SET_MIC', payload: mic as MicRef | null })
  }

  const handleStratifyChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as StratifyByKey | ''
    dispatch({ type: 'SET_STRATIFY_BY', payload: value || null })
  }

  const handleMultivariateToggle = (micId: string, checked: boolean) => {
    const nextIds = checked
      ? [...state.selectedMultivariateMicIds, micId]
      : state.selectedMultivariateMicIds.filter(value => value !== micId)
    dispatch({ type: 'SET_MULTIVARIATE_MIC_IDS', payload: nextIds.slice(0, 8) })
  }

  const selectRecent = (material: MaterialRef) => {
    setInputValue(material.material_id)
    clearError()
    setNotFound(false)
    dispatch({ type: 'SET_MATERIAL', payload: material })
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const hasMaterialError = Boolean(validateError || notFound)
  const scopeReady       = Boolean(state.selectedMaterial)
  const timeReady        = Boolean(pendingDateFrom || pendingDateTo)
  const canCollapse      = Boolean(state.selectedMaterial && state.selectedMIC)

  // ── Shared styles ──────────────────────────────────────────────────────────

  const tile: CSSProperties = { background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 10, padding: '1rem' }
  const labelStyle: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)' }
  const helpStyle: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-3)' }

  const sectionLabelStyle: CSSProperties = {
    margin: '0 0 0.5rem',
    fontSize: '0.6875rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-3)',
  }

  // ── Collapsed summary bar ──────────────────────────────────────────────────

  if (canCollapse && collapsed) {
    const micLabel   = formatMicLabel(state.selectedMIC)
    const matLabel   = state.selectedMaterial?.material_name || state.selectedMaterial?.material_id || ''
    const plantPart  = state.selectedPlant ? ` · ${state.selectedPlant.plant_name || state.selectedPlant.plant_id}` : ''
    const depthPart  = ` · Lineage U${state.processFlowUpstreamDepth}/D${state.processFlowDownstreamDepth}`
    const datePart   = state.dateFrom && state.dateTo
      ? ` · ${state.dateFrom} → ${state.dateTo}`
      : state.dateFrom
        ? ` · From ${state.dateFrom}`
        : ''

    return (
      <div
        style={embedded ? undefined : {
          borderBottom: '1px solid var(--line-1)',
          background:   'var(--surface-1)',
          padding:      '0.5rem 1.5rem',
        }}
        aria-label="SPC analysis filters (collapsed)"
      >
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Edit analysis filters"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Icon name="filter" size={14} />
          <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{matLabel}</span>
          <span style={{ margin: '0 0.375rem', color: 'var(--line-2)' }}>·</span>
          <span>{micLabel}</span>
          {plantPart && <span style={{ color: 'var(--text-3)' }}>{plantPart}</span>}
          <span style={{ color: 'var(--text-3)' }}>{depthPart}</span>
          {datePart  && <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginLeft: '0.25rem' }}>{datePart}</span>}
          <span
            style={{
              marginLeft:   '0.75rem',
              padding:      '0 0.5rem',
              border:       '1px solid var(--line-1)',
              borderRadius: '2px',
              fontSize:     '0.6875rem',
              color:        'var(--text-3)',
            }}
          >
            Edit
          </span>
        </button>
      </div>
    )
  }

  // ── Expanded layout ────────────────────────────────────────────────────────

  const outerStyle: CSSProperties = embedded
    ? { display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(22rem, 1fr))' }
    : {
        display:             'grid',
        gap:                 '1rem',
        gridTemplateColumns: 'repeat(auto-fit, minmax(22rem, 1fr))',
        padding:             '1.25rem 1.5rem',
        borderBottom:        '1px solid var(--line-1)',
        background:          'var(--surface-1)',
      }

  // Computed helper text for MIC select
  const micHelperText = scopeReady && allCharacteristics.length === 0 && !charsLoading
    ? 'No characteristics found — try a different plant.'
    : micSearch.trim() && filteredCharacteristics.length === 0
      ? 'No characteristics match this search. Try a broader term or clear the filter.'
      : filteredCharacteristics.length > MAX_VISIBLE_MIC_OPTIONS
        ? `Showing first ${MAX_VISIBLE_MIC_OPTIONS} of ${filteredCharacteristics.length} matches. Refine the search to narrow the list.`
        : state.selectedMIC?.inspection_method
          ? `Method: ${state.selectedMIC.inspection_method}`
          : 'Select a characteristic to load control chart and capability data.'

  return (
    <div style={outerStyle} aria-label="SPC analysis filters">

      {/* ── Left: filter steps (Material, Plant, MIC, Stratify) ─────────── */}
      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))' }}>

        {/* Material */}
        <div style={tile}>
          <p style={sectionLabelStyle}>Material</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="spc-material" style={labelStyle}>Material ID</label>
              <input
                id="spc-material"
                className="field"
                placeholder="Enter material ID"
                value={inputValue}
                onChange={e => { setInputValue(e.target.value); setNotFound(false); clearError() }}
                onKeyDown={handleKeyDown}
                disabled={validating}
                aria-invalid={hasMaterialError}
                style={hasMaterialError ? { borderColor: 'var(--status-risk)' } : undefined}
              />
              {hasMaterialError ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--status-risk)' }}>
                  {validateError || 'Material not found — check the ID and try again.'}
                </span>
              ) : (
                <span style={helpStyle}>
                  {state.selectedMaterial && !hasMaterialError
                    ? `Validated: ${state.selectedMaterial.material_name || state.selectedMaterial.material_id}`
                    : 'Press Enter or Validate to confirm.'}
                </span>
              )}
            </div>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => void handleValidate()}
              disabled={validating || !inputValue.trim()}
            >
              {validating ? 'Validating…' : 'Validate'}
            </button>

            {/* Recent material chips */}
            {!state.selectedMaterial && recents.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {recents.map(material => (
                  <button
                    key={material.material_id}
                    type="button"
                    onClick={() => selectRecent(material)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    aria-label={`Use recent material ${material.material_name || material.material_id}`}
                  >
                    <span className="chip">{material.material_name || material.material_id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Plant */}
        <div style={tile}>
          <p style={sectionLabelStyle}>Plant</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="spc-plant" style={labelStyle}>Plant</label>
            <select
              id="spc-plant"
              className="field"
              value={pendingPlantId}
              onChange={handlePlantChange}
              disabled={!scopeReady || plantsLoading}
            >
              <option value="">
                {!scopeReady     ? '— Validate material first —'
                : plantsLoading  ? 'Loading…'
                : plants.length > 1 ? '— All plants —'
                : plants.length === 1 ? '— Select plant —'
                : 'No plant data'}
              </option>
              {plants.map(plant => (
                <option key={plant.plant_id} value={plant.plant_id}>{plant.plant_name || plant.plant_id}</option>
              ))}
            </select>
            <span style={helpStyle}>
              {scopeReady && plants.length === 0 && !plantsLoading
                ? 'No plant data found for this material — scorecard and charts will be empty.'
                : 'Leave broad for portfolio review; narrow to a specific plant for local diagnosis.'}
            </span>
          </div>
        </div>

        {/* Characteristic (MIC) */}
        <div style={tile}>
          <p style={sectionLabelStyle}>Characteristic</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="spc-mic-search" style={labelStyle}>Filter characteristics</label>
              <input
                type="search"
                id="spc-mic-search"
                className="field"
                placeholder="Search MIC name or code"
                value={micSearch}
                onChange={event => setMicSearch(event.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="spc-mic" style={labelStyle}>Characteristic (MIC)</label>
              <select
                id="spc-mic"
                className="field"
                value={selectedMicValue}
                onChange={handleMICChange}
                disabled={!scopeReady || charsLoading}
              >
                <option value="">
                  {!scopeReady          ? '— Validate material first —'
                  : charsLoading        ? 'Loading…'
                  : allCharacteristics.length === 0 ? 'No characteristics found'
                  : micSearch.trim() && filteredCharacteristics.length === 0 ? 'No matching characteristics'
                  : '— Select a characteristic —'}
                </option>
                {visibleCharacteristics.map(c => (
                  <option key={`${c.operation_id ?? ''}|${c.mic_id}`} value={serializeMicKey(c)}>
                    {formatMicLabel(c)}
                  </option>
                ))}
              </select>
              <span style={helpStyle}>{micHelperText}</span>
            </div>
          </div>
        </div>

        {/* Stratify By (conditional) */}
        {state.selectedMaterial && (
          <div style={tile}>
            <p style={sectionLabelStyle}>Stratification</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="spc-stratify-by" style={labelStyle}>Stratify By</label>
              <select
                id="spc-stratify-by"
                className="field"
                value={state.stratifyBy ?? ''}
                onChange={handleStratifyChange}
              >
                <option value="">— None —</option>
                {STRATIFY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <span style={helpStyle}>Splits the chart into separate series to expose hidden between-group variation.</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Date window + Analysis posture ───────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

        {/* Date window */}
        <div style={tile}>
          <p style={sectionLabelStyle}>Date window</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Preset quick-select buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {DATE_PRESETS.map(preset => {
                const range    = resolvePresetRange(preset)
                const isActive = pendingDateFrom === range.from && pendingDateTo === range.to
                return (
                  <button
                    key={preset.label}
                    type="button"
                    className={isActive ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                    onClick={() => {
                      setPendingDateFrom(range.from)
                      setPendingDateTo(range.to)
                    }}
                    aria-pressed={isActive}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>

            {/* From / To date inputs */}
            <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="spc-date-from" style={labelStyle}>From</label>
                <input
                  type="date"
                  id="spc-date-from"
                  className="field"
                  value={pendingDateFrom}
                  onChange={(e) => setPendingDateFrom(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="spc-date-to" style={labelStyle}>To</label>
                <input
                  type="date"
                  id="spc-date-to"
                  className="field"
                  value={pendingDateTo}
                  onChange={(e) => setPendingDateTo(e.target.value)}
                />
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-3)' }}>
              {!timeReady
                ? `Default: last 12 months (${defaults.from} to ${defaults.to}). Narrow the window to isolate a specific investigation period.`
                : 'Custom date window active — capability and rule calculations apply to this period only.'}
            </p>
          </div>
        </div>

        {/* Analysis posture (conditional on material selection) */}
        {state.selectedMaterial && (
          <div style={tile}>
            <p style={sectionLabelStyle}>Analysis posture</p>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-3)' }} aria-live="polite">
              Choose the scope first, then interpret capability and rule signals in the chart workspace.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              {state.selectedMIC && (
                <span className={state.selectedMIC.chart_type === 'p_chart' ? 'chip' : 'chip chip-info'}>
                  {chartTypeLabel(state.selectedMIC.chart_type)}
                </span>
              )}
              {state.stratifyBy && (
                <span className="chip chip-info">
                  Stratified by{' '}
                  {STRATIFY_OPTIONS.find(o => o.value === state.stratifyBy)?.label ?? state.stratifyBy}
                </span>
              )}
              {!state.selectedMIC && !state.stratifyBy && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>
                  Select a characteristic above to see posture.
                </span>
              )}
            </div>
          </div>
        )}

        {state.selectedMaterial && (
          <div style={tile}>
            <p style={sectionLabelStyle}>Lineage depth</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="spc-flow-upstream-depth" style={labelStyle}>Upstream search</label>
                  <select
                    id="spc-flow-upstream-depth"
                    className="field"
                    value={String(state.processFlowUpstreamDepth)}
                    onChange={event =>
                      dispatch({ type: 'SET_PROCESS_FLOW_UPSTREAM_DEPTH', payload: Number(event.target.value) })
                    }
                  >
                    {FLOW_DEPTH_OPTIONS.map(option => (
                      <option key={`up-${option.value}`} value={String(option.value)}>{option.label}</option>
                    ))}
                  </select>
                  <span style={helpStyle}>Use a higher depth to inspect more parent generations when tracing likely root causes.</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="spc-flow-downstream-depth" style={labelStyle}>Downstream search</label>
                  <select
                    id="spc-flow-downstream-depth"
                    className="field"
                    value={String(state.processFlowDownstreamDepth)}
                    onChange={event =>
                      dispatch({ type: 'SET_PROCESS_FLOW_DOWNSTREAM_DEPTH', payload: Number(event.target.value) })
                    }
                  >
                    {FLOW_DEPTH_OPTIONS.map(option => (
                      <option key={`down-${option.value}`} value={String(option.value)}>{option.label}</option>
                    ))}
                  </select>
                  <span style={helpStyle}>Use a higher depth to inspect more downstream consumption generations when assessing impact.</span>
                </div>
              </div>

              <FieldHelp>
                Use deeper searches for complex formulations or aerospace-style nested assemblies. Larger scopes can increase lineage-query cost, so keep the default unless the investigation warrants it.
              </FieldHelp>
            </div>
          </div>
        )}

        {state.selectedMaterial && (
          <div style={tile}>
            <p style={sectionLabelStyle}>Multivariate variables</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-3)' }}>
                Choose 2 to 8 quantitative characteristics to run Hotelling&apos;s T², correlation heatmaps, and root-cause contribution analysis.
              </p>

              {state.selectedMultivariateMicIds.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {quantitativeCharacteristics
                    .filter(characteristic => selectedMultivariateSet.has(multivariateSelectionKey(characteristic)))
                    .map(characteristic => (
                      <span key={multivariateSelectionKey(characteristic)} className="chip chip-info">
                        {formatMicLabel(characteristic)}
                      </span>
                    ))}
                </div>
              )}

              <FieldHelp>
                Selected {state.selectedMultivariateMicIds.length}/8. Shared-batch analysis drops incomplete batches, so choose variables that are measured together in practice.
              </FieldHelp>

              <div
                style={{
                  display: 'grid',
                  gap: '0.5rem',
                  maxHeight: '14rem',
                  overflowY: 'auto',
                  paddingRight: '0.25rem',
                }}
              >
                {quantitativeCharacteristics.length === 0 && !charsLoading && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>
                    No quantitative characteristics are available for multivariate analysis in this scope.
                  </span>
                )}
                {quantitativeCharacteristics.map(characteristic => {
                  const selectionKey = multivariateSelectionKey(characteristic)
                  const checked = selectedMultivariateSet.has(selectionKey)
                  const disableUnchecked =
                    !checked && state.selectedMultivariateMicIds.length >= 8
                  const disabled = charsLoading || disableUnchecked
                  return (
                    <label
                      key={selectionKey}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.875rem',
                        color: 'var(--text-1)',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.5 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        id={`spc-multivariate-${selectionKey}`}
                        checked={checked}
                        disabled={disabled}
                        onChange={(e) => handleMultivariateToggle(selectionKey, e.target.checked)}
                        style={{ width: 14, height: 14, accentColor: 'var(--valentia-slate)', flexShrink: 0 }}
                      />
                      {formatMicLabel(characteristic)}
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Expand/collapse control — only shown when collapsible */}
        {canCollapse && (
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => setCollapsed(true)}
            style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Icon name="sliders" size={14} />
            Collapse filters
          </button>
        )}
      </div>

    </div>
  )
}
