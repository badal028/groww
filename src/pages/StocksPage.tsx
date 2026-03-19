import React, { useState } from 'react';
import TopHeader from '@/components/TopHeader';
import { marketIndices, popularStocks, etfStocks, holdingsData, stockCategories } from '@/data/mockData';
import { useNavigate } from 'react-router-dom';

const StocksPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Explore');
  const navigate = useNavigate();

  const getStocksForTab = () => {
    switch (activeTab) {
      case 'Holdings': return holdingsData;
      case 'ETF': return etfStocks;
      default: return popularStocks;
    }
  };

  const stocks = getStocksForTab();

  return (
    <div className="min-h-screen bg-background pb-16">
      <TopHeader title="Stocks" />

      {/* Market Indices */}
      <div className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-hide">
        {marketIndices.map(index => (
          <div key={index.name} className="flex-shrink-0 rounded-lg border border-border bg-card px-4 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">{index.name}</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-semibold text-foreground">
                {index.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span className={`text-xs font-medium ${index.change >= 0 ? 'text-profit' : 'text-loss'}`}>
                {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)} ({index.changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
        {stockCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === cat
                ? 'bg-foreground text-background'
                : 'border border-border bg-card text-foreground'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Section Title */}
      <div className="px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">
          {activeTab === 'Explore' ? 'Most bought on Groww' : activeTab === 'Holdings' ? 'Your Holdings' : activeTab}
        </h2>
      </div>

      {/* Stock Cards Grid */}
      <div className="grid grid-cols-2 gap-3 px-4">
        {stocks.map(stock => (
          <button
            key={stock.id}
            onClick={() => navigate(`/stock/${stock.id}`)}
            className="flex flex-col items-start rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
              {stock.symbol.slice(0, 3)}
            </div>
            <p className="mb-1 text-sm font-medium text-foreground leading-tight">{stock.name}</p>
            <p className="text-base font-semibold text-foreground">₹{stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            <p className={`text-xs font-medium ${stock.change >= 0 ? 'text-profit' : 'text-loss'}`}>
              {stock.change >= 0 ? '+' : ''}₹{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
            </p>
          </button>
        ))}
      </div>

      {/* Products & Tools */}
      <div className="px-4 py-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Product & Tools</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'F&O', emoji: '📊' },
            { label: 'Events', emoji: '📅' },
            { label: 'IPO', emoji: '🚀' },
            { label: 'All Stocks', emoji: '📈' },
          ].map(item => (
            <div key={item.label} className="flex flex-col items-center gap-1.5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-2xl">
                {item.emoji}
              </div>
              <span className="text-xs font-medium text-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StocksPage;
