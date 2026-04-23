import { useState } from 'react'
import type { JSX, ReactElement, ReactNode } from 'react'

interface TooltipProps {
  children: ReactElement<JSX.IntrinsicElements[keyof JSX.IntrinsicElements]>
  content: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}

export function Tooltip({ children, content, className }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <span
      className={className}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            padding: '5px 8px',
            background: 'var(--forest)',
            color: '#F4F4E8',
            fontSize: 12,
            borderRadius: 5,
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-pop)',
          }}
        >
          {content}
        </span>
      )}
    </span>
  )
}
