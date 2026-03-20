import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TrendingUp, BarChart3 } from 'lucide-react';

const tabs = [
  { path: '/stocks', label: 'Stocks', icon: TrendingUp },
  { path: '/mutual-funds', label: 'Mutual Funds', icon: BarChart3 },
];

const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Don't show on stock detail, login, splash pages
  if (location.pathname.startsWith('/stock/') || location.pathname === '/login' || location.pathname === '/') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around bg-card">
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span className="font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
