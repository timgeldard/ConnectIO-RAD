import { useState } from 'react'
import { Icon } from '../ui/Icon'
import { shallowEqual, useSPCDispatch, useSPCSelector } from '../../spc/SPCContext'

interface SPCHeaderProps {
  dark?: boolean
  onToggleDark?: () => void
}

export function SPCHeader({ dark = false, onToggleDark }: SPCHeaderProps) {
  const dispatch = useSPCDispatch()
  const { globalSearch, savedViews, selectedMaterial, selectedMIC, dateFrom, dateTo, activeTab } =
    useSPCSelector(
      s => ({
        globalSearch: s.globalSearch,
        savedViews: s.savedViews,
        selectedMaterial: s.selectedMaterial,
        selectedMIC: s.selectedMIC,
        dateFrom: s.dateFrom,
        dateTo: s.dateTo,
        activeTab: s.activeTab,
      }),
      shallowEqual,
    )

  const [savedViewsOpen, setSavedViewsOpen] = useState(false)

  const handleSaveView = () => {
    const now = new Date()
    const label = selectedMaterial?.material_name ?? selectedMaterial?.material_id ?? 'SPC view'
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    dispatch({
      type: 'ADD_SAVED_VIEW',
      payload: {
        id: `view-${now.getTime()}`,
        name: `${label} ${time}`,
        savedAt: now.toISOString(),
        activeTab,
        globalSearch,
        selectedMaterial: selectedMaterial ?? null,
        selectedPlant: null,
        selectedMIC: selectedMIC ?? null,
        selectedMultivariateMicIds: [],
        processFlowUpstreamDepth: 4,
        processFlowDownstreamDepth: 3,
        dateFrom: dateFrom ?? '',
        dateTo: dateTo ?? '',
        stratifyBy: null,
      },
    })
  }

  const dateLabel = dateFrom && dateTo
    ? `${dateFrom.slice(5)} → ${dateTo.slice(5)}`
    : 'Last 12 months'

  return (
    <header
      aria-label="SPC Workspace"
      style={{
        height: 'var(--header-h)',
        borderBottom: '1px solid var(--line-1)',
        background: 'var(--surface-1)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 14,
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>
        <Icon name="home" size={13} />
        <Icon name="chevron-right" size={11} />
        <span>Quality · SPC Workspace</span>
      </div>

      {/* Search */}
      <div style={{ marginLeft: 16, flex: '0 1 400px', position: 'relative' }}>
        <Icon
          name="search"
          size={14}
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }}
        />
        <input
          type="search"
          value={globalSearch}
          onChange={e => dispatch({ type: 'SET_GLOBAL_SEARCH', payload: e.target.value })}
          placeholder="Search materials, characteristics, batches…"
          style={{
            width: '100%',
            height: 34,
            paddingLeft: 32,
            paddingRight: 48,
            border: '1px solid var(--line-2)',
            borderRadius: 8,
            background: 'var(--surface-0)',
            color: 'var(--text-1)',
            fontSize: 13,
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--valentia-slate)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--line-2)' }}
        />
        <span style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 10.5,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-3)',
          padding: '2px 6px',
          border: '1px solid var(--line-2)',
          borderRadius: 4,
          pointerEvents: 'none',
        }}>⌘ K</span>
      </div>

      {/* Actions */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.01em' }}
          aria-label="Date range"
        >
          <Icon name="calendar" size={13} />
          {dateLabel}
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--line-1)', margin: '0 2px' }} />

        <button
          className="icon-btn"
          title="Save current view"
          aria-label="Save current view"
          onClick={handleSaveView}
        >
          <Icon name="copy" size={15} />
        </button>

        <button
          className="icon-btn"
          title="Saved views"
          aria-label={`Saved views (${savedViews.length})`}
          aria-pressed={savedViewsOpen}
          onClick={() => setSavedViewsOpen(o => !o)}
        >
          <Icon name="eye" size={15} />
        </button>

        {onToggleDark && (
          <button
            className="icon-btn"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={onToggleDark}
          >
            <Icon name={dark ? 'sun' : 'moon'} size={15} />
          </button>
        )}

        <button className="btn btn-subtle btn-sm" aria-label="Export">
          <Icon name="download" size={13} />
          Export
        </button>
      </div>

      {/* Saved views popover */}
      {savedViewsOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 16,
            zIndex: 30,
            width: 320,
            background: 'var(--surface-1)',
            border: '1px solid var(--line-2)',
            borderRadius: 10,
            boxShadow: 'var(--shadow-pop)',
            padding: 16,
          }}
        >
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Saved Views</p>
          {savedViews.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
              No saved views yet. Click the copy icon to save the current scope.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {savedViews.map(view => (
                <button
                  key={view.id}
                  onClick={() => { dispatch({ type: 'APPLY_SAVED_VIEW', payload: view }); setSavedViewsOpen(false) }}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--line-1)',
                    background: 'var(--surface-2)',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: 'var(--text-1)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {view.name}
                </button>
              ))}
            </div>
          )}
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 12 }}
            onClick={() => setSavedViewsOpen(false)}
          >
            Close
          </button>
        </div>
      )}
    </header>
  )
}
