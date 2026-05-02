import { Card } from '~/components/Card'
import { PageHead } from '~/components/PageHead'
import { Icon } from '~/components/Icon'

const SECTIONS = [
  { num: '01', title: 'Identity & access', items: ['SSO via Kerry Azure AD', 'Role-based permissions', 'Audit trail · 7y retention'] },
  { num: '02', title: 'Data sources', items: ['SAP S/4 ECC · 12 plants', 'PI System · 47 sites', 'Empower LIMS · QC integration', 'Star file ingestion · gold layer'] },
  { num: '03', title: 'Module configuration', items: ['Trace · lineage depth + recall thresholds', 'EnvMon · MIC catalog + decay constants', 'SPC · rule sets, σ levels, sample windows'] },
  { num: '04', title: 'Notifications', items: ['Email · MS Teams · Pager', 'Severity routing rules', 'Quiet hours per role'] },
  { num: '05', title: 'Compliance', items: ['FSMA 204 traceability', 'EU 178/2002 article 18', 'GFSI / SQF audit packs'] },
]

/** Settings / admin panel — restricted to QA admins. */
export function Admin() {
  return (
    <div className="cq-page">
      <PageHead
        eyebrow="MODULE 99"
        title="SETTINGS"
        desc="Tenant-level administration. Identity, data sources, module configuration, notifications, compliance. Restricted to QA admins."
        actions={<button className="cq-btn"><Icon name="dl" size={12} /> Export config</button>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {SECTIONS.map((s, i) => (
          <Card key={i} title={s.title} num={s.num} meta="ADMIN ONLY">
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
              {s.items.map((it, j) => (
                <li key={j} style={{ display: 'grid', gridTemplateColumns: '16px 1fr auto', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: j < s.items.length - 1 ? '1px solid var(--cq-line)' : 'none' }}>
                  <Icon name="check" size={14} />
                  <span style={{ fontSize: 12.5 }}>{it}</span>
                  <Icon name="chev" size={12} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}
