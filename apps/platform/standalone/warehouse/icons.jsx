/* Lucide-style line icons (1.75 stroke) */
const Icon = ({ name, size = 16, ...props }) => {
  const paths = {
    home: <><path d="M3 12 12 3l9 9"/><path d="M5 10v10h14V10"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    layers: <><path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></>,
    clipboard: <><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9z"/></>,
    play: <><polygon points="6 4 20 12 6 20 6 4"/></>,
    truck: <><rect x="2" y="6" width="13" height="10"/><path d="M15 9h4l3 3v4h-7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    box: <><path d="m21 7-9-4-9 4 9 4 9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></>,
    boxes: <><path d="M3 9 7 7l4 2v4l-4 2-4-2V9z"/><path d="M13 9 17 7l4 2v4l-4 2-4-2V9z"/><path d="M8 15l4 2 4-2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    users: <><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><circle cx="17" cy="6" r="3"/><path d="M22 17a5 5 0 0 0-7-4.6"/></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    chevron: <><path d="m9 18 6-6-6-6"/></>,
    chevronDown: <><path d="m6 9 6 6 6-6"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    check: <><path d="M20 6 9 17l-5-5"/></>,
    x: <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
    filter: <><path d="M3 6h18"/><path d="M6 12h12"/><path d="M9 18h6"/></>,
    column: <><rect x="3" y="3" width="6" height="18" rx="1"/><rect x="11" y="3" width="6" height="18" rx="1" opacity="0.5"/><rect x="19" y="3" width="2" height="18" rx="1" opacity="0.25"/></>,
    flag: <><path d="M4 21V4"/><path d="M4 4h13l-2 4 2 4H4"/></>,
    refresh: <><path d="M21 12a9 9 0 1 1-3.5-7.1"/><path d="M21 4v6h-6"/></>,
    download: <><path d="M12 3v12"/><path d="m6 11 6 6 6-6"/><path d="M5 21h14"/></>,
    sliders: <><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="6" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="7" cy="18" r="2" fill="currentColor"/></>,
    radio: <><path d="M2 12a10 10 0 0 1 3-7"/><path d="M5 12a7 7 0 0 1 2-5"/><circle cx="12" cy="12" r="2"/><path d="M17 17a7 7 0 0 0 2-5"/><path d="M19 19a10 10 0 0 0 3-7"/></>,
    zap: <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></>,
    queue: <><rect x="3" y="6" width="18" height="3" rx="1"/><rect x="3" y="11" width="18" height="3" rx="1"/><rect x="3" y="16" width="18" height="3" rx="1"/></>,
    merge: <><path d="M8 6v4a4 4 0 0 0 4 4h4"/><path d="m12 14 4-4-4-4"/><path d="M16 18v-4"/></>,
    lightning: <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v4h1"/></>,
    warn: <><path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
    lock: <><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
    eye: <><path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    save: <><path d="M5 3h12l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h9V3"/><path d="M7 21v-7h10v7"/></>,
    arrow: <><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>,
    arrowDown: <><path d="M12 5v14"/><path d="m5 12 7 7 7-7"/></>,
    in: <><path d="M14 3h5v18h-5"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/></>,
    out: <><path d="M9 21H4V3h5"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></>,
    star: <><path d="m12 2 3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></>,
    pin: <><path d="M12 17v5"/><path d="M9 10v-6h6v6l3 4H6z"/></>,
    location: <><path d="M12 22s-7-7-7-13a7 7 0 0 1 14 0c0 6-7 13-7 13z"/><circle cx="12" cy="9" r="2.5"/></>,
    factory: <><path d="M2 20V8l5 4V8l5 4V8l5 4V4h3v16z"/><path d="M6 16h2"/><path d="M11 16h2"/><path d="M16 16h2"/></>,
    book: <><path d="M4 4h12a3 3 0 0 1 3 3v14H7a3 3 0 0 1-3-3z"/><path d="M4 4v13a3 3 0 0 1 3-3h12"/></>,
    rf: <><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4"/><path d="M7.8 16.2a6 6 0 0 1 0-8.4"/><path d="M19 5a10 10 0 0 1 0 14"/><path d="M5 19a10 10 0 0 1 0-14"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    sparkles: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="m18 14 .8 2.4L21 17l-2.2.6L18 20l-.8-2.4L15 17l2.2-.6z"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {paths[name]}
    </svg>
  );
};
window.Icon = Icon;
