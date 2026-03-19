import React, { useState } from 'react';
import TopHeader from '@/components/TopHeader';
import { mutualFunds } from '@/data/mockData';

const tabs = ['Explore', 'Dashboard', 'SIPs', 'Watchlist'];

const MutualFundsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Dashboard');

  const totalCurrent = mutualFunds.reduce((s, f) => s + f.currentValue, 0);
  const totalInvested = mutualFunds.reduce((s, f) => s + f.investedValue, 0);
  const totalReturns = totalCurrent - totalInvested;
  const totalReturnsPercent = ((totalReturns / totalInvested) * 100);
  const xirr = 37.67;

  return (
    <div className="min-h-screen bg-background pb-16">
      <TopHeader title="Mutual Funds" />

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-foreground text-background'
                : 'border border-border bg-card text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Dashboard' && (
        <div className="px-4">
          <h2 className="mb-3 text-base font-semibold text-foreground">Investments ({mutualFunds.length})</h2>
          
          {/* Summary Card */}
          <div className="mb-4 rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Current</p>
                <p className="text-lg font-bold text-foreground">₹{totalCurrent.toLocaleString('en-IN')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total Returns</p>
                <p className="text-lg font-bold text-profit">
                  + ₹{totalReturns.toLocaleString('en-IN')} ({totalReturnsPercent.toFixed(2)}%)
                </p>
              </div>
            </div>
            <div className="flex justify-between border-t border-border pt-3">
              <div>
                <p className="text-xs text-muted-foreground">Invested</p>
                <p className="text-sm font-semibold text-foreground">₹{totalInvested.toLocaleString('en-IN')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">1D Returns</p>
                <p className="text-sm font-semibold text-profit">+ ₹689.07(0.32%)</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">XIRR {xirr}%</span>
              <button className="flex items-center gap-1 text-xs font-medium text-primary">
                📊 Portfolio analysis
              </button>
            </div>
          </div>

          {/* Sort */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Sort</span>
              <span>☰</span>
            </div>
            <span className="text-xs text-muted-foreground">‹ › Current (Invested)</span>
          </div>

          {/* Fund List */}
          <div className="space-y-1">
            {mutualFunds.map(fund => (
              <div key={fund.id} className="flex items-center justify-between border-b border-border py-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground leading-tight">{fund.name}</p>
                  <p className="text-xs text-muted-foreground">{fund.type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">₹{fund.currentValue.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-muted-foreground">({fund.investedValue.toLocaleString('en-IN')})</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Explore' && (
        <div className="px-4 py-4">
          <h2 className="mb-4 text-base font-semibold text-foreground">Popular Funds</h2>
          <p className="text-sm text-muted-foreground">Explore mutual funds coming soon...</p>
        </div>
      )}

      {activeTab === 'SIPs' && (
        <div className="px-4 py-4">
          <h2 className="mb-4 text-base font-semibold text-foreground">Your SIPs</h2>
          <p className="text-sm text-muted-foreground">SIP management coming soon...</p>
        </div>
      )}

      {activeTab === 'Watchlist' && (
        <div className="px-4 py-4">
          <h2 className="mb-4 text-base font-semibold text-foreground">Watchlist</h2>
          <p className="text-sm text-muted-foreground">Your watchlist is empty.</p>
        </div>
      )}
    </div>
  );
};

export default MutualFundsPage;
