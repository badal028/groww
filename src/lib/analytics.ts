/**
 * Google Analytics 4 (gtag). Prefer the snippet in `index.html` so GA’s installer can detect it.
 * Alternatively set `VITE_GA_MEASUREMENT_ID` for env-only injection (no duplicate if gtag already exists).
 */
export function initGoogleAnalytics() {
  if (typeof window === "undefined") return;

  const w = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  if (typeof w.gtag === "function") return;

  const id = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
  if (!id) return;

  const alreadyLoaded = Boolean(
    document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}"]`)
  );
  if (alreadyLoaded) return;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag(...args: unknown[]) {
    w.dataLayer!.push(args);
  };

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);

  w.gtag("js", new Date());
  w.gtag("config", id);
}
