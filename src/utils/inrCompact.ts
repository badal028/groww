/** Compact INR for balance row (e.g. ₹1.42L). */
export function formatInrCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const cr = 1e7;
  const L = 1e5;
  if (abs >= cr) return `₹${(n / cr).toFixed(2)}Cr`;
  if (abs >= L) return `₹${(n / L).toFixed(2)}L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(2)}K`;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
