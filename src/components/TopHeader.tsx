import React from 'react';
import GrowwLogo from './GrowwLogo';
import { Search, LayoutGrid, Moon, Sun, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

interface TopHeaderProps {
  title: string;
  /** Opens stock search (e.g. modal) from the header search icon */
  onSearchClick?: () => void;
  /** Show back button instead of logo (e.g. detail screens) */
  showBackButton?: boolean;
  onBackClick?: () => void;
}

const TopHeader: React.FC<TopHeaderProps> = ({ title, onSearchClick, showBackButton, onBackClick }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const initials = (user?.name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        {showBackButton ? (
          <button
            type="button"
            onClick={onBackClick ?? (() => navigate(-1))}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <GrowwLogo size={28} />
        )}
        <span className="text-lg font-semibold text-foreground">F&O</span>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={toggleTheme} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={onSearchClick}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
          aria-label="Search stocks"
        >
          <Search className="h-5 w-5" />
        </button>
        <button className="text-muted-foreground"><LayoutGrid className="h-5 w-5" /></button>
        <button
          onClick={() => navigate('/profile')}
          className="h-8 w-8 overflow-hidden rounded-full bg-muted"
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user?.name || 'User'} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
              {initials || 'U'}
            </div>
          )}
        </button>
      </div>
    </header>
  );
};

export default TopHeader;
