import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Bookmark, Search } from 'lucide-react';
import { popularStocks, holdingsData, etfStocks, generateChartData } from '@/data/mockData';

const timeRanges = ['1D', '1W', '1M', '1Y', '5Y', 'ALL'];

const StockDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeRange, setActiveRange] = useState('1D');
  const [activeTab, setActiveTab] = useState('Overview');

  const allStocks = [...popularStocks, ...holdingsData, ...etfStocks];
  const stock = allStocks.find(s => s.id === id) || popularStocks[0];

  const daysMap: Record<string, number> = { '1D': 1, '1W': 7, '1M': 30, '1Y': 365, '5Y': 1825, 'ALL': 3650 };
  const chartData = useMemo(() => generateChartData(daysMap[activeRange] || 30, stock.price), [activeRange, stock.price]);

  // Simple SVG line chart
  const minPrice = Math.min(...chartData.map(d => d.price));
  const maxPrice = Math.max(...chartData.map(d => d.price));
  const range = maxPrice - minPrice || 1;
  const width = 350;
  const height = 160;

  const points = chartData.map((d, i) => {
    const x = (i / (chartData.length - 1)) * width;
    const y = height - ((d.price - minPrice) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const isPositive = stock.change >= 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-4">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <Bookmark className="h-5 w-5 text-muted-foreground" />
          <Search className="h-5 w-5 text-muted-foreground" />
        </div>
      </header>

      <div className="px-4 py-4">
        {/* Stock Logo + Name */}
        <div className="mb-1 flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-bold text-muted-foreground">
          {stock.symbol.slice(0, 3)}
        </div>
        <h1 className="mt-2 text-lg font-semibold text-foreground">{stock.name}</h1>
        <p className="text-2xl font-bold text-foreground">₹{stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isPositive ? 'text-profit' : 'text-loss'}`}>
            {isPositive ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
          </span>
          <span className="text-xs text-muted-foreground">{activeRange}</span>
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            {stock.sector}
          </span>
        </div>

        {/* Chart */}
        <div className="my-6">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isPositive ? 'hsl(164 100% 41%)' : 'hsl(0 72% 51%)'} stopOpacity="0.2" />
                <stop offset="100%" stopColor={isPositive ? 'hsl(164 100% 41%)' : 'hsl(0 72% 51%)'} stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon
              points={`0,${height} ${points} ${width},${height}`}
              fill="url(#chartGrad)"
            />
            <polyline
              points={points}
              fill="none"
              stroke={isPositive ? 'hsl(164 100% 41%)' : 'hsl(0 72% 51%)'}
              strokeWidth="2"
            />
          </svg>
          {/* Dotted line */}
          <div className="border-t border-dashed border-muted-foreground/30" />
        </div>

        {/* Time Range Selector */}
        <div className="mb-6 flex items-center gap-1">
          <span className="mr-2 text-xs font-medium text-muted-foreground">NSE</span>
          {timeRanges.map(r => (
            <button
              key={r}
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

        {/* Create SIP Card */}
        <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-card p-4">
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

        {/* Tabs */}
        <div className="flex border-b border-border">
          {['Overview', 'News', 'Events'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="py-4">
          {activeTab === 'Overview' && (
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">About {stock.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {stock.name} is a leading company in the {stock.sector} sector listed on {stock.exchange}. 
                  The stock has shown consistent performance and is one of the most traded stocks on the exchange.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Open', value: `₹${(stock.price - stock.change).toFixed(2)}` },
                  { label: 'High', value: `₹${(stock.price * 1.02).toFixed(2)}` },
                  { label: 'Low', value: `₹${(stock.price * 0.98).toFixed(2)}` },
                  { label: 'Prev Close', value: `₹${(stock.price - stock.change).toFixed(2)}` },
                  { label: 'Volume', value: '12.4M' },
                  { label: 'Market Cap', value: '₹1.2L Cr' },
                ].map(item => (
                  <div key={item.label} className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-semibold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab === 'News' && (
            <p className="text-sm text-muted-foreground">No recent news available for {stock.name}.</p>
          )}
          {activeTab === 'Events' && (
            <p className="text-sm text-muted-foreground">No upcoming events for {stock.name}.</p>
          )}
        </div>
      </div>

      {/* Buy/Sell Footer */}
      <div className="fixed bottom-0 left-0 right-0 flex gap-3 border-t border-border bg-card p-4">
        <button className="flex-1 rounded-lg bg-loss py-3 text-sm font-semibold text-primary-foreground">
          Sell
        </button>
        <button className="flex-1 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground">
          Buy
        </button>
      </div>
    </div>
  );
};

export default StockDetailPage;
