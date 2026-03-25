import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TrendingUp, BarChart3, User } from 'lucide-react';
import GrowwLogo from './GrowwLogo';
import { useTheme } from '@/hooks/useTheme';
import { Moon, Sun } from 'lucide-react';

const navItems = [
  { path: '/stocks', label: 'Stocks', icon: TrendingUp },
  { path: '/mutual-funds', label: 'Mutual Funds', icon: BarChart3 },
  { path: '/profile', label: 'Profile', icon: User },
];

const DesktopSidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-border lg:bg-card lg:h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <GrowwLogo size={30} />
        <span className="text-lg font-bold text-foreground">Groww</span>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(item => {
          const isActive = location.pathname === item.path ||
            (item.path === '/stocks' && location.pathname === '/');
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border px-3 py-4">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        {/* Policy links for whitelisting (desktop only). */}
        <div className="mt-3">
          <details className="group">
            <summary className="cursor-pointer select-none px-3 text-[11px] font-medium text-muted-foreground opacity-70 hover:opacity-100">
              Policies
            </summary>
            <div className="mt-2 space-y-1 px-1">
              <button
                type="button"
                onClick={() => navigate("/contact-us")}
                className="block w-full rounded-lg px-3 py-2 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Contact Us
              </button>
              <button
                type="button"
                onClick={() => navigate("/terms-and-conditions")}
                className="block w-full rounded-lg px-3 py-2 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Terms &amp; Conditions
              </button>
              <button
                type="button"
                onClick={() => navigate("/refunds-cancellations")}
                className="block w-full rounded-lg px-3 py-2 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Refunds &amp; Cancellations
              </button>
              <button
                type="button"
                onClick={() => navigate("/other-details")}
                className="block w-full rounded-lg px-3 py-2 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Other Details
              </button>
            </div>
          </details>
        </div>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
