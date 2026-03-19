import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TrendingUp, BarChart3, Play, User, Briefcase, PieChart, Settings } from 'lucide-react';
import GrowwLogo from './GrowwLogo';
import { useTheme } from '@/hooks/useTheme';
import { Moon, Sun } from 'lucide-react';

const navItems = [
  { path: '/stocks', label: 'Stocks', icon: TrendingUp },
  { path: '/mutual-funds', label: 'Mutual Funds', icon: BarChart3 },
  { path: '/pay', label: 'UPI', icon: Play },
  { path: '/profile', label: 'Profile', icon: User },
];

const DesktopSidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-border lg:bg-card lg:min-h-screen lg:sticky lg:top-0">
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
      </div>
    </aside>
  );
};

export default DesktopSidebar;
