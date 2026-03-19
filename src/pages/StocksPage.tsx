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
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      {/* Mobile header only */}
      <div className="lg:hidden">
        <TopHeader title="Stocks" />
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block border-b border-border bg-card px-8 py-5">
        <h1 className="text-2xl font-bold text-foreground">Stocks</h1>
      </div>

      <div className="lg:px-8 lg:py-6">
        {/* Market Indices */}
        <div className="flex gap-3 overflow-x-auto px-4 py-3 lg:px-0 lg:flex-wrap scrollbar-hide">
          {marketIndices.map(index => (
            <div key={index.name} className="flex-shrink-0 rounded-lg border border-border bg-card px-4 py-2.5 lg:px-6 lg:py-4 lg:min-w-[220px]">
              <p className="text-xs font-medium text-muted-foreground lg:text-sm">{index.name}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-semibold text-foreground lg:text-lg">
                  {index.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className={`text-xs font-medium lg:text-sm ${index.change >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)} ({index.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 lg:px-0 lg:py-2 scrollbar-hide">
          {stockCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === cat
                  ? 'bg-foreground text-background'
                  : 'border border-border bg-card text-foreground hover:bg-muted'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Section Title */}
        <div className="px-4 py-3 lg:px-0">
          <h2 className="text-base font-semibold text-foreground lg:text-lg">
            {activeTab === 'Explore' ? 'Most bought on Groww' : activeTab === 'Holdings' ? 'Your Holdings' : activeTab}
          </h2>
        </div>

        {/* Stock Cards Grid - responsive columns */}
        <div className="grid grid-cols-2 gap-3 px-4 lg:px-0 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 lg:gap-4">
          {stocks.map(stock => (
            <button
              key={stock.id}
              onClick={() => navigate(`/stock/${stock.id}`)}
              className="flex flex-col items-start rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-md hover:border-primary/30 lg:p-5"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground lg:h-12 lg:w-12 lg:text-sm">
                {stock.symbol.slice(0, 3)}
              </div>
              <p className="mb-1 text-sm font-medium text-foreground leading-tight">{stock.name}</p>
              <p className="text-base font-semibold text-foreground lg:text-lg">₹{stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              <p className={`text-xs font-medium ${stock.change >= 0 ? 'text-profit' : 'text-loss'}`}>
                {stock.change >= 0 ? '+' : ''}₹{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
              </p>
            </button>
          ))}
        </div>

        {/* Products & Tools */}
        <div className="px-4 py-6 lg:px-0">
          <h2 className="mb-4 text-base font-semibold text-foreground lg:text-lg">Product & Tools</h2>
          <div className="grid grid-cols-4 gap-4 lg:grid-cols-8 lg:gap-6">
            {[
              { label: 'F&O', emoji: '📊' },
              { label: 'Events', emoji: '📅' },
              { label: 'IPO', emoji: '🚀' },
              { label: 'All Stocks', emoji: '📈' },
            ].map(item => (
              <div key={item.label} className="flex flex-col items-center gap-1.5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-2xl hover:bg-accent transition-colors cursor-pointer">
                  {item.emoji}
                </div>
                <span className="text-xs font-medium text-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StocksPage;
