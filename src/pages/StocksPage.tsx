import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TopHeader from '@/components/TopHeader';
import {
  marketIndices,
  popularStocks,
  etfStocks,
  holdingsData,
  stockCategories,
  additionalSearchStocks,
  type Stock,
} from '@/data/mockData';

/** Stable empty list — inline `[]` breaks useLiveStocks deps (new ref every render on Positions tab). */
const POSITIONS_TAB_STOCKS: Stock[] = [];
import StockLogo from '@/components/StockLogo';
import { StockSearchDialog } from '@/components/StockSearch';
import { useLocation, useNavigate } from 'react-router-dom';
import GrowwLogo from '@/components/GrowwLogo';
import { Bell, ChevronRight, Search } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useLiveStocks } from '@/hooks/useLiveStocks';
import { useLiveIndices } from '@/hooks/useLiveIndices';
import { Moon, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePaperPositions } from '@/hooks/usePaperPositions';
import PositionsPanel from '@/components/PositionsPanel';
import { useAuth } from '@/hooks/useAuth';
import { usePaperOrders } from '@/hooks/usePaperOrders';
import { usePendingLimitSellExecution } from '@/hooks/usePendingLimitSellExecution';
import OrdersPanel from '@/components/OrdersPanel';
import { isFoExpiryTagVisible } from '@/lib/indexFoExpiry';

const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || 'http://127.0.0.1:3001';

function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]!}${parts[parts.length - 1]![0]!}`.toUpperCase();
  if (parts.length === 1 && parts[0]!.length >= 2) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

const StocksPage: React.FC = () => {
  const location = useLocation();
  const queryTab = useMemo(() => {
    const t = new URLSearchParams(location.search).get('tab') || null;
    if (t === 'Leaderboard') return 'Holdings';
    return t;
  }, [location.search]);
  const [activeTab, setActiveTab] = useState(queryTab ?? 'Explore');
  const [stockSearchOpen, setStockSearchOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const getStocksForTab = () => {
    switch (activeTab) {
      case 'Holdings':
        return holdingsData;
      case 'ETF':
        return etfStocks;
      default:
        return popularStocks;
    }
  };

  const baseStocks = activeTab === 'Positions' ? POSITIONS_TAB_STOCKS : getStocksForTab();
  const { stocks, status } = useLiveStocks(baseStocks);
  const { indices: liveIndices } = useLiveIndices(marketIndices);
  const { positions, loading: positionsLoading } = usePaperPositions();
  const { orders, loading: ordersLoading } = usePaperOrders();
  usePendingLimitSellExecution(orders);
  const { user, logout } = useAuth();
  const desktopTopTabs = ['Explore', 'Positions', 'Orders', 'All Watchlists', 'Holdings'];
  const mobileTopTabs = ['Explore', 'Positions', 'Orders', 'All Watchlists', 'Holdings', 'ETF'];

  const mobileSectionTitle = activeTab === 'Explore' ? 'Explore' : activeTab;
  const desktopStockGridTitle =
    activeTab === 'Explore'
      ? 'Explore stocks'
      : activeTab === 'Holdings'
        ? 'Holdings'
        : activeTab === 'All Watchlist'
          ? 'All Watchlist'
          : activeTab === 'ETF'
            ? 'ETF'
            : 'Explore stocks';

  const goTab = useCallback(
    (tab: string) => {
      setActiveTab(tab);
      if (tab === 'Explore') navigate('/stocks', { replace: true });
      else navigate(`/stocks?tab=${encodeURIComponent(tab)}`, { replace: true });
    },
    [navigate],
  );
  const kiteLoginUrl = `${apiBase}/kite/login`;

  const [marketBanner, setMarketBanner] = useState<{ enabled: boolean; message: string }>({
    enabled: false,
    message: '',
  });

  useEffect(() => {
    let cancelled = false;
    const loadBanner = async () => {
      try {
        const r = await fetch(`${apiBase}/api/market-banner`);
        const d = await r.json().catch(() => ({}));
        if (cancelled || !r.ok) return;
        const fallbackMessage =
          d?.closedOn || d?.opensAt
            ? `Please note that markets are closed on ${d?.closedOn || "the scheduled date"} and will open at ${d?.opensAt || "the scheduled time"}.`
            : "";
        setMarketBanner({
          enabled: Boolean(d?.enabled),
          message: String(d?.message || fallbackMessage),
        });
      } catch {
        /* ignore */
      }
    };
    void loadBanner();
    const t = window.setInterval(loadBanner, 45000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setStockSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (queryTab) setActiveTab(queryTab);
  }, [queryTab]);

  // After trades we navigate to `?tab=Positions` while the old scroll position is preserved.
  // On mobile this makes the tab header feel "missing" until user scrolls to top.
  // Jump to top when entering Positions on small screens.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 1024) return;
    if (activeTab !== "Positions") return;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-background pb-1">
      {/* Mobile header only */}
      <div className="lg:hidden">
        <TopHeader title="Stocks" onSearchClick={() => setStockSearchOpen(true)} />
      </div>

      <div className="lg:hidden lg:px-8 lg:py-6">
        {/* Market Indices */}
        <div className="flex gap-3 overflow-x-auto px-4 py-3 lg:px-0 lg:flex-wrap scrollbar-hide">
          {liveIndices.map(index => (
            <button
              key={index.name}
              type="button"
              onClick={() => navigate(`/stock/${encodeURIComponent(index.name)}`)}
              className="w-[230px] min-w-[200px] max-w-[230px] flex-shrink-0 rounded-lg border border-border bg-card px-4 py-2.5 text-left transition-colors hover:border-primary/30"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">{index.name}</p>
                {index.foExpiryIso && isFoExpiryTagVisible(index.foExpiryIso) ? (
                  <span
                    className="shrink-0 rounded-md bg-[#eef1f5] px-2 py-0.5 text-[10px] font-medium leading-none text-[#6b7074] dark:bg-[#1E2225] dark:text-[#94989B]"
                    title={index.foExpiryIso}
                  >
                    Expiry
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 flex flex-nowrap items-baseline gap-1.5 overflow-x-auto scrollbar-hide">
                <span className="shrink-0 text-[0.75rem] font-semibold tabular-nums text-foreground">
                  {index.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span
                  className={`shrink-0 whitespace-nowrap text-[0.75rem] font-medium tabular-nums ${index.change >= 0 ? 'text-profit' : 'text-loss'}`}
                >
                  {index.change >= 0 ? '+' : ''}
                  {index.change.toFixed(2)} ({index.changePercent.toFixed(2)}%)
                </span>
              </div>
            </button>
          ))}
        </div>

        {marketBanner.enabled && marketBanner.message ? (
          <div className="border-b border-border bg-muted/35 px-4 py-2.5 text-center text-[11px] leading-snug text-muted-foreground sm:text-xs">
            {marketBanner.message}
          </div>
        ) : null}

        {/* Category Tabs */}
        <div
          className="sticky top-[0px] z-30 flex gap-2 overflow-x-auto bg-background px-4 pb-3 lg:px-0 lg:py-2 scrollbar-hide"
        >
          {mobileTopTabs.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => goTab(cat)}
              className={`flex-shrink-0 border-b-2 px-2.5 py-2 text-sm transition-colors ${
                activeTab === cat
                  ? 'border-foreground font-semibold text-foreground'
                  : 'border-transparent font-medium text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Section Title */}
        <div className="flex items-center justify-between px-4 py-3 lg:px-0">
          <h2 className="text-base font-semibold text-foreground lg:text-lg">
            {mobileSectionTitle}
          </h2>
          {status === 'auth-required' ? (
            <a
              href={kiteLoginUrl}
              className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary hover:bg-muted"
            >
              Connect Kite
            </a>
          ) : null}
        </div>

        {/* Stock Cards Grid - responsive columns */}
        {activeTab === 'Positions' ? (
          <div className="px-4 pb-6 lg:px-0">
            <PositionsPanel positions={positions} loading={positionsLoading} compact />
          </div>
        ) : activeTab === 'Orders' ? (
          <div className="px-4 pb-6 lg:px-0">
            <OrdersPanel orders={orders} loading={ordersLoading} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 px-4 lg:px-0 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 lg:gap-4">
            {stocks.map((stock) => (
              <button
                key={stock.id}
                onClick={() => navigate(`/stock/${stock.id}`)}
                className="flex flex-col items-start rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-md hover:border-primary/30 lg:p-5"
              >
                <div className="mb-3">
                  <StockLogo stock={stock} size={48} />
                </div>
                <p className="mb-1 text-sm font-medium text-foreground leading-tight">{stock.name}</p>
                <p className="text-base font-semibold text-foreground lg:text-lg">
                  ₹{stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
                <p className={`text-xs font-medium ${stock.change >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {stock.change >= 0 ? '+' : ''}₹{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                </p>
              </button>
            ))}
          </div>
        )}

      </div>

      <div className="hidden lg:block">
        <header className="border-b border-border bg-card px-4">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-10">
              <div className="flex items-center gap-6">
                <div className="flex items-center justify-center rounded-full border border-primary p-[2px]">
                  <GrowwLogo size={28} />
                </div>
                <nav className="flex items-center gap-10">
                  <button className=" text-[1.25rem] font-[600] text-foreground">Stocks</button>
                  <button className=" text-[1.25rem] font-[600] text-muted-foreground hover:text-foreground">F&O</button>
                  <button className=" text-[1.25rem] font-[600] text-muted-foreground hover:text-foreground">Mutual Funds</button>
                </nav>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <nav className="hidden items-center gap-4 text-xs font-medium text-muted-foreground lg:flex" aria-label="Brand links">
                <button type="button" onClick={() => navigate('/about-optix')} className="hover:text-foreground">
                  About Optix
                </button>
                <button type="button" onClick={() => navigate('/press')} className="hover:text-foreground">
                  Press
                </button>
              </nav>
              <button
                type="button"
                onClick={() => setStockSearchOpen(true)}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                aria-label="Search stocks"
              >
                <Search className="h-4 w-4" />
              </button>
              <button onClick={toggleTheme} className="rounded-full p-2 text-muted-foreground hover:bg-muted">
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button className="rounded-full p-2 text-muted-foreground hover:bg-muted">
                <Bell className="h-4 w-4" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-8 w-8 overflow-hidden rounded-full bg-muted">
                    <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-muted-foreground">
                      {user ? avatarInitials(user.name) : '—'}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[340px] rounded-xl border border-border bg-card p-0">
                  <div className="border-b border-border p-4">
                    <p className="text-xl font-semibold text-foreground">{user?.name ?? 'Guest'}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{user?.email ?? 'Not signed in'}</p>
                  </div>
                  {[
                    {
                      label: user
                        ? `₹${user.walletInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—',
                      sub: 'Paper wallet (Stocks, F&O)',
                    },
                    { label: 'All Orders' },
                    { label: 'Bank Details' },
                    { label: '24 x 7 Customer Support' },
                    { label: 'Reports' },
                  ].map((row) => (
                    <DropdownMenuItem key={row.label} className="flex items-center justify-between rounded-none px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{row.label}</p>
                        {row.sub && <p className="text-xs text-muted-foreground">{row.sub}</p>}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </DropdownMenuItem>
                  ))}
                  <div className="flex items-center justify-between border-t border-border px-4 py-3">
                    <button onClick={toggleTheme} className="rounded-full p-1 text-muted-foreground hover:bg-muted">
                      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        navigate('/login');
                      }}
                      className="text-sm font-semibold text-foreground underline decoration-dotted underline-offset-4"
                    >
                      Log out
                    </button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {desktopTopTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => goTab(tab)}
                className={`border-b-2 py-3 text-[1rem] font-[500] ${
                  activeTab === tab ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </header>

        <div className="border-b border-border px-4">
          <div className="flex items-center gap-8 overflow-x-auto py-4 text-sm scrollbar-hide">
            {liveIndices.slice(0, 5).map((index) => (
              <button
                key={index.name}
                type="button"
                onClick={() => navigate(`/stock/${encodeURIComponent(index.name)}`)}
                className="flex min-w-[360px] flex-shrink-0 flex-nowrap items-center gap-2 rounded px-2 py-1.5 tabular-nums transition-colors hover:bg-muted/50"
              >
                <span className="max-w-[8rem] shrink-0 truncate font-semibold text-foreground">
                  {index.name.toUpperCase()}
                </span>
                {index.foExpiryIso && isFoExpiryTagVisible(index.foExpiryIso) ? (
                  <span
                    className="shrink-0 rounded-md bg-[#eef1f5] px-2 py-0.5 text-[10px] font-medium leading-none text-[#6b7074] dark:bg-[#1E2225] dark:text-[#94989B]"
                    title={index.foExpiryIso}
                  >
                    Expiry
                  </span>
                ) : null}
                <span className="shrink-0 whitespace-nowrap text-[0.75rem] text-foreground">
                  {index.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span
                  className={`shrink-0 whitespace-nowrap text-[0.75rem] font-medium ${index.change >= 0 ? 'text-profit' : 'text-loss'}`}
                >
                  {index.change >= 0 ? '+' : ''}
                  {index.change.toFixed(2)} ({index.changePercent.toFixed(2)}%)
                </span>
              </button>
            ))}
          </div>
        </div>

        {marketBanner.enabled && marketBanner.message ? (
          <div className="border-b border-border bg-muted/35 px-4 py-2.5 text-center text-xs leading-snug text-muted-foreground">
            {marketBanner.message}
          </div>
        ) : null}

        <div className="grid grid-cols-12 gap-6 px-4 py-6">
          <div className="col-span-12">
            {activeTab === 'Positions' ? (
              <div className="mb-4">
                <h2 className="mb-4 text-[1.25rem] font-semibold text-foreground">Positions</h2>
                <PositionsPanel positions={positions} loading={positionsLoading} />
              </div>
            ) : activeTab === 'Orders' ? (
              <div className="mb-4">
                <h2 className="mb-4 text-[1.25rem] font-semibold text-foreground">Orders</h2>
                <OrdersPanel orders={orders} loading={ordersLoading} />
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[1.25rem] font-semibold text-foreground">{desktopStockGridTitle}</h2>
                  {status === 'auth-required' ? (
                    <a
                      href={kiteLoginUrl}
                      className="rounded-full border border-border px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-primary hover:bg-muted"
                    >
                      Connect Kite
                    </a>
                  ) : null}
                </div>
                <div className="mb-4 grid grid-cols-4 gap-3">
                  {stocks.slice(0, 4).map((stock) => (
                    <button
                      key={stock.id}
                      onClick={() => navigate(`/stock/${stock.id}`)}
                      className="rounded-xl border border-border bg-card p-4 text-left hover:shadow-sm"
                    >
                      <div className="mb-3">
                        <StockLogo stock={stock} size={40} />
                      </div>
                      <p className="text-sm font-medium text-foreground">{stock.name}</p>
                      <p className="mt-2 text-lg font-semibold text-foreground">₹{stock.price.toFixed(2)}</p>
                      <p className={`text-sm ${stock.change >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                      </p>
                    </button>
                  ))}
                </div>

                <button className="mb-8 text-sm font-semibold text-primary">See more</button>
              </>
            )}

          </div>
        </div>
      </div>

      <StockSearchDialog open={stockSearchOpen} onOpenChange={setStockSearchOpen} />
    </div>
  );
};

export default StocksPage;
