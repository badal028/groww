import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { isAdminEmail } from '@/lib/accountLabels';

const ACTIVE = '#5e7efb';
const INACTIVE = '#6A6E71';

const baseTabs = [
  { id: 'stocks', path: '/stocks', label: 'Stocks' },
  { id: 'fo', path: '/stocks?tab=Explore', label: 'F&O' },
  { id: 'mf', path: '/mutual-funds', label: 'Mutual Funds' },
  { id: 'loans', path: null, label: 'Loans' },
] as const;

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
  if (id === 'admin') {
    return (
      <svg {...common}>
        <path d="M12 3l7 4v5c0 4.2-2.9 8-7 9-4.1-1-7-4.8-7-9V7l7-4z" />
        <path d="M9.5 12.5l1.8 1.8 3.5-3.6" />
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

function foStocksTabActive(search: string): boolean {
  const tab = new URLSearchParams(search).get('tab');
  return tab === 'Explore' || tab === 'Positions' || tab === 'Orders';
}

function tabIsActive(tabId: string, pathname: string, search: string): boolean {
  if (tabId === 'admin') return pathname === '/admin';
  if (tabId === 'stocks') return pathname === '/stocks' && !foStocksTabActive(search);
  if (tabId === 'fo') return pathname === '/stocks' && foStocksTabActive(search);
  if (tabId === 'mf') return pathname === '/mutual-funds';
  return false;
}

const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const tabs = useMemo(() => {
    const items = [...baseTabs];
    if (isAdminEmail(user?.email)) {
      items.push({ id: 'admin', path: '/admin', label: 'Admin' });
    }
    return items;
  }, [user?.email]);

  if (location.pathname.startsWith('/stock/') || location.pathname === '/login' || location.pathname === '/') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-[#eef1f4] dark:border-white/10 dark:bg-background lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around bg-[#eef1f4] dark:bg-background">
        {tabs.map((tab) => {
          const isActive = tabIsActive(tab.id, location.pathname, location.search);
          const color = isActive ? ACTIVE : INACTIVE;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (!tab.path) return;
                navigate(tab.path);
              }}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors',
                tab.id === 'mf' || tab.id === 'admin' ? 'min-w-[72px]' : '',
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
