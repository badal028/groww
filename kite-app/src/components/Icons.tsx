import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 20, rest: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...rest,
});

export const IconBookmark = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" />
  </svg>
);

export const IconOrders = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
    <path d="M8.5 3.5v17" />
    <path d="M11.5 8h4.5M11.5 11.5h4.5" />
  </svg>
);

export const IconBriefcase = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <rect x="3.5" y="7" width="17" height="12.5" rx="1.5" />
    <path d="M9 7V5.2c0-.4.3-.7.7-.7h4.6c.4 0 .7.3.7.7V7" />
    <path d="M3.5 12.5h17" />
    <path d="M10.5 12.5v1.5h3v-1.5" />
  </svg>
);

export const IconGavel = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M13.5 4.5l6 6" />
    <path d="M10.6 7.4l6 6" />
    <path d="M12 6l4 4-3 3-4-4z" />
    <path d="M10.3 11.7L4.2 17.8a1.3 1.3 0 001.9 1.9l6.1-6.1" />
    <path d="M13 20h7" />
  </svg>
);

export const IconUser = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <circle cx="12" cy="8" r="3.8" />
    <path d="M4.5 20.5c.6-3.9 3.6-6.2 7.5-6.2s6.9 2.3 7.5 6.2" />
  </svg>
);

export const IconSearch = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15 15l5 5" />
  </svg>
);

export const IconSliders = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M6 4v16M12 4v16M18 4v16" />
    <rect x="4.2" y="13" width="3.6" height="2.6" rx=".6" fill="currentColor" />
    <rect x="10.2" y="7" width="3.6" height="2.6" rx=".6" fill="currentColor" />
    <rect x="16.2" y="14.5" width="3.6" height="2.6" rx=".6" fill="currentColor" />
  </svg>
);

export const IconChevronDown = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconChevronRight = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const IconBack = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M19 12H5.5M11 6l-6 6 6 6" />
  </svg>
);

export const IconPlus = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconMinus = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M5 12h14" />
  </svg>
);

export const IconCheck = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const IconGroupSettings = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6" />
  </svg>
);

export const IconChart = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M5 19V12M10 19V6M15 19v-9M20 19v-5" />
  </svg>
);

export const IconOptionChain = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M4 8h12l-3-3M20 16H8l3 3" />
  </svg>
);

export const IconBell = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M6.5 16.5V11a5.5 5.5 0 0111 0v5.5l1.5 1.5H5z" />
    <path d="M10 20.5h4" />
  </svg>
);

export const IconNotes = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <rect x="5" y="4" width="14" height="16" rx="1.5" />
    <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" />
  </svg>
);

export const IconGtt = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M3 8h10l4 4-4 4H3l3-4z" />
    <path d="M17 8h4M17 16h4" />
  </svg>
);

export const IconSwap = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M5 9h13l-3.5-3.5M19 15H6l3.5 3.5" />
  </svg>
);

export const IconShield = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M12 3.5l7 2.5v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6z" />
    <path d="M7.5 8.5l9 9" />
  </svg>
);

export const IconRefresh = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M19.5 12a7.5 7.5 0 11-2.2-5.3" />
    <path d="M19.5 4.5v4.2h-4.2" />
  </svg>
);

export const IconKebab = ({ size, ...r }: P) => (
  <svg {...base(size, r)} fill="currentColor" stroke="none">
    <circle cx="12" cy="5.5" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="12" cy="18.5" r="1.7" />
  </svg>
);

export const IconClock = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const IconDoc = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M6 3.5h8l4 4v13H6z" />
    <path d="M14 3.5v4h4M9 12h6M9 15.5h6" />
  </svg>
);

export const IconTradebook = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <circle cx="12" cy="12" r="8.5" fill="currentColor" stroke="none" />
    <path d="M9 8.5h6M9 12h6M9 15.5h4" stroke="#fff" />
  </svg>
);

export const IconRupee = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M7 5h10M7 9h10M10 5c5 0 5 8 0 8H7l7 7" />
  </svg>
);

export const IconLock = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="1.5" />
    <path d="M8 10.5V8a4 4 0 018 0" />
  </svg>
);

export const IconGear = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5v.2a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1h.2a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" />
  </svg>
);

export const IconCube = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
    <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
  </svg>
);

export const IconLogout = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M14 4.5H6.5A1.5 1.5 0 005 6v12a1.5 1.5 0 001.5 1.5H14" />
    <path d="M10.5 12H20M16.5 8.5L20 12l-3.5 3.5" />
  </svg>
);

export const IconLifebuoy = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="M6 6l3.5 3.5M14.5 14.5L18 18M18 6l-3.5 3.5M9.5 14.5L6 18" />
  </svg>
);

export const IconQuestion = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.5a2.5 2.5 0 014.8.9c0 1.7-2.4 2.1-2.4 3.6M12 17h.01" />
  </svg>
);

export const IconPhone = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M5 4.5h3.5l1.5 4-2 1.3a10 10 0 006.2 6.2l1.3-2 4 1.5V19a1.5 1.5 0 01-1.6 1.5C10.5 20 4 13.5 3.5 6.1A1.5 1.5 0 015 4.5z" />
  </svg>
);

export const IconUserPlus = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <circle cx="10" cy="8" r="3.5" />
    <path d="M3.5 20c.5-3.6 3.2-5.7 6.5-5.7 1.4 0 2.7.4 3.7 1.1M18 13.5v6M15 16.5h6" />
  </svg>
);

export const IconFile = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M6 3.5h8l4 4v13H6z" />
    <path d="M14 3.5v4h4M9 11.5h6M9 14.5h6M9 17.5h4" />
  </svg>
);

export const IconBolt = ({ size, ...r }: P) => (
  <svg {...base(size, r)} fill="currentColor" stroke="none">
    <path d="M13.5 2.5L5 13.5h6l-1 8 8.5-11h-6z" />
  </svg>
);

export const IconExit = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M10 4.5H5.5v15H10" />
    <path d="M9 12h11M16.5 8.5L20 12l-3.5 3.5" />
  </svg>
);

export const IconTrending = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M3.5 16.5l5.5-5.5 4 4 7.5-7.5" />
    <path d="M15.5 7.5h5v5" />
  </svg>
);

export const IconEye = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconEyeOff = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M3 3l18 18M10.6 6c.5-.1.9-.1 1.4-.1C18 5.9 21.5 12 21.5 12a17 17 0 01-3 3.7M6.6 6.6A17 17 0 002.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.3-1" />
    <path d="M9.9 9.9a3 3 0 004.2 4.2" />
  </svg>
);

export const IconList = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M4 7h16M7 12h13M10 17h10" />
  </svg>
);

export const IconAnalyze = ({ size, ...r }: P) => (
  <svg width={size || 16} height={size || 16} viewBox="0 0 24 24" {...r}>
    <rect x="1" y="1" width="22" height="22" rx="4" fill="#ff5722" />
    <path d="M6 7l6 10 6-10" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconPnl = ({ size, ...r }: P) => (
  <svg width={size || 16} height={size || 16} viewBox="0 0 24 24" {...r}>
    <circle cx="12" cy="12" r="10" fill="none" stroke="#4184f3" strokeWidth="2" />
    <circle cx="12" cy="12" r="5.5" fill="#4184f3" />
  </svg>
);

export const IconClose = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconInfo = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);

/** Kite logo mark. */
export const KiteLogo = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size * 0.7} viewBox="0 0 64 44" aria-label="Kite">
    <path d="M0 22 L22 0 L44 22 L22 44 Z" fill="#ff5722" />
    <path d="M20 22 L42 0 L64 22 L42 44 Z" fill="#e53e1c" opacity="0.92" />
  </svg>
);

/** Weekly-expiry marker shown next to the expiry day. */
export const WeeklyBadge = () => (
  <svg className="wk" width="11" height="11" viewBox="0 0 12 12" aria-label="Weekly">
    <circle cx="6" cy="6" r="6" fill="#4184f3" />
    <path d="M2.7 4l1.15 4.2L6 5.1l2.15 3.1L9.3 4" stroke="#fff" strokeWidth="1.1" fill="none" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);
