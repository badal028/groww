import React from "react";
import { Link } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import SeoPublicShell from "./SeoPublicShell";

export default function AboutGrowwTraderPage() {
  return (
    <SeoPublicShell>
      <SeoHead
        title="About GrowwTrader | Paper trading, leagues &amp; contests"
        description="GrowwTrader is a paper trading platform with Practice and Prize leagues, stocks and F&amp;O, and daily leaderboards. Learn more and sign up."
        canonicalPath="/about/growwtrader"
      />
      <h1 className="text-2xl font-semibold tracking-tight">About GrowwTrader</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        <strong className="text-foreground">GrowwTrader</strong> (growwtrader.in) helps people practise trading with virtual money, join daily leagues,
        and compare performance on leaderboards. We combine a simple investing-app-style experience with contest mechanics for engagement.
      </p>
      <h2 className="mt-8 text-lg font-semibold">Search &amp; brand note</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        People often discover us while looking for investing apps, paper trading, or league-style trading products in India.{" "}
        <strong className="text-foreground">GrowwTrader is an independent product</strong> and not affiliated with other companies that may have similar
        sounding names.
      </p>
      <h2 className="mt-8 text-lg font-semibold">Explore</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>
          <Link to="/learn/paper-trading-league" className="text-primary underline">
            Paper trading league
          </Link>
        </li>
        <li>
          <Link to="/learn/stock-trading-contest-india" className="text-primary underline">
            Stock trading contest India
          </Link>
        </li>
        <li>
          <Link to="/learn/fantasy-style-stock-league" className="text-primary underline">
            Fantasy-style stock league
          </Link>
        </li>
      </ul>
      <div className="mt-8">
        <Link to="/login" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Sign in or register
        </Link>
      </div>
    </SeoPublicShell>
  );
}
