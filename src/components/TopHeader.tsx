import React from 'react';
import GrowwLogo from './GrowwLogo';
import { Search, LayoutGrid, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';

interface TopHeaderProps {
  title: string;
}

const TopHeader: React.FC<TopHeaderProps> = ({ title }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        <GrowwLogo size={28} />
        <span className="text-lg font-semibold text-foreground">{title}</span>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={toggleTheme} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <button className="text-muted-foreground"><Search className="h-5 w-5" /></button>
        <button className="text-muted-foreground"><LayoutGrid className="h-5 w-5" /></button>
        <button
          onClick={() => navigate('/profile')}
          className="h-8 w-8 overflow-hidden rounded-full bg-muted"
        >
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
            U
          </div>
        </button>
      </div>
    </header>
  );
};

export default TopHeader;
