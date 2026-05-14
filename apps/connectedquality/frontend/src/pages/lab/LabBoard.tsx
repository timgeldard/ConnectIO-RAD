/* eslint-disable jsdoc/require-jsdoc */
import React, { useState, useEffect } from 'react'
import { Icon } from '@connectio/shared-ui'
import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '@connectio/shared-frontend-api'
import { usePlantSelection } from '@connectio/shared-app-context'

interface FailSpec {
  mat: string
  matNo: string
  lot: string
  batch: string
  line: string
  char: string
  text: string
  res: number
  lo: number
  hi: number
  units: string
  sev: 'fail' | 'warn'
  ts: string | null
  lotType: string
}

const PAGE_SIZE = 6

/** Lab Board — full-screen wallboard for quality lab. Auto-rotates inspection lot failures. */
export function LabBoard() {
  const [tick, setTick] = useState(24)
  const [page, setPage] = useState(0)
  const stamp = new Date().toLocaleString('en-GB', { hour12: false }).replace(',', ' ·')
  const params = new URLSearchParams(window.location.search)
  const urlPlantId = params.get('plant_id') ?? params.get('plant')
  const lotType = params.get('lot_type')

  const { plants, selectedPlantId, setSelectedPlantId, loading: plantsLoading, error: plantsError } = usePlantSelection()
  const plantId = selectedPlantId || null

  useEffect(() => {
    if (urlPlantId && urlPlantId !== selectedPlantId) {
      setSelectedPlantId(urlPlantId)
    }
  }, [urlPlantId]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading } = useQuery({
    queryKey: ['cq', 'lab', 'fails', plantId, lotType],
    enabled: Boolean(plantId),
    refetchInterval: 30_000,
    queryFn: () => fetchJson<{ fails: FailSpec[], data_available?: boolean, reason?: string }>(
      `/api/cq/lab/fails?plant_id=${encodeURIComponent(plantId as string)}${lotType ? `&lot_type=${encodeURIComponent(lotType)}` : ''}`
    ),
  })

  const fails = data?.fails || []
  const pages = Math.max(1, Math.ceil(fails.length / PAGE_SIZE))
  const visible = fails.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  useEffect(() => {
    const t = setInterval(() => {
      setTick((v) => {
        if (v <= 1) {
          setPage((p) => (p + 1) % pages)
          return 30
        }
        return v - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [pages])

  const goPrev = () => { setPage((p) => (p - 1 + pages) % pages); setTick(30) }
  const goNext = () => { setPage((p) => (p + 1) % pages); setTick(30) }

  const selectedPlant = plants.find(p => p.plant_id === selectedPlantId)
  const plantLabel = selectedPlant
    ? (selectedPlant.plant_name && selectedPlant.plant_name !== selectedPlant.plant_id
      ? `${selectedPlant.plant_name} · ${selectedPlant.plant_id}`
      : selectedPlant.plant_id)
    : (plantId ?? '')

  const plantSelectStyle: React.CSSProperties = {
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 4,
    padding: '2px 6px',
    color: 'inherit',
    cursor: 'pointer',
    maxWidth: 220,
  }

  return (
    <div className="lab-board">
      <header className="lab-head">
        <div className="lab-brand">
          <span className="title">CONNECTEDQUALITY · LAB BOARD</span>
        </div>
        <div className="lab-head-right">
          <button className="lab-iconbtn" title="Home"><Icon name="home" size={16} /></button>
          <div className="lab-avatar">SK</div>
        </div>
      </header>

      <div className="lab-ctx">
        <div className="lab-ctx-field">
          <span className="lbl">Plant</span>
          {urlPlantId ? (
            <span className="val">{plantLabel}</span>
          ) : plantsError ? (
            <span className="val" style={{ color: 'var(--status-risk)', fontSize: 11 }} title={plantsError}>⚠ plant load failed</span>
          ) : plantsLoading ? (
            <span className="val" style={{ opacity: 0.5 }}>loading…</span>
          ) : (
            <select
              value={selectedPlantId}
              onChange={e => setSelectedPlantId(e.target.value)}
              style={plantSelectStyle}
            >
              <option value="">— select —</option>
              {plants.map(p => (
                <option key={p.plant_id} value={p.plant_id}>
                  {p.plant_name && p.plant_name !== p.plant_id
                    ? `${p.plant_name} · ${p.plant_id}`
                    : p.plant_id}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="lab-ctx-field"><span className="lbl">Work centers</span><span className="val">All</span></div>
        <div className="lab-ctx-field"><span className="lbl">Inspection lot type</span><span className="val">{lotType ?? 'All'}</span></div>
        <div className="lab-ctx-field"><span className="lbl">Severity</span><span className="val">Fail · Warn</span></div>
        <div className="lab-ctx-field grow"><span className="lbl">Next refresh in</span><span className="val refresh">{tick} <span className="u">s</span></span></div>
        <div className="lab-ctx-field"><span className="lbl">Page</span><span className="val">{page + 1} / {pages}</span></div>
        <div className="lab-ctx-field"><span className="lbl">Open fails</span><span className="val crit">{fails.filter(f => f.sev === 'fail').length}</span></div>
        <button className="lab-iconbtn small"><Icon name="settings" size={14} /></button>
      </div>

      <div className="lab-grid-wrap">
        <button className="lab-arrow left" onClick={goPrev} title="Previous"><Icon name="chev" size={28} /></button>
        <div className="lab-grid">
          {!plantId ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gridColumn: '1 / -1', padding: '48px 0', color: 'var(--text-3)', textAlign: 'center' }}>
              <Icon name="flask" size={40} style={{ marginBottom: 16, opacity: 0.35 }} />
              <div style={{ fontSize: 15 }}>Select a plant above to view live lab inspection failures</div>
            </div>
          ) : isLoading ? (
            <div style={{ gridColumn: '1 / -1', padding: '48px 0', textAlign: 'center', color: 'var(--text-3)' }}>Loading lab data…</div>
          ) : data?.data_available === false ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gridColumn: '1 / -1', padding: '48px 0', color: 'var(--text-3)', textAlign: 'center' }}>
              <Icon name="clock" size={40} style={{ marginBottom: 16, opacity: 0.35 }} />
              <div style={{ fontSize: 15 }}>{data.reason ?? 'No published lab failure dataset yet for this plant'}</div>
            </div>
          ) : fails.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gridColumn: '1 / -1', padding: '48px 0', color: 'var(--text-3)', textAlign: 'center' }}>
              <Icon name="flask" size={40} style={{ marginBottom: 16, opacity: 0.35 }} />
              <div style={{ fontSize: 15 }}>No open lab fails for this plant</div>
            </div>
          ) : (
            visible.map((f) => <FailCard key={`${f.lot}-${f.char}`} f={f} />)
          )}
        </div>
        <button className="lab-arrow right" onClick={goNext} title="Next"><Icon name="chev" size={28} /></button>
      </div>

      <footer className="lab-foot">
        <span className="dot live" /> LIVE FROM SAP QM · {stamp}
        <span className="sep" />
        Auto-rotate every 30s · Click ‹ › to override
        <span style={{ flex: 1 }} />
        <span className="leg"><span className="d fail" /> Fail</span>
        <span className="leg"><span className="d warn" /> Warn</span>
        <span className="leg"><span className="d info" /> Auto-refresh</span>
      </footer>
    </div>
  )
}

function FailCard({ f }: { f: FailSpec }) {
  const ts = f.ts ? new Date(f.ts).toLocaleTimeString('en-GB', { hour12: false }) : '—'
  return (
    <article className={'fail-card ' + f.sev}>
      <div className="fc-head">
        <div className="ttl">{f.mat}</div>
        {f.lotType && <div className="lot-pill">{f.lotType}</div>}
      </div>
      <div className="fc-body">
        <Field label="Material Number" value={f.matNo} />
        <Field label="Inspection Lot" value={f.lot} />
        <Field label="Batch Number" value={f.batch} />
        <Field label="Process Line" value={f.line} />
        <Field label="Inspection Characteristic" value={f.char} />
        <Field label="Inspection Text" value={f.text} />
        {f.lo < f.hi && <ResultRow f={f} />}
      </div>
      <div className={'fc-foot ' + f.sev}>
        <span className="status-dot" />
        <span>{f.sev === 'fail' ? 'RESULT · FAIL' : 'RESULT · OUT OF WARNING'}</span>
        <span style={{ flex: 1 }} />
        <span className="ts">{ts}</span>
      </div>
    </article>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="fc-field">
      <span className="lbl">{label}</span>
      <span className="val">{value}</span>
    </label>
  )
}

function ResultRow({ f }: { f: FailSpec }) {
  const inSpec = f.res >= f.lo && f.res <= f.hi
  const span = f.hi - f.lo
  const pad = span * 0.6
  const min = f.lo - pad, max = f.hi + pad
  const pos = Math.max(0, Math.min(100, ((f.res - min) / (max - min)) * 100))
  const loPos = ((f.lo - min) / (max - min)) * 100
  const hiPos = ((f.hi - min) / (max - min)) * 100
  return (
    <div className="fc-result">
      <div className="row-top">
        <span className="lbl">Result</span>
        <span className={'val ' + (inSpec ? 'ok' : 'bad')}>
          {f.res.toFixed(f.res < 10 ? 4 : 2)}<span className="u"> {f.units}</span>
        </span>
        <span className="lbl right">Spec</span>
        <span className="val mono">{f.lo} – {f.hi}</span>
      </div>
      <div className="spec-bar">
        <div className="track" />
        <div className="band" style={{ left: `${loPos}%`, width: `${hiPos - loPos}%` }} />
        <div className={'marker ' + (inSpec ? 'ok' : 'bad')} style={{ left: `${pos}%` }} />
        <span className="tick" style={{ left: `${loPos}%` }}>{f.lo}</span>
        <span className="tick" style={{ left: `${hiPos}%` }}>{f.hi}</span>
      </div>
    </div>
  )
}
