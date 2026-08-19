import { isAdminEmail } from "@/lib/accountLabels";

const PRIVILEGED_EMAILS = new Set(["badal@gmail.com"].map((e) => e.trim().toLowerCase()));

/** Admin + badal@gmail.com — virtual wallet tools, clear positions, reports, account details. */
export function isPrivilegedAccount(email: string | undefined | null): boolean {
  const e = String(email || "").trim().toLowerCase();
  return isAdminEmail(e) || PRIVILEGED_EMAILS.has(e);
}

export function canControlVirtualWallet(email: string | undefined | null): boolean {
  return isPrivilegedAccount(email);
}

export function canClearPaperPositions(email: string | undefined | null): boolean {
  return isPrivilegedAccount(email);
}

export function canOpenReports(email: string | undefined | null): boolean {
  return isPrivilegedAccount(email);
}

export function canOpenAccountDetails(email: string | undefined | null): boolean {
  return isPrivilegedAccount(email);
}
