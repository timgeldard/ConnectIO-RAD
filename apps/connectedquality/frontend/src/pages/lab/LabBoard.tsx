import { useState, useEffect } from 'react'
import { Icon } from '~/components/Icon'

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

const FAILS: FailSpec[] = [
  { mat: 'LIME OIL EXP TAHITI LHC LLE 10KG', matNo: '20616727', lot: '040005198449 [1]', batch: '0011874817', line: 'P806 - NPD - DISTILLATION', char: 'E_SPECG1', text: 'Specific Gravity 25C', res: 0.8821, lo: 0.8870, hi: 0.8930, units: 'g/cc', sev: 'fail' },
  { mat: 'LIME OIL EXP TAHITI LHC LLE 10KG', matNo: '20616727', lot: '040005198449 [1]', batch: '0011874817', line: 'P806 - NPD - DISTILLATION', char: 'E_REFRAC', text: 'Refractive Index 20C', res: 1.4801, lo: 1.4820, hi: 1.4870, units: 'n', sev: 'fail' },
  { mat: 'N&A PUMPKIN SPICE TYPE FL 22.68KG', matNo: '20704112', lot: '040005198512 [1]', batch: '0011874901', line: 'P802 - BLENDING - LINE 2', char: 'E_MOIST', text: 'Moisture %', res: 4.82, lo: 0.00, hi: 4.50, units: '%', sev: 'fail' },
  { mat: 'N&A PUMPKIN SPICE TYPE FL 22.68KG', matNo: '20704112', lot: '040005198512 [1]', batch: '0011874901', line: 'P802 - BLENDING - LINE 2', char: 'E_PARTD50', text: 'Particle D50', res: 102, lo: 80, hi: 100, units: 'µm', sev: 'warn' },
  { mat: 'WPC-80 INSTANT 1KG POUCH', matNo: '20582002', lot: '040005198601 [2]', batch: '0008898869', line: 'P404 - DRYER - LINE 4', char: 'E_BULKD', text: 'Bulk Density', res: 0.36, lo: 0.38, hi: 0.46, units: 'g/cc', sev: 'fail' },
  { mat: 'WPC-80 INSTANT 1KG POUCH', matNo: '20582002', lot: '040005198601 [2]', batch: '0008898869', line: 'P404 - DRYER - LINE 4', char: 'E_OUTTMP', text: 'Outlet Temp', res: 92.4, lo: 78.0, hi: 88.0, units: '°C', sev: 'fail' },
  { mat: 'ORANGE OIL VALENCIA COLD PRESS', matNo: '20619841', lot: '040005198688 [1]', batch: '0011875204', line: 'P806 - NPD - DISTILLATION', char: 'E_ALDEHY', text: 'Aldehydes %', res: 1.42, lo: 1.20, hi: 2.50, units: '%', sev: 'warn' },
  { mat: 'VANILLA EXTRACT NAT 1X (FOLD)', matNo: '20617025', lot: '040005198741 [1]', batch: '0011875310', line: 'P802 - BLENDING - LINE 2', char: 'E_VANILLIN', text: 'Vanillin Conc.', res: 11.8, lo: 13.0, hi: 14.5, units: 'g/L', sev: 'fail' },
]

const PAGE_SIZE = 6

/** Lab Board — full-screen wallboard for quality lab. Auto-rotates inspection lot failures. */
export function LabBoard() {
  const [tick, setTick] = useState(24)
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(FAILS.length / PAGE_SIZE))
  const visible = FAILS.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const stamp = new Date().toLocaleString('en-GB', { hour12: false }).replace(',', ' ·')

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
        <div className="lab-ctx-field"><span className="lbl">Plant</span><span className="val">P806 · Clark North</span></div>
        <div className="lab-ctx-field"><span className="lbl">Work centers</span><span className="val">All</span></div>
        <div className="lab-ctx-field"><span className="lbl">Inspection lot type</span><span className="val">04</span></div>
        <div className="lab-ctx-field"><span className="lbl">Severity</span><span className="val">Fail · Warn</span></div>
        <div className="lab-ctx-field grow"><span className="lbl">Next refresh in</span><span className="val refresh">{tick} <span className="u">s</span></span></div>
        <div className="lab-ctx-field"><span className="lbl">Page</span><span className="val">{page + 1} / {pages}</span></div>
        <div className="lab-ctx-field"><span className="lbl">Open fails</span><span className="val crit">{FAILS.filter(f => f.sev === 'fail').length}</span></div>
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
