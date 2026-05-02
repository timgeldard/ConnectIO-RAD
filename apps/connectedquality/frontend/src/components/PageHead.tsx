import type { ReactNode } from 'react'

interface PageHeadProps {
  eyebrow: string
  title: string
  desc?: string
  actions?: ReactNode
}

/** Page-level header: eyebrow label, impact-font title, serif description, and action buttons. */
export function PageHead({ eyebrow, title, desc, actions }: PageHeadProps) {
  return (
    <div className="cq-page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {desc && <div className="desc">{desc}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  )
}
