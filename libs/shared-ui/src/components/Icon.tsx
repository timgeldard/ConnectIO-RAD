import type { CSSProperties } from 'react'

const ICON_PATHS: Record<string, string> = {
  'chevron-down':    'M6 9l6 6 6-6',
  'chevron-right':   'M9 6l6 6-6 6',
  'chevron-left':    'M15 6l-6 6 6 6',
  'chevron-up':      'M18 15l-6-6-6 6',
  'search':          'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.35-4.35',
  'filter':          'M3 6h18M6 12h12M10 18h4',
  'sliders':         'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h14M20 18h0',
  'bell':            'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  'alert-triangle':  'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  'check':           'M20 6L9 17l-5-5',
  'check-circle':    'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3',
  'x':               'M18 6L6 18M6 6l12 12',
  'x-circle':        'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM15 9l-6 6M9 9l6 6',
  'plus':            'M12 5v14M5 12h14',
  'minus':           'M5 12h14',
  'info':            'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM12 16v-4M12 8h.01',
  'zap':             'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  'activity':        'M22 12h-4l-3 9L9 3l-3 9H2',
  'trending-up':     'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  'trending-down':   'M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6',
  'grid':            'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  'layers':          'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  'git-branch':      'M6 3v12M18 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM15 6a9 9 0 0 0-9 9',
  'message-square':  'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  'package':         'M16.5 9.4L7.5 4.21M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12',
  'cpu':             'M4 4h16v16H4V4zM9 9h6v6H9V9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3',
  'factory':         'M2 20V8l6 4V8l6 4V8l6 4v8H2zM6 14v2M10 14v2M14 14v2M18 14v2',
  'sparkles':        'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM19 14l.8 2.4L22 17l-2.2.6L19 20l-.8-2.4L16 17l2.2-.6L19 14zM5 16l.5 1.5L7 18l-1.5.5L5 20l-.5-1.5L3 18l1.5-.5L5 16z',
  'download':        'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  'upload':          'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  'share':           'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13',
  'copy':            'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  'more':            'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  'calendar':        'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zM16 2v4M8 2v4M3 10h18',
  'clock':           'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM12 6v6l4 2',
  'settings':        'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .66.39 1.26 1 1.51H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  'user':            'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  'users':           'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  'eye':             'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'eye-off':         'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22',
  'flag':            'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22V15',
  'maximize':        'M3 3h7v2H5v5H3V3zM14 3h7v7h-2V5h-5V3zM3 14h2v5h5v2H3v-7zM19 14h2v7h-7v-2h5v-5z',
  'minimize':        'M8 3v5H3M21 8h-5V3M3 16h5v5M16 21v-5h5',
  'home':            'M3 10l9-7 9 7v11a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z',
  'bar-chart':       'M3 3v18h18M7 14v5M12 8v11M17 12v7',
  'compass':         'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0zM16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z',
  'target':          'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0zM18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0zM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  'database':        'M4 6a8 3 0 1 0 16 0 8 3 0 0 0-16 0zM20 12c0 1.66-3.58 3-8 3s-8-1.34-8-3M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6',
  'layout':          'M3 3h18v18H3zM3 9h18M9 21V9',
  'help':            'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01',
  'moon':            'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  'sun':             'M12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
  'beaker':          'M5 3h14M6 3v18a0 0 0 0 0 0 0h12a0 0 0 0 0 0 0V3M5 14h14',
  'arrow-right':     'M5 12h14M12 5l7 7-7 7',
  'arrow-left':      'M19 12H5M12 19l-7-7 7-7',
  'arrow-up-right':  'M7 17L17 7M7 7h10v10',
  'zoom-in':         'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.35-4.35M11 8v6M8 11h6',
  'refresh':         'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  'play':            'M5 3l14 9-14 9V3z',
  'flask':           'M9 3h6v6l5 10a2 2 0 0 1-2 3H6a2 2 0 0 1-2-3l5-10V3zM9 9h6',
  'route':           'M6 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 16l6-8',
  'printer':         'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  'history':         'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2',
  'archive':         'M21 8V21H3V8M1 3H23V8H1V3ZM10 12H14',
  'alert-circle':    'M12 8v4M12 16h.01M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z',
  'search-alt':      'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',

}

export type IconName = keyof typeof ICON_PATHS

interface IconProps {
  name: IconName
  size?: number
  strokeWidth?: number
  style?: CSSProperties
  className?: string
}

export function Icon({ name, size = 16, strokeWidth = 1.75, style, className }: IconProps) {
  const d = ICON_PATHS[name]
  if (!d) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}
