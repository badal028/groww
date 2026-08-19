import React from "react";
import { Link } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import SeoPublicShell from "./SeoPublicShell";

export default function FantasyStyleStockLeaguePage() {
  return (
    <SeoPublicShell>
      <SeoHead
        title="Fantasy-style stock league | Virtual trading competition | GrowwTrader"
        description="Fantasy sports–style stock league: pick strategies, trade on virtual money, climb the leaderboard. GrowwTrader — paper trading for India."
        canonicalPath="/learn/fantasy-style-stock-league"
      />
      <h1 className="text-2xl font-semibold tracking-tight">Fantasy-style stock league</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Think of it like a <strong className="text-foreground">fantasy league for markets</strong>: you compete on performance over a defined session
        using a virtual balance, instead of cricket or football points. GrowwTrader focuses on transparent, session-based P&amp;L and live rankings.
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        This is <strong className="text-foreground">not</strong> a prediction game with fixed teams — you place paper trades and outcomes follow real
        market prices (as implemented in our app).
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/login" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Start on GrowwTrader
        </Link>
        <Link to="/about/growwtrader" className="rounded-lg border border-border px-4 py-2 text-sm font-medium">
          What is GrowwTrader?
        </Link>
      </div>
    </SeoPublicShell>
  );
}
