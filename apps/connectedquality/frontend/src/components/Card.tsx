import type { CSSProperties, ReactNode } from 'react'

interface CardProps {
  title?: string
  num?: string
  meta?: string
  action?: ReactNode
  children: ReactNode
  style?: CSSProperties
  bodyClass?: string
}

/** Surface card with optional header containing title, num label, meta text, and action slot. */
export function Card({ title, num, meta, action, children, style, bodyClass }: CardProps) {
  return (
    <section className="cq-card" style={style}>
      {(title != null || action != null) && (
        <div className="cq-card-head">
          <div className="ttl">
            {num != null && <span className="num">{num}</span>}
            <span>{title}</span>
            {meta != null && <span className="meta" style={{ marginLeft: 8 }}>{meta}</span>}
          </div>
          {action ?? null}
        </div>
      )}
      <div className={'cq-card-body ' + (bodyClass ?? '')}>{children}</div>
    </section>
  )
}
