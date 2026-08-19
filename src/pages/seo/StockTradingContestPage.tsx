import React from "react";
import { Link } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import SeoPublicShell from "./SeoPublicShell";

export default function StockTradingContestPage() {
  return (
    <SeoPublicShell>
      <SeoHead
        title="Stock trading contest India | Daily league &amp; prizes | GrowwTrader"
        description="Daily stock and F&amp;O trading contest on GrowwTrader. Virtual trading, live leaderboard, optional prize pool. Join the Indian paper-trading community."
        canonicalPath="/learn/stock-trading-contest-india"
      />
      <h1 className="text-2xl font-semibold tracking-tight">Stock trading contest in India</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        GrowwTrader hosts <strong className="text-foreground">daily trading contests</strong> built around session P&amp;L. Everyone can see how they rank
        in the free Practice league; Prize league entry is optional and subject to rules shown in the app.
      </p>
      <h2 className="mt-8 text-lg font-semibold">Who is it for?</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Traders and students who want structured competition, leaderboard feedback, and a community around paper trading — without mixing it with live
        brokerage accounts on day one.
      </p>
      <h2 className="mt-8 text-lg font-semibold">Related pages</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>
          <Link to="/learn/paper-trading-league" className="text-primary underline">
            Paper trading league
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
          Join GrowwTrader
        </Link>
      </div>
    </SeoPublicShell>
  );
}
