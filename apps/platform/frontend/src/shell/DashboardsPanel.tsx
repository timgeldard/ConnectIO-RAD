/**
 * DashboardsPanel — in-shell composable dashboard browser and viewer.
 *
 * Renders within ModuleContentPanel when moduleId === 'dashboards'.
 * Shows a list of all visible dashboards; clicking one opens ComposableDashboard
 * for full view/edit. A "New Dashboard" button creates an empty dashboard and
 * navigates directly into it. The Share button opens an inline dialog for
 * granting or revoking explicit view access to other users.
 */
import type { CSSProperties } from 'react'
import { useCallback, useState } from 'react'
import {
  useDashboardList,
  useCreateDashboard,
  useDashboardShares,
  useShareDashboard,
  useUnshareDashboard,
  ComposableDashboard,
  createDefaultReportingRegistry,
} from '@connectio/shared-reporting'
import type { DashboardSummary } from '@connectio/shared-reporting'

const REGISTRY = createDefaultReportingRegistry()

const WIDGET_DEFS = [
  {
    type: 'kpi',
    label: 'KPI Card',
    description: 'Key performance indicator tile',
    defaultLayout: { w: 3, h: 3 },
    defaultProps: { label: 'Metric', value: '—' },
  },
  {
    type: 'trend',
    label: 'Trend Chart',
    description: 'Time-series trend line',
    defaultLayout: { w: 6, h: 4 },
  },
  {
    type: 'bar',
    label: 'Bar Chart',
    description: 'Categorical bar chart',
    defaultLayout: { w: 6, h: 4 },
  },
  {
    type: 'pareto',
    label: 'Pareto Chart',
    description: 'Pareto analysis with cumulative line',
    defaultLayout: { w: 6, h: 5 },
  },
  {
    type: 'spc-control',
    label: 'SPC Control Chart',
    description: 'Statistical process control chart',
    defaultLayout: { w: 8, h: 5 },
  },
  {
    type: 'drill-down-table',
    label: 'Drilldown Table',
    description: 'Interactive data table with drill-through',
    defaultLayout: { w: 8, h: 6 },
  },
]

/** Top-level dashboards panel: list → view/edit navigation. */
export function DashboardsPanel() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handleBack = useCallback(() => setSelectedId(null), [])

  if (selectedId) {
    return (
      <div style={fullHeightStyle}>
        <button style={backButtonStyle} onClick={handleBack} aria-label="Back to dashboard list">
          ← All dashboards
        </button>
        <div style={composableWrapStyle}>
          <ComposableDashboard
            dashboardId={selectedId}
            registry={REGISTRY}
            widgetDefinitions={WIDGET_DEFS}
            onSaved={(detail) => setSelectedId(detail.id)}
            canEdit
          />
        </div>
      </div>
    )
  }

  return (
    <DashboardListView onSelect={setSelectedId} />
  )
}

// ── List view ─────────────────────────────────────────────────────────────────

interface DashboardListViewProps {
  onSelect: (id: string) => void
}

function DashboardListView({ onSelect }: DashboardListViewProps) {
  const { data: dashboards, isPending, isError, refetch } = useDashboardList()
  const { mutateAsync: createDashboard, isPending: isCreating } = useCreateDashboard()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [sharingDashboard, setSharingDashboard] = useState<DashboardSummary | null>(null)

  const handleCreate = useCallback(async () => {
    const title = createTitle.trim()
    if (!title) return
    const created = await createDashboard({ title })
    setShowCreateForm(false)
    setCreateTitle('')
    onSelect(created.id)
  }, [createTitle, createDashboard, onSelect])

  const handleShare = useCallback((dashboard: DashboardSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    setSharingDashboard(dashboard)
  }, [])

  return (
    <>
      <div style={listPanelStyle}>
        <header style={listHeaderStyle}>
          <div>
            <div style={listTitleStyle}>Dashboards</div>
            <div style={listSubtitleStyle}>Build and share composable analytics dashboards</div>
          </div>
          {!showCreateForm && (
            <button
              style={primaryButtonStyle}
              onClick={() => setShowCreateForm(true)}
              aria-label="Create new dashboard"
            >
              + New Dashboard
            </button>
          )}
        </header>

        {showCreateForm && (
          <div style={createFormStyle}>
            <input
              type="text"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              placeholder="Dashboard name…"
              style={createInputStyle}
              autoFocus
              aria-label="New dashboard title"
            />
            <button
              style={primaryButtonStyle}
              onClick={handleCreate}
              disabled={isCreating || !createTitle.trim()}
            >
              {isCreating ? 'Creating…' : 'Create'}
            </button>
            <button
              style={ghostButtonStyle}
              onClick={() => { setShowCreateForm(false); setCreateTitle('') }}
            >
              Cancel
            </button>
          </div>
        )}

        {isPending && (
          <div style={stateMessageStyle}>Loading dashboards…</div>
        )}

        {isError && (
          <div style={errorMessageStyle}>
            Failed to load dashboards.{' '}
            <button style={retryLinkStyle} onClick={() => refetch()}>Retry</button>
          </div>
        )}

        {!isPending && !isError && (!dashboards || dashboards.length === 0) && (
          <div style={emptyStateStyle}>
            <div style={emptyIconStyle}>▦</div>
            <div style={emptyTitleStyle}>No dashboards yet</div>
            <div style={emptyDescStyle}>Create your first dashboard to get started.</div>
          </div>
        )}

        {dashboards && dashboards.length > 0 && (
          <ul style={cardGridStyle} aria-label="Dashboard list">
            {dashboards.map((d) => (
              <DashboardCard key={d.id} dashboard={d} onSelect={onSelect} onShare={handleShare} />
            ))}
          </ul>
        )}
      </div>

      {sharingDashboard && (
        <ShareDialog
          dashboard={sharingDashboard}
          onClose={() => setSharingDashboard(null)}
        />
      )}
    </>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

function DashboardCard({
  dashboard,
  onSelect,
  onShare,
}: {
  dashboard: DashboardSummary
  onSelect: (id: string) => void
  onShare: (dashboard: DashboardSummary, e: React.MouseEvent) => void
}) {
  const updatedDate = new Date(dashboard.updatedAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <li>
      <button
        style={cardStyle}
        onClick={() => onSelect(dashboard.id)}
        aria-label={`Open dashboard: ${dashboard.title}`}
      >
        <div style={cardTitleStyle}>{dashboard.title}</div>
        {dashboard.description && (
          <div style={cardDescStyle}>{dashboard.description}</div>
        )}
        <div style={cardMetaStyle}>
          <span>{dashboard.ownerEmail}</span>
          <span>v{dashboard.version} · Updated {updatedDate}</span>
        </div>
        {dashboard.tags.length > 0 && (
          <div style={tagRowStyle}>
            {dashboard.tags.map((t) => (
              <span key={t} style={tagStyle}>{t}</span>
            ))}
          </div>
        )}
        <div style={cardActionsStyle}>
          <button
            style={shareButtonStyle}
            onClick={(e) => onShare(dashboard, e)}
            aria-label={`Manage sharing for ${dashboard.title}`}
          >
            Share
          </button>
        </div>
      </button>
    </li>
  )
}

// ── Share dialog ──────────────────────────────────────────────────────────────

function ShareDialog({
  dashboard,
  onClose,
}: {
  dashboard: DashboardSummary
  onClose: () => void
}) {
  const { data, isPending, isError } = useDashboardShares(dashboard.id)
  const { mutate: shareDashboard, isPending: isSharing, error: shareError } = useShareDashboard()
  const { mutate: unshareDashboard, isPending: isUnsharing } = useUnshareDashboard()

  const [emailInput, setEmailInput] = useState('')

  const handleAdd = useCallback(() => {
    const email = emailInput.trim()
    if (!email) return
    shareDashboard(
      { dashboardId: dashboard.id, email },
      { onSuccess: () => setEmailInput('') },
    )
  }, [emailInput, dashboard.id, shareDashboard])

  const handleRemove = useCallback((email: string) => {
    unshareDashboard({ dashboardId: dashboard.id, email })
  }, [dashboard.id, unshareDashboard])

  const shares = data?.shares ?? []
  const notOwner = shareError instanceof Error && shareError.message.includes('404')

  return (
    <>
      <div style={backdropStyle} onClick={onClose} aria-hidden />
      <div style={dialogStyle} role="dialog" aria-modal aria-label={`Share: ${dashboard.title}`}>
        <div style={dialogHeaderStyle}>
          <span style={dialogTitleStyle}>Share: {dashboard.title}</span>
          <button style={closeButtonStyle} onClick={onClose} aria-label="Close share dialog">✕</button>
        </div>

        <div style={dialogBodyStyle}>
          {isPending && <div style={stateMessageStyle}>Loading shares…</div>}
          {isError && <div style={errorMessageStyle}>Could not load shares.</div>}

          {!isPending && !isError && (
            <>
              {shares.length === 0 && (
                <div style={emptySharesStyle}>Not shared with anyone yet.</div>
              )}
              {shares.length > 0 && (
                <ul style={shareListStyle} aria-label="People with access">
                  {shares.map((s) => (
                    <li key={s.sharedWithEmail} style={shareRowStyle}>
                      <span style={shareEmailStyle}>{s.sharedWithEmail}</span>
                      <button
                        style={removeButtonStyle}
                        onClick={() => handleRemove(s.sharedWithEmail)}
                        disabled={isUnsharing}
                        aria-label={`Remove access for ${s.sharedWithEmail}`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {notOwner ? (
                <div style={warningStyle}>Only the owner can manage shares.</div>
              ) : (
                <div style={addRowStyle}>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
                    placeholder="Email address…"
                    style={createInputStyle}
                    autoFocus
                    aria-label="Email to share with"
                  />
                  <button
                    style={primaryButtonStyle}
                    onClick={handleAdd}
                    disabled={isSharing || !emailInput.trim()}
                  >
                    {isSharing ? 'Adding…' : 'Add'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const fullHeightStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
}

const backButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-3)',
  cursor: 'pointer',
  fontSize: 12,
  padding: '8px 16px',
  textAlign: 'left',
  flexShrink: 0,
  fontFamily: 'var(--font-condensed, "Noto Sans Condensed", sans-serif)',
  letterSpacing: '0.04em',
}

const composableWrapStyle: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
}

const listPanelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'auto',
  background: 'var(--surface-0)',
  color: 'var(--text-1)',
  padding: '24px 32px',
  gap: 24,
}

const listHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
}

const listTitleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  fontFamily: 'var(--font-condensed, "Noto Sans Condensed", sans-serif)',
  color: 'var(--text-1)',
}

const listSubtitleStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--text-3)',
  marginTop: 2,
}

const primaryButtonStyle: CSSProperties = {
  background: 'var(--status-info)',
  border: 'none',
  color: '#fff',
  padding: '8px 16px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: 'nowrap',
}

const ghostButtonStyle: CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
  color: 'var(--text-2)',
  padding: '8px 14px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
}

const createFormStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  background: 'var(--surface-1)',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
  borderRadius: 6,
  padding: '12px 16px',
}

const createInputStyle: CSSProperties = {
  flex: 1,
  background: 'var(--surface-2)',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
  color: 'var(--text-1)',
  padding: '7px 10px',
  borderRadius: 4,
  fontSize: 13,
}

const stateMessageStyle: CSSProperties = {
  color: 'var(--text-3)',
  fontSize: 13,
}

const errorMessageStyle: CSSProperties = {
  color: 'var(--status-risk)',
  fontSize: 13,
}

const retryLinkStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--status-info)',
  cursor: 'pointer',
  padding: 0,
  fontSize: 13,
  textDecoration: 'underline',
}

const emptyStateStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '80px 0',
  color: 'var(--text-4)',
}

const emptyIconStyle: CSSProperties = {
  fontSize: 36,
  marginBottom: 8,
}

const emptyTitleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--text-3)',
}

const emptyDescStyle: CSSProperties = {
  fontSize: 13,
}

const cardGridStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: 16,
}

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  background: 'var(--surface-1)',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
  borderRadius: 8,
  padding: '16px 18px',
  cursor: 'pointer',
  textAlign: 'left',
  color: 'var(--text-1)',
  width: '100%',
  transition: 'border-color 0.12s',
}

const cardTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  fontFamily: 'var(--font-condensed, "Noto Sans Condensed", sans-serif)',
}

const cardDescStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-3)',
  lineHeight: 1.4,
  maxHeight: '2.8em',
  overflow: 'hidden',
}

const cardMetaStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 11,
  color: 'var(--text-4)',
  marginTop: 4,
  gap: 8,
}

const tagRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  marginTop: 4,
}

const tagStyle: CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
  borderRadius: 3,
  padding: '1px 6px',
  fontSize: 10,
  color: 'var(--text-3)',
  fontFamily: 'var(--font-condensed, "Noto Sans Condensed", sans-serif)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const cardActionsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: 6,
}

const shareButtonStyle: CSSProperties = {
  background: 'none',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
  borderRadius: 3,
  color: 'var(--text-3)',
  cursor: 'pointer',
  fontSize: 11,
  padding: '3px 10px',
  letterSpacing: '0.04em',
}

// ── Share dialog styles ───────────────────────────────────────────────────────

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  zIndex: 400,
}

const dialogStyle: CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 401,
  background: 'var(--surface-1)',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
  borderRadius: 8,
  width: 440,
  maxWidth: 'calc(100vw - 48px)',
  maxHeight: 'calc(100vh - 80px)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
}

const dialogHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
  flexShrink: 0,
}

const dialogTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text-1)',
  fontFamily: 'var(--font-condensed, "Noto Sans Condensed", sans-serif)',
}

const closeButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-3)',
  cursor: 'pointer',
  fontSize: 14,
  padding: '2px 6px',
}

const dialogBodyStyle: CSSProperties = {
  padding: '16px 20px',
  overflow: 'auto',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const emptySharesStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--text-3)',
  textAlign: 'center',
  padding: '12px 0',
}

const shareListStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const shareRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '6px 10px',
  background: 'var(--surface-2)',
  borderRadius: 4,
}

const shareEmailStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--text-1)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const removeButtonStyle: CSSProperties = {
  background: 'none',
  border: '1px solid var(--status-risk, #e05)',
  borderRadius: 3,
  color: 'var(--status-risk, #e05)',
  cursor: 'pointer',
  fontSize: 11,
  padding: '2px 8px',
  flexShrink: 0,
}

const addRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  marginTop: 4,
}

const warningStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-3)',
  padding: '8px 0',
}
