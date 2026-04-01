/** Must match `VITE_ADMIN_EMAIL` / server `ADMIN_EMAIL` default. */
export const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || "pbadal392@gmail.com")
  .trim()
  .toLowerCase();

const HOLDINGS_TAB_EMAILS = new Set(["badal@gmail.com", "badal1@gmail.com"].map((e) => e.toLowerCase()));

export function isAdminEmail(email?: string | null): boolean {
  return String(email || "")
    .trim()
    .toLowerCase() === ADMIN_EMAIL;
}

/** Stocks tab: show "Holdings" instead of "Leaderboard" (same data). */
export function usesHoldingsTabLabel(email?: string | null): boolean {
  return HOLDINGS_TAB_EMAILS.has(
    String(email || "")
      .trim()
      .toLowerCase(),
  );
}
