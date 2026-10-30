import type { CSSProperties } from "react";
import { NavLink } from "react-router-dom";
import { useLiveQuotes } from "@/lib/market";
import { fmt, fmtSigned } from "@/lib/format";
import { useApp } from "@/state/AppContext";
import {
  IconBookmark,
  IconBriefcase,
  IconChevronDown,
  IconGavel,
  IconOrders,
  IconTrending,
  IconUser,
} from "./Icons";

const INDICES = [
  { key: "NSE:NIFTY 50", label: "NIFTY 50" },
  { key: "NSE:NIFTY BANK", label: "NIFTY BANK" },
];
const INDEX_KEYS = INDICES.map((i) => i.key);

export function IndexStrip() {
  const q = useLiveQuotes(INDEX_KEYS);
  return (
    <div className="index-strip">
      {INDICES.map((ix) => {
        const v = q(ix.key);
        const ch = v?.change ?? 0;
        return (
          <div key={ix.key} className="ix">
            <div className="ix-name">{ix.label}</div>
            <div className="ix-vals">
              <span className={ch < 0 ? "c-loss" : "c-green"}>{fmt(v?.last)}</span>
              <span className="ix-ch">
                {fmtSigned(ch)} ({fmtSigned(v?.changePct)}%)
              </span>
            </div>
          </div>
        );
      })}
      <button type="button" className="ix-chev" aria-label="Market overview">
        <IconChevronDown size={22} />
      </button>
    </div>
  );
}

export function BottomNav() {
  const { profile, ordersDot } = useApp();
  const items = [
    { to: "/watchlist", label: "Watchlist", Icon: IconBookmark },
    { to: "/orders", label: "Orders", Icon: IconOrders, dot: ordersDot },
    { to: "/portfolio", label: "Portfolio", Icon: IconBriefcase },
    { to: "/bids", label: "Bids", Icon: IconGavel },
    { to: "/profile", label: profile?.clientId || "Profile", Icon: IconUser },
  ];
  return (
    <nav className="bottom-nav">
      {items.map(({ to, label, Icon, dot }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `bn-item${isActive ? " active" : ""}`}>
          <span className="bn-icon">
            <Icon size={24} />
            {dot && <span className={`bn-dot ${dot}`} />}
          </span>
          <span className="bn-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function Fab({ style }: { style?: CSSProperties }) {
  return (
    <button type="button" className="fab" style={style} aria-label="Market movers">
      <IconTrending size={18} />
    </button>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  return (
    <>
      {toasts.map((t) =>
        t.kind === "error" ? (
          <div key={t.id} className="toast-error">
            {t.text}
          </div>
        ) : (
          <div key={t.id} className="snackbar">
            {t.text}
          </div>
        ),
      )}
    </>
  );
}

export function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="empty">
      <svg width="92" height="80" viewBox="0 0 92 80" aria-hidden>
        <rect x="14" y="40" width="64" height="30" rx="2" fill="#e8e8e8" />
        <rect x="20" y="10" width="36" height="44" rx="2" transform="rotate(-14 38 32)" fill="#f3f3f3" stroke="#d5d5d5" />
        <rect x="34" y="8" width="36" height="44" rx="2" transform="rotate(8 52 30)" fill="#fafafa" stroke="#d5d5d5" />
        <path d="M42 18h18M42 24h14M42 30h16" stroke="#9b9b9b" strokeWidth="1.5" transform="rotate(8 52 30)" />
        <path d="M24 22l10-2M25 28l8-1.6" stroke="#ff5722" strokeWidth="1.5" transform="rotate(-14 38 32)" />
        <rect x="10" y="38" width="72" height="6" rx="1" fill="#d5d5d5" />
        <path d="M70 14l3 6 4-8" stroke="#4184f3" strokeWidth="1.6" fill="none" />
        <circle cx="66" cy="8" r="3" fill="#ffbf00" />
      </svg>
      <div className="empty-title">{title}</div>
      {sub && <div className="empty-sub">{sub}</div>}
    </div>
  );
}
