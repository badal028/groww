import React from "react";
import { Link } from "react-router-dom";
import GrowwLogo from "@/components/GrowwLogo";

export default function SeoPublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary p-0.5">
              <GrowwLogo size={24} />
            </span>
            GrowwTrader
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <Link to="/login" className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
      <footer className="border-t border-border px-4 py-8 text-center text-[11px] text-muted-foreground">
        <p className="mx-auto max-w-2xl">
          GrowwTrader is an independent paper-trading and contest platform. We are not affiliated with, endorsed by, or connected to any third-party
          brokerage or app. Trading contests use virtual balances only unless stated otherwise.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1">
          <Link to="/learn/paper-trading-league" className="underline">
            Paper trading league
          </Link>
          <Link to="/learn/stock-trading-contest-india" className="underline">
            Stock contest India
          </Link>
          <Link to="/learn/fantasy-style-stock-league" className="underline">
            Fantasy-style league
          </Link>
          <Link to="/about/growwtrader" className="underline">
            About GrowwTrader
          </Link>
          <Link to="/about-optix" className="max-lg:hidden underline">
            About Optix Trades
          </Link>
          <Link to="/press" className="max-lg:hidden underline">
            Press / Media
          </Link>
        </div>
      </footer>
    </div>
  );
}
