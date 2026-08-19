import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, ExternalLink, Smartphone } from "lucide-react";
import { SeoHead } from "@/components/SeoHead";
import SeoPublicShell from "./SeoPublicShell";

const APK_URL = "/downloads/growwtrader.apk";
const APP_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "https://growwtrader.in";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function GrowwCloneAccessPage() {
  const [apkReady, setApkReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(APK_URL, { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setApkReady(res.ok);
      })
      .catch(() => {
        if (!cancelled) setApkReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <SeoPublicShell>
      <SeoHead
        title="Download GrowwTrader app | Android APK & install"
        description="Download GrowwTrader for Android APK or install the PWA on iPhone and desktop. Paper trading for Stocks and F&O."
        canonicalPath="/groww-clone-apk"
      />

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <img
          src="/icon-192.png"
          alt="GrowwTrader app icon"
          width={72}
          height={72}
          className="rounded-2xl border border-border shadow-sm"
        />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">GrowwTrader app</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Install on your phone or download the Android APK.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <ExternalLink className="h-4 w-4" />
          Open app in browser
        </Link>
        {installPrompt ? (
          <button
            type="button"
            onClick={() => void handleInstallClick()}
            className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary"
          >
            <Smartphone className="h-4 w-4" />
            Install app
          </button>
        ) : null}
        {apkReady ? (
          <a
            href={APK_URL}
            download="growwtrader.apk"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground"
          >
            <Download className="h-4 w-4" />
            Download Android APK
          </a>
        ) : null}
      </div>

      <div className="mt-8 space-y-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">Android — install without APK</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Open <span className="font-medium text-foreground">{APP_ORIGIN}</span> in Chrome.
            </li>
            <li>Tap menu (⋮) → <strong className="text-foreground">Add to Home screen</strong> or <strong className="text-foreground">Install app</strong>.</li>
            <li>Open GrowwTrader from your home screen.</li>
          </ol>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">Android — APK download</p>
          {apkReady ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Tap <strong className="text-foreground">Download Android APK</strong> above, allow install from your browser, then open the app.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              APK is not uploaded yet. Build it at{" "}
              <a
                href="https://www.pwabuilder.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline"
              >
                pwabuilder.com
              </a>{" "}
              using <span className="font-medium text-foreground">{APP_ORIGIN}</span>, then upload the file to{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">public/downloads/growwtrader.apk</code> on the server.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">iPhone (iOS)</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Open <span className="font-medium text-foreground">{APP_ORIGIN}</span> in Safari (not Chrome).</li>
            <li>Tap Share → <strong className="text-foreground">Add to Home Screen</strong>.</li>
            <li>Launch GrowwTrader from the new icon.</li>
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">APK files do not work on iPhone.</p>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">Windows / desktop</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Open <span className="font-medium text-foreground">{APP_ORIGIN}</span> in Chrome or Edge → address bar →{" "}
            <strong className="text-foreground">Install GrowwTrader</strong>. App icons are in the project{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">windows/</code> folder for store packaging.
          </p>
        </section>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">Application access</p>
        <p className="mt-1 text-sm text-muted-foreground">
          New registrations are controlled. For access, contact{" "}
          <span className="font-medium text-foreground">badal@gmail.com</span>,{" "}
          <span className="font-medium text-foreground">badal1@gmail.com</span>, or{" "}
          <span className="font-medium text-foreground">pbadal392@gmail.com</span>.
        </p>
      </div>
    </SeoPublicShell>
  );
}
