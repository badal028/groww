import React from "react";
import { Link } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import SeoPublicShell from "./SeoPublicShell";

const tg = import.meta.env.VITE_OPTIX_TELEGRAM_URL as string | undefined;
const ig = import.meta.env.VITE_OPTIX_INSTAGRAM_URL as string | undefined;

export default function AboutOptixPage() {
  return (
    <SeoPublicShell>
      <SeoHead
        title="About Optix Trades | F&amp;O Trader — GrowwTrader"
        description="Optix Trades is the F&amp;O trading brand behind GrowwTrader, our paper trading platform. Official Telegram and Instagram."
        canonicalPath="/about-optix"
      />

      {/* Mobile: minimal official links only (full story desktop-only). */}
      <div className="lg:hidden rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">Optix Trades | F&amp;O Trader</p>
        <p className="mt-2 text-xs text-muted-foreground">Official links:</p>
        <div className="mt-3 flex flex-col gap-2">
          {tg ? (
            <a href={tg} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline">
              Telegram
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">Telegram: configure VITE_OPTIX_TELEGRAM_URL</span>
          )}
          {ig ? (
            <a href={ig} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline">
              Instagram
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">Instagram: configure VITE_OPTIX_INSTAGRAM_URL</span>
          )}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Open this page on a laptop or desktop for the full About section.</p>
      </div>

      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold tracking-tight">About Optix Trades</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">Optix Trades | F&amp;O Trader</p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Optix Trades</strong> is a derivatives-focused trading brand built around F&amp;O strategies, market analysis,
          and educational signals. We share perspective and ideas to help traders think in terms of risk, context, and discipline—not financial advice.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          <strong className="text-foreground">GrowwTrader</strong> is our paper trading product: a practice environment where you can place virtual orders,
          explore stocks and F&amp;O-style flows, and build habits without putting real capital at risk. The platform exists so you can rehearse execution and
          journaling before or alongside live markets.
        </p>
        <h2 className="mt-8 text-lg font-semibold">Brand vs product</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Optix Trades</strong> — the brand and voice (analysis, community, F&amp;O focus).
          </li>
          <li>
            <strong className="text-foreground">GrowwTrader</strong> — the app you use for paper trading and contests.
          </li>
        </ul>
        <h2 className="mt-8 text-lg font-semibold">Official channels</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Telegram:{" "}
            {tg ? (
              <a href={tg} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                {tg}
              </a>
            ) : (
              <span>(set VITE_OPTIX_TELEGRAM_URL in your environment)</span>
            )}
          </li>
          <li>
            Instagram:{" "}
            {ig ? (
              <a href={ig} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                {ig}
              </a>
            ) : (
              <span>(set VITE_OPTIX_INSTAGRAM_URL in your environment)</span>
            )}
          </li>
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/press" className="inline-flex rounded-lg border border-border px-4 py-2 text-sm font-semibold">
            Press / Media
          </Link>
          <Link to="/about/growwtrader" className="inline-flex rounded-lg border border-border px-4 py-2 text-sm font-semibold">
            About GrowwTrader
          </Link>
          <Link to="/login" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Sign in
          </Link>
        </div>
      </div>
    </SeoPublicShell>
  );
}
