import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StockLogo from '@/components/StockLogo';
import { StockSearchDialog } from '@/components/StockSearch';
import TopHeader from '@/components/TopHeader';
import DesktopHeader from '@/components/DesktopHeader';
import {
  popularStocks,
  holdingsData,
  etfStocks,
  marketIndices,
  additionalSearchStocks,
  generateChartData,
} from '@/data/mockData';
import { usePaperTrading } from '@/hooks/usePaperTrading';
import { resolveKiteKeyForStock } from '@/services/marketData';
import { useLiveStockDetail } from '@/hooks/useLiveStockDetail';
import { toast } from 'sonner';
import { showOrderExecutedToast } from '@/utils/tradingToasts';
import FoOptionChainModal, { type FoContract } from '@/components/fo/FoOptionChainModal';
import FoTradeModal from '@/components/fo/FoTradeModal';
import EquityTradeBlock from '@/components/EquityTradeBlock';

const timeRanges = ['1D', '1W', '1M', '1Y', '5Y', 'ALL'];

const CHART_W = 380;
const CHART_H = 208;
const PAD = 10;
const INNER_W = CHART_W - PAD * 2;
const INNER_H = CHART_H - PAD * 2;

const StockDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeRange, setActiveRange] = useState('1D');
  const [activeTab, setActiveTab] = useState('Overview');
  const { placeOrder, placing } = usePaperTrading();
  const [optionChainOpen, setOptionChainOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<FoContract | null>(null);
  const [stockSearchOpen, setStockSearchOpen] = useState(false);

  const baseStock = useMemo(() => {
    const indexStocks = marketIndices.map((idx) => ({
      id: idx.name,
      name: idx.name,
      symbol: idx.name,
      price: idx.value,
      change: idx.change,
      changePercent: idx.changePercent,
      sector: 'Index',
      exchange: 'INDEX',
    }));
    const allStocks = [
      ...popularStocks,
      ...holdingsData,
      ...etfStocks,
      ...indexStocks,
      ...additionalSearchStocks,
    ];
    return allStocks.find((s) => s.id === id) || popularStocks[0];
  }, [id]);

  const { displayStock, series1d, status: quoteStatus, liveOhlc } = useLiveStockDetail(
    baseStock,
    activeRange,
  );

  const daysMap: Record<string, number> = {
    '1D': 1,
    '1W': 7,
    '1M': 30,
    '1Y': 365,
    '5Y': 1825,
    ALL: 3650,
  };

  const chartLayout = useMemo(() => {
    if (activeRange === '1D' && series1d.length >= 2) {
      const ts = series1d.map((p) => p.t);
      const tMin = Math.min(...ts);
      const tMax = Math.max(...ts);
      const spanT = tMax - tMin || 1;
      const prices = series1d.map((p) => p.price);
      const minP = Math.min(...prices);
      const maxP = Math.max(...prices);
      const spanP = maxP - minP || 1;
      const padY = Math.max(spanP * 0.08, minP * 0.0002);
      const pMin = minP - padY;
      const pMax = maxP + padY;
      const spanP2 = pMax - pMin || 1;

      const points = series1d
        .map((p) => {
          const x = PAD + ((p.t - tMin) / spanT) * INNER_W;
          const y = PAD + INNER_H - ((p.price - pMin) / spanP2) * INNER_H;
          return `${x},${y}`;
        })
        .join(' ');

      return { points, live: true as const };
    }

    const data = generateChartData(daysMap[activeRange] || 30, displayStock.price);
    const minPrice = Math.min(...data.map((d) => d.price));
    const maxPrice = Math.max(...data.map((d) => d.price));
    const range = maxPrice - minPrice || 1;
    const padY = range * 0.08;
    const pMin = minPrice - padY;
    const pMax = maxPrice + padY;
    const range2 = pMax - pMin || 1;

    const points = data
      .map((d, i) => {
        const x = PAD + (i / Math.max(1, data.length - 1)) * INNER_W;
        const y = PAD + INNER_H - ((d.price - pMin) / range2) * INNER_H;
        return `${x},${y}`;
      })
      .join(' ');

    return { points, live: false as const };
  }, [activeRange, series1d, displayStock.price]);

  const isPositive = displayStock.change >= 0;
  // SVG gradient ids must not contain spaces/special chars, otherwise `url(#id)` may fail
  // and the area fill can fallback to a solid black background.
  const gradId = `detailChart-${String(displayStock.id).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const stroke = isPositive ? 'hsl(164 100% 41%)' : 'hsl(0 72% 51%)';

  const exchangeLabel =
    displayStock.sector === 'Index'
      ? displayStock.symbol === 'SENSEX'
        ? 'BSE'
        : 'NSE'
      : displayStock.exchange === 'NSE'
        ? 'NSE'
        : 'NSE';

  const quoteBadge =
    quoteStatus === 'live'
      ? { text: 'Live', className: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' }
      : quoteStatus === 'auth-required'
        ? { text: 'Login data', className: 'border-amber-500/40 text-amber-600' }
        : quoteStatus === 'simulated'
          ? { text: 'Simulated', className: 'border-border text-muted-foreground' }
          : { text: 'Delayed', className: 'border-border text-muted-foreground' };

  const handleEquityOrder = async (side: 'BUY' | 'SELL', quantity: number) => {
    const kiteKey = resolveKiteKeyForStock(displayStock);
    const result = await placeOrder({
      symbol: displayStock.symbol,
      side,
      quantity,
      price: displayStock.price,
      orderMode: 'MARKET',
      instrumentType: 'EQ',
      product: 'NRML',
      ...(kiteKey ? { kiteSymbol: kiteKey } : {}),
    });
    if (!result.ok) {
      toast.error(result.message || 'Order failed');
      return;
    }
    showOrderExecutedToast(side);
    // Navigate to Positions after a filled order
    navigate('/stocks?tab=Positions');
  };

  const overviewStats = useMemo(() => {
    if (liveOhlc) {
      return [
        { label: 'Open', value: `₹${liveOhlc.open.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
        { label: 'High', value: `₹${liveOhlc.high.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
        { label: 'Low', value: `₹${liveOhlc.low.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
        {
          label: 'Prev close',
          value: `₹${liveOhlc.close.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        },
        { label: 'Volume', value: '—' },
        { label: 'Market Cap', value: displayStock.sector === 'Index' ? '—' : '—' },
      ];
    }
    return [
      { label: 'Open', value: `₹${(displayStock.price - displayStock.change).toFixed(2)}` },
      { label: 'High', value: `₹${(displayStock.price * 1.02).toFixed(2)}` },
      { label: 'Low', value: `₹${(displayStock.price * 0.98).toFixed(2)}` },
      { label: 'Prev Close', value: `₹${(displayStock.price - displayStock.change).toFixed(2)}` },
      { label: 'Volume', value: '12.4M' },
      { label: 'Market Cap', value: '₹1.2L Cr' },
    ];
  }, [liveOhlc, displayStock.price, displayStock.change, displayStock.sector]);

  return (
    <div className="min-h-screen bg-background pb-[min(280px,42vh)] lg:pb-0">
      <div className="lg:hidden">
        <TopHeader
          title={displayStock.name}
          showBackButton
          onBackClick={() => navigate(-1)}
          onSearchClick={() => setStockSearchOpen(true)}
        />
      </div>
      <div className="hidden lg:block">
        <DesktopHeader title={displayStock.name} />
      </div>

      <StockSearchDialog open={stockSearchOpen} onOpenChange={setStockSearchOpen} />

      <div className="lg:flex lg:gap-8 lg:px-8 lg:py-6">
        <div className="px-4 py-4 lg:px-0 lg:flex-1">
          <StockLogo stock={displayStock} size={40} rounded="md" className="mb-1" />
          <h1 className="mt-2 text-lg font-semibold text-foreground lg:text-2xl">{displayStock.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p
              key={displayStock.price}
              className="text-2xl font-bold text-foreground transition-all duration-300 animate-in fade-in lg:text-3xl"
            >
              ₹{displayStock.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${quoteBadge.className}`}
            >
              {quoteBadge.text}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isPositive ? 'text-profit' : 'text-loss'}`}>
              {isPositive ? '+' : ''}
              {displayStock.change.toFixed(2)} ({displayStock.changePercent.toFixed(2)}%)
            </span>
            <span className="text-xs text-muted-foreground">{activeRange}</span>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {displayStock.sector}
            </span>
          </div>
          {activeRange === '1D' && chartLayout.live && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              1D chart updates every few seconds from live LTP (Groww-style moving line). Other ranges are illustrative.
            </p>
          )}

          <div className="my-6 rounded-xl border border-border/60 bg-card/30 p-2">
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              className="w-full touch-none"
              preserveAspectRatio="none"
              style={{ maxHeight: '280px' }}
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((frac) => (
                <line
                  key={frac}
                  x1={PAD}
                  y1={PAD + INNER_H * frac}
                  x2={CHART_W - PAD}
                  y2={PAD + INNER_H * frac}
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-border"
                  opacity={0.45}
                />
              ))}
              <polygon
                points={`${PAD},${CHART_H - PAD} ${chartLayout.points} ${CHART_W - PAD},${CHART_H - PAD}`}
                fill={`url(#${gradId})`}
              />
              <polyline
                points={chartLayout.points}
                fill="none"
                stroke={stroke}
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="mx-2 border-t border-dashed border-muted-foreground/25" />
          </div>

          <div className="mb-6 flex items-center gap-1">
            <span className="mr-2 text-xs font-medium text-muted-foreground">{exchangeLabel}</span>
            {timeRanges.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setActiveRange(r)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activeRange === r
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <EquityTradeBlock
            className="mb-6 hidden lg:block"
            stock={displayStock}
            price={displayStock.price}
            placing={placing}
            onSubmit={handleEquityOrder}
          />
        </div>

        <div className="px-4 lg:px-0 lg:w-[380px] lg:flex-shrink-0">
          <div className="mb-6 flex cursor-pointer items-center justify-between rounded-xl border border-border bg-card p-4 transition-shadow hover:border-primary/20 hover:shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <span className="text-lg">📦</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Create Stock SIP</p>
                <p className="text-xs text-muted-foreground">Automate your investments in this stock</p>
              </div>
            </div>
            <span className="text-muted-foreground">›</span>
          </div>

          <div className="flex border-b border-border">
            {['Overview', 'News', 'Events', 'F&O'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  if (tab === 'F&O') {
                    setOptionChainOpen(true);
                    setActiveTab('Overview');
                    return;
                  }
                  setActiveTab(tab);
                }}
                className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                  activeTab === tab ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="py-4">
            {activeTab === 'Overview' && (
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">About {displayStock.name}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {displayStock.sector === 'Index'
                      ? `${displayStock.name} is a market index. Options (F&O) and index levels update from your connected market data feed.`
                      : `${displayStock.name} is listed on ${displayStock.exchange}. Prices on this page refresh from your market data provider when configured.`}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {overviewStats.map((item) => (
                    <div key={item.label} className="rounded-lg bg-muted p-3">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-semibold text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'News' && (
              <p className="text-sm text-muted-foreground">No recent news available for {displayStock.name}.</p>
            )}
            {activeTab === 'Events' && (
              <p className="text-sm text-muted-foreground">No upcoming events for {displayStock.name}.</p>
            )}
          </div>
        </div>
      </div>

      <div
        className={`fixed bottom-0 left-0 right-0 z-30 lg:hidden ${
          optionChainOpen || tradeOpen ? 'hidden' : ''
        }`}
      >
        <EquityTradeBlock
          variant="bar"
          stock={displayStock}
          price={displayStock.price}
          placing={placing}
          onSubmit={handleEquityOrder}
        />
      </div>

      <FoOptionChainModal
        open={optionChainOpen}
        onOpenChange={(o) => {
          setOptionChainOpen(o);
          if (!o) setActiveTab('Overview');
        }}
        underlying={displayStock}
        expiryLabel="19 Mar"
        onSelect={(contract) => {
          setSelectedContract(contract);
          setOptionChainOpen(false);
          setTradeOpen(true);
        }}
      />

      <FoTradeModal
        open={tradeOpen}
        onOpenChange={(o) => {
          setTradeOpen(o);
          if (!o) setSelectedContract(null);
        }}
        contract={selectedContract}
      />
    </div>
  );
};

export default StockDetailPage;
