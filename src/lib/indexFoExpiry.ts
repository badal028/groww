const IST = "Asia/Kolkata";

/** YYYY-MM-DD in IST for "today" (stable across browsers; avoids locale format quirks). */
function todayIsoInIST(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = get("year");
  const m = get("month");
  const d = get("day");
  if (!y || !m || !d) return "";
  return `${y}-${m}-${d}`;
}

/** Show F&O expiry tag only on that calendar day (IST), not on earlier days. */
export function isFoExpiryTagVisible(isoDate?: string | null): boolean {
  if (!isoDate?.trim()) return false;
  const exp = isoDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exp)) return false;
  return todayIsoInIST() === exp;
}
