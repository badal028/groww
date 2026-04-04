import React from "react";
import { Link } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import SeoPublicShell from "./SeoPublicShell";

const tg = import.meta.env.VITE_OPTIX_TELEGRAM_URL as string | undefined;
const ig = import.meta.env.VITE_OPTIX_INSTAGRAM_URL as string | undefined;

export default function PressPage() {
  return (
    <SeoPublicShell>
      <SeoHead
        title="Press &amp; Media | Optix Trades — GrowwTrader"
        description="Press and media resources for Optix Trades and GrowwTrader. Official contacts and future coverage listings."
        canonicalPath="/press"
      />

      <div className="lg:hidden rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">Press / Media</p>
        <p className="mt-2 text-xs text-muted-foreground">Optix Trades | F&amp;O Trader</p>
        <div className="mt-3 flex flex-col gap-2">
          {tg ? (
            <a href={tg} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline">
              Telegram
            </a>
          ) : null}
          {ig ? (
            <a href={ig} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline">
              Instagram
            </a>
          ) : null}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Full press kit and listings are shown on desktop.</p>
      </div>

      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold tracking-tight">Press &amp; Media</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">Optix Trades | F&amp;O Trader · GrowwTrader</p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          This page is for journalists, partners, and verification processes. We will add article links, mentions, and downloadable assets here as they
          become available.
        </p>
        <h2 className="mt-8 text-lg font-semibold">Brand summary</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          <strong className="text-foreground">Optix Trades</strong> is an F&amp;O-focused trading brand.{" "}
          <strong className="text-foreground">GrowwTrader</strong> (growwtrader.in) is our independent paper trading and contest platform.
        </p>
        <h2 className="mt-8 text-lg font-semibold">Coverage &amp; mentions</h2>
        <p className="mt-2 text-sm text-muted-foreground">No public listings yet. Check back soon.</p>
        <h2 className="mt-8 text-lg font-semibold">Official channels</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Telegram:{" "}
            {tg ? (
              <a href={tg} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                {tg}
              </a>
            ) : (
              <span>(configure VITE_OPTIX_TELEGRAM_URL)</span>
            )}
          </li>
          <li>
            Instagram:{" "}
            {ig ? (
              <a href={ig} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                {ig}
              </a>
            ) : (
              <span>(configure VITE_OPTIX_INSTAGRAM_URL)</span>
            )}
          </li>
        </ul>
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
