import { useState, useEffect } from 'react'
import { Icon } from '~/components/Icon'
import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '@connectio/shared-frontend-api'

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
}

const PAGE_SIZE = 6

/** Lab Board — full-screen wallboard for quality lab. Auto-rotates inspection lot failures. */
export function LabBoard() {
  const [tick, setTick] = useState(24)
  const [page, setPage] = useState(0)
  const stamp = new Date().toLocaleString('en-GB', { hour12: false }).replace(',', ' ·')
  const params = new URLSearchParams(window.location.search)
  const plantId = params.get('plant_id') ?? params.get('plant')
  const lotType = params.get('lot_type')

  const { data, isLoading } = useQuery({
    queryKey: ['cq', 'lab', 'fails', plantId, lotType],
    enabled: Boolean(plantId),
    queryFn: () => fetchJson<{ fails: FailSpec[], data_available?: boolean, reason?: string }>(`/api/cq/lab/fails?plant_id=${encodeURIComponent(plantId as string)}${lotType ? `&lot_type=${encodeURIComponent(lotType)}` : ''}`),
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

  if (!plantId) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>Select a plant or open Lab Board with a plant deep link to view lab failures.</div>
  }

  if (isLoading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>Loading lab data…</div>
  }

  if (data?.data_available === false) {
    return (
      <div className="lab-board" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="clock" size={48} style={{ display: 'block', margin: '0 auto 24px', opacity: 0.5 }} />
        <h2 style={{ fontSize: 24, fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)', marginBottom: 12 }}>No lab failures available</h2>
        <p style={{ color: 'var(--text-3)', fontSize: 16 }}>{data.reason ?? 'The selected plant has no published lab failure dataset yet.'}</p>
      </div>
    )
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
        <div className="lab-ctx-field"><span className="lbl">Plant</span><span className="val">{plantId}</span></div>
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
          {visible.map((f, i) => <FailCard key={i} f={f} />)}
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
  return (
    <article className={'fail-card ' + f.sev}>
      <div className="fc-head">
        <div className="ttl">{f.mat}</div>
        <div className="lot-pill">04</div>
      </div>
      <div className="fc-body">
        <Field label="Material Number" value={f.matNo} />
        <Field label="Inspection Lot" value={f.lot} />
        <Field label="Batch Number" value={f.batch} />
        <Field label="Process Line" value={f.line} />
        <Field label="Inspection Characteristic" value={f.char} />
        <Field label="Inspection Text" value={f.text} />
        <ResultRow f={f} />
      </div>
      <div className={'fc-foot ' + f.sev}>
        <span className="status-dot" />
        <span>{f.sev === 'fail' ? 'RESULT · FAIL' : 'RESULT · OUT OF WARNING'}</span>
        <span style={{ flex: 1 }} />
        <span className="ts">{new Date(Date.now() - Math.random() * 3600000).toLocaleTimeString('en-GB', { hour12: false })}</span>
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
