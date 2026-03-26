/** Google Analytics 4 (gtag). Set `VITE_GA_MEASUREMENT_ID` in `.env` / production build. */
export function initGoogleAnalytics() {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
  if (!id || typeof window === "undefined") return;

  const w = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
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
