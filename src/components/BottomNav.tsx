import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const ACTIVE = '#5e7efb';
const INACTIVE = '#6A6E71';

const tabs = [
  { id: 'stocks', path: '/stocks', label: 'Stocks' },
  { id: 'fo', path: '/stocks?tab=Explore', label: 'F&O' },
  { id: 'mf', path: '/mutual-funds', label: 'Mutual Funds' },
  { id: 'upi', path: null, label: 'UPI' },
  { id: 'loans', path: null, label: 'Loans' },
];

function NavIcon({ id, color }: { id: string; color: string }) {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none' as const, stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (id === 'stocks') {
    return (
      <svg {...common}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
        <path d="M7 15l3-3 2.2 1.8L17 9" />
      </svg>
    );
  }
  if (id === 'fo') {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="18" height="18" rx="3" fill={color} stroke={color} />
        <path d="M6.5 14.5h4.2l2.4-4 3 2" stroke="#0b1020" />
      </svg>
    );
  }
  if (id === 'mf') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="7.5" />
        <path d="M12 4.5v15" />
        <path d="M4.5 12h15" />
      </svg>
    );
  }
  if (id === 'upi') {
    return (
      <svg {...common}>
        <path d="M5 8l5 4-5 4" />
        <path d="M11.5 8l5 4-5 4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3.5" y="6.5" width="17" height="11" rx="2.5" />
      <circle cx="12" cy="12" r="1.8" />
    </svg>
  );
}

const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Don't show on stock detail, login, splash pages
  if (location.pathname.startsWith('/stock/') || location.pathname === '/login' || location.pathname === '/') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-[#eef1f4] dark:border-white/10 dark:bg-[#141819] lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around bg-[#eef1f4] dark:bg-[#141819]">
        {tabs.map(tab => {
          const isActive = tab.id === 'fo'; // keep F&O highlighted always (requested)
          const color = isActive ? ACTIVE : INACTIVE;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (!tab.path) return;
                navigate(tab.path);
              }}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors",
                tab.id === 'mf' ? 'min-w-[84px]' : '',
              )}
            >
              <NavIcon id={tab.id} color={color} />
              <span className="font-medium" style={{ color }}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
