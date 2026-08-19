// small line icons, sized to inherit color via currentColor -- no icon-library
// dependency, matching the app's no-external-asset approach elsewhere (sound, avatars).
const common = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconStats() {
  return (
    <svg {...common} aria-hidden="true">
      <line x1="5" y1="20" x2="5" y2="12" />
      <line x1="12" y1="20" x2="12" y2="6" />
      <line x1="19" y1="20" x2="19" y2="15" />
    </svg>
  );
}

export function IconLogout() {
  return (
    <svg {...common} aria-hidden="true">
      <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
      <polyline points="15 16 20 11 15 6" />
      <line x1="20" y1="11" x2="9" y2="11" />
    </svg>
  );
}

export function IconLogin() {
  return (
    <svg {...common} aria-hidden="true">
      <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
      <polyline points="10 16 5 11 10 6" />
      <line x1="5" y1="11" x2="16" y2="11" />
    </svg>
  );
}

export function IconEdit() {
  return (
    <svg {...common} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function IconPopOut() {
  return (
    <svg {...common} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <rect x="12" y="12" width="7" height="5" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconFlame() {
  return (
    <svg {...common} aria-hidden="true">
      <path d="M12 2c1 3-2 4-2 7a4 4 0 0 0 8 0c0-1.5-.6-2.4-1-3 .8 1.6 0 3-1.2 3.4C17 8 15 6.5 15 4c2 1 5 4.5 5 8.5A8 8 0 0 1 4 12.5C4 8 8 5 12 2Z" />
    </svg>
  );
}

export function IconTrophy() {
  return (
    <svg {...common} aria-hidden="true">
      <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
      <path d="M8 5H5a3 3 0 0 0 3 5" />
      <path d="M16 5h3a3 3 0 0 1-3 5" />
      <path d="M12 13v3" />
      <path d="M9 20h6" />
      <path d="M10 16h4l.5 4h-5Z" />
    </svg>
  );
}

export function IconShare() {
  return (
    <svg {...common} aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
    </svg>
  );
}

export function IconBell() {
  return (
    <svg {...common} aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconDownload() {
  return (
    <svg {...common} aria-hidden="true">
      <path d="M12 3v12" />
      <polyline points="7 11 12 16 17 11" />
      <path d="M5 20h14" />
    </svg>
  );
}
