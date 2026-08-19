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
