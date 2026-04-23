import { useState, useEffect } from 'react';
import { IconChevronDown } from './Icons';
import type { PersonaId, Persona } from '~/types';

export const PERSONAS: Persona[] = [
  {
    id: 'regional',
    name: 'Aoife Dunne',
    role: 'Regional QA Lead',
    scope: 'EMEA · 24 plants',
    initials: 'AD',
    blurb: 'Portfolio of sites, risk ranking, pathogen hits.',
    defaultView: 'global',
  },
  {
    id: 'site',
    name: 'Miguel Ortiz',
    role: 'Site Quality Manager',
    scope: 'P225 Seville',
    initials: 'MO',
    blurb: 'All floors of one plant, open findings, weekly plan.',
    defaultView: 'site',
  },
  {
    id: 'sanitation',
    name: 'Priya Nair',
    role: 'Sanitation Lead',
    scope: 'P225 Seville · Zones 3–6',
    initials: 'PN',
    blurb: 'Floor plan + blast radius, re-clean lists.',
    defaultView: 'floor',
  },
  {
    id: 'auditor',
    name: 'Dr. Klaus Weber',
    role: 'Third-party Auditor',
    scope: 'Read-only · 90d window',
    initials: 'KW',
    blurb: 'Historical playback, lot traceability, CSV export.',
    defaultView: 'site',
  },
  {
    id: 'admin',
    name: 'Lin Chen',
    role: 'System Admin',
    scope: 'Coordinate & area mapper',
    initials: 'LC',
    blurb: 'Draw sub-areas, assign swab points, curate hierarchy.',
    defaultView: 'admin',
  },
];

interface Props {
  personaId: PersonaId;
  onChange: (id: PersonaId) => void;
}

export default function PersonaSwitcher({ personaId, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const current = PERSONAS.find((p) => p.id === personaId)!;

  useEffect(() => {
    if (!open) return;
    const onDoc = () => setOpen(false);
    setTimeout(() => document.addEventListener('click', onDoc, { once: true }), 0);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);

  return (
    <div className="persona-switcher" onClick={(e) => e.stopPropagation()}>
      <button className="btn" onClick={() => setOpen((v) => !v)}>
        <span className="avatar">{current.initials}</span>
        <span className="who">
          <span className="name">{current.name}</span>
          <div className="role">{current.role}</div>
        </span>
        <IconChevronDown size={12} />
      </button>
      {open && (
        <div className="menu fade-in">
          <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--stroke-soft)', background: 'var(--stone)' }}>
            <div className="eyebrow">Switch persona</div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-muted)', marginTop: 4 }}>Demo only — role gates what you see.</div>
          </div>
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              className={`item${p.id === personaId ? ' active' : ''}`}
              onClick={() => { onChange(p.id); setOpen(false); }}
            >
              <span className="dot">{p.initials}</span>
              <span>
                <div className="t">
                  {p.name}
                  <span style={{ fontWeight: 400, color: 'var(--fg-muted)', fontSize: 11.5 }}> · {p.role}</span>
                </div>
                <div className="s">{p.blurb}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--valentia-slate)', marginTop: 4, letterSpacing: '0.04em' }}>{p.scope}</div>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
