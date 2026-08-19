import React from "react";
import { Link } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import SeoPublicShell from "./SeoPublicShell";

const OFFICIAL_TELEGRAM =
  (import.meta.env.VITE_OPTIX_TELEGRAM_URL as string | undefined)?.trim() || "https://t.me/optixtrade";
const OFFICIAL_INSTAGRAM =
  (import.meta.env.VITE_OPTIX_INSTAGRAM_URL as string | undefined)?.trim() || "https://instagram.com/optixtrade";

const COVERAGE_ITEMS = [
  {
    title: "How Optix Trades is Helping Traders Learn F&O Safely with GrowwTrader",
    url: "https://medium.com/p/7cf69a6a556b",
  },
  {
    title: "GrowwTrader: The Paper Trading Platform Helping Traders Master F&O Safely",
    url: "https://medium.com/p/08b7f58c7814",
  },
] as const;

function CoverageList({ className }: { className?: string }) {
  return (
    <ul className={`list-disc space-y-3 pl-5 text-sm text-muted-foreground ${className ?? ""}`}>
      {COVERAGE_ITEMS.map((item) => (
        <li key={item.url}>
          <span className="text-foreground">&quot;{item.title}&quot;</span>
          <br />
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">
            {item.url}
          </a>
        </li>
      ))}
    </ul>
  );
}

function OfficialChannels() {
  return (
    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
      <li>
        Telegram:{" "}
        <a href={OFFICIAL_TELEGRAM} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">
          {OFFICIAL_TELEGRAM}
        </a>
      </li>
      <li>
        Instagram:{" "}
        <a href={OFFICIAL_INSTAGRAM} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">
          {OFFICIAL_INSTAGRAM}
        </a>
      </li>
    </ul>
  );
}

export default function PressPage() {
  return (
    <SeoPublicShell>
      <SeoHead
        title="Press &amp; Media | Optix Trades — GrowwTrader"
        description="Press and media resources for Optix Trades and GrowwTrader. Coverage, official Telegram and Instagram."
        canonicalPath="/press"
      />

      <div className="lg:hidden rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">Press / Media</p>
        <p className="mt-2 text-xs text-muted-foreground">Optix Trades | F&amp;O Trader</p>
        <h2 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coverage &amp; mentions</h2>
        <CoverageList className="mt-2 pl-4" />
        <h2 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Official channels</h2>
        <div className="mt-2 flex flex-col gap-2">
          <a href={OFFICIAL_TELEGRAM} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline break-all">
            Telegram: {OFFICIAL_TELEGRAM}
          </a>
          <a href={OFFICIAL_INSTAGRAM} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline break-all">
            Instagram: {OFFICIAL_INSTAGRAM}
          </a>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">More detail on desktop.</p>
      </div>

      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold tracking-tight">Press &amp; Media</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">Optix Trades | F&amp;O Trader · GrowwTrader</p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          This page is for journalists, partners, and verification processes. Below are selected articles and our official social channels.
        </p>
        <h2 className="mt-8 text-lg font-semibold">Brand summary</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          <strong className="text-foreground">Optix Trades</strong> is an F&amp;O-focused trading brand.{" "}
          <strong className="text-foreground">GrowwTrader</strong> (growwtrader.in) is our independent paper trading and contest platform.
        </p>
        <h2 className="mt-8 text-lg font-semibold">Coverage &amp; mentions</h2>
        <CoverageList className="mt-3" />
        <h2 className="mt-8 text-lg font-semibold">Official channels</h2>
        <OfficialChannels />
        <h2 className="mt-8 text-lg font-semibold">Contact</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          For press inquiries, use{" "}
          <a href="mailto:support@growwtrader.in" className="text-primary underline">
            support@growwtrader.in
          </a>{" "}
          (update if you use a dedicated press inbox).
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/about-optix" className="inline-flex rounded-lg border border-border px-4 py-2 text-sm font-semibold">
            About Optix Trades
          </Link>
          <Link to="/login" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Sign in
          </Link>
        </div>
      </div>
    </SeoPublicShell>
  );
}
