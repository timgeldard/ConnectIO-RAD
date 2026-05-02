import type { IconName } from '~/constants'

interface IconProps {
  name: IconName
  size?: number
  stroke?: number
}

/** Lucide-style line icon set for ConnectedQuality. */
export function Icon({ name, size = 16, stroke = 1.75 }: IconProps) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (name) {
    case 'home':
      return <svg {...props}><path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></svg>
    case 'trace':
      return <svg {...props}><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><circle cx="12" cy="12" r="2.5"/><path d="M8 7l3 3M16 7l-3 3M8 17l3-3M16 17l-3-3"/></svg>
    case 'env':
      return <svg {...props}><path d="M12 2v8M12 22v-8M2 12h8M22 12h-8"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg>
    case 'spc':
      return <svg {...props}><path d="M3 18h18"/><path d="M3 6h18" strokeDasharray="2 3"/><path d="M3 12l3-2 3 4 3-3 3 2 3-4 3 1"/></svg>
    case 'bell':
      return <svg {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>
    case 'settings':
      return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    case 'search':
      return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
    case 'plus':
      return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>
    case 'chev':
      return <svg {...props}><path d="M6 9l6 6 6-6"/></svg>
    case 'dl':
      return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
    case 'refresh':
      return <svg {...props}><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>
    case 'play':
      return <svg {...props}><polygon points="5 3 19 12 5 21 5 3"/></svg>
    case 'pause':
      return <svg {...props}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
    case 'flag':
      return <svg {...props}><path d="M4 21V4M4 15h12l-2-4 2-4H4"/></svg>
    case 'alert':
      return <svg {...props}><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
    case 'check':
      return <svg {...props}><path d="M20 6L9 17l-5-5"/></svg>
    case 'pin':
      return <svg {...props}><path d="M12 17v5"/><path d="M9 10.76V6h6v4.76l3 4.24H6z"/></svg>
    case 'layers':
      return <svg {...props}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
    case 'map':
      return <svg {...props}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
    case 'target':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
    case 'grid':
      return <svg {...props}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
    case 'list':
      return <svg {...props}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
    case 'user':
      return <svg {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    case 'help':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    case 'arrow':
      return <svg {...props}><path d="M5 12h14M13 5l7 7-7 7"/></svg>
    case 'arrowDown':
      return <svg {...props}><path d="M12 5v14M5 12l7 7 7-7"/></svg>
    case 'arrowUp':
      return <svg {...props}><path d="M12 19V5M5 12l7-7 7 7"/></svg>
    case 'eye':
      return <svg {...props}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    case 'flow':
      return <svg {...props}><rect x="3" y="3" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><rect x="9" y="15" width="6" height="6"/><path d="M6 9v3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9"/></svg>
    case 'expand':
      return <svg {...props}><path d="M21 3h-6M21 3v6M21 3l-7 7M3 21h6M3 21v-6M3 21l7-7"/></svg>
    default:
      return null
  }
}
