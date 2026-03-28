import React from "react";
import { Link } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import SeoPublicShell from "./SeoPublicShell";

export default function PaperTradingLeaguePage() {
  return (
    <SeoPublicShell>
      <SeoHead
        title="Paper trading league India | Virtual stock & F&amp;O contest | GrowwTrader"
        description="Join a daily paper trading league on GrowwTrader. Trade stocks and F&amp;O on virtual balance, live leaderboard, Practice and Prize leagues. Sign up free."
        canonicalPath="/learn/paper-trading-league"
      />
      <h1 className="text-2xl font-semibold tracking-tight">Paper trading league (India)</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        GrowwTrader runs a <strong className="text-foreground">paper trading league</strong> where you practise buying and selling with a virtual wallet.
        Compete on a live P&amp;L leaderboard for the session. We offer a free Practice league for everyone and an optional Prize league for paid
        participants.
      </p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        <li>Stocks and F&amp;O on virtual balance during market hours</li>
        <li>Daily session ranking (IST)</li>
        <li>Separate Practice (free) and Prize (paid) leaderboards</li>
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">
        If you enjoy investing apps and want to sharpen skills without risking real money first, paper leagues are a low-pressure way to learn execution
        and discipline.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/login" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Create free account
        </Link>
        <Link to="/learn/stock-trading-contest-india" className="rounded-lg border border-border px-4 py-2 text-sm font-medium">
          Stock trading contest →
        </Link>
      </div>
    </SeoPublicShell>
  );
}
