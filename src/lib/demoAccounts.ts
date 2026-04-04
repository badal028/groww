const VIRTUAL_WALLET_EMAILS = new Set(["badal@gmail.com", "badal1@gmail.com"].map((e) => e.trim().toLowerCase()));

export function canControlVirtualWallet(email: string | undefined | null): boolean {
  return VIRTUAL_WALLET_EMAILS.has(String(email || "").trim().toLowerCase());
}
