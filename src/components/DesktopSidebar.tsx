import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TrendingUp, BarChart3, User } from 'lucide-react';
import GrowwLogo from './GrowwLogo';

const optixTelegram = import.meta.env.VITE_OPTIX_TELEGRAM_URL as string | undefined;
const optixInstagram = import.meta.env.VITE_OPTIX_INSTAGRAM_URL as string | undefined;
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
      {/* Logo + brand (desktop sidebar only) */}
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <GrowwLogo size={30} />
          <div className="min-w-0">
            <span className="block text-lg font-bold leading-tight text-foreground">GrowwTrader</span>
            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Product</span>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">Optix Trades</span>
          <span className="text-muted-foreground"> | F&amp;O Trader</span>
          <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal">Brand behind this app</span>
        </p>
        <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => navigate("/about-optix")}
            className="w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            About Optix Trades
          </button>
          <button
            type="button"
            onClick={() => navigate("/press")}
            className="w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Press / Media
          </button>
        </div>
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
              {optixTelegram ? (
                <a
                  href={optixTelegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-lg px-3 py-2 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Telegram (Optix)
                </a>
              ) : null}
              {optixInstagram ? (
                <a
                  href={optixInstagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-lg px-3 py-2 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Instagram (Optix)
                </a>
              ) : null}
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
