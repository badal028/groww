import { isAdminEmail } from "@/lib/accountLabels";

export type PermissionUser = {
  email?: string | null;
  canAdjustWallet?: boolean;
  canClearPositions?: boolean;
};

const PRIVILEGED_EMAILS = new Set(["badal@gmail.com"].map((e) => e.trim().toLowerCase()));

/** Admin + badal@gmail.com — always privileged (legacy hard allowlist). */
export function isPrivilegedAccount(email: string | undefined | null): boolean {
  const e = String(email || "").trim().toLowerCase();
  return isAdminEmail(e) || PRIVILEGED_EMAILS.has(e);
}

function asPermissionUser(
  userOrEmail: PermissionUser | string | null | undefined,
): PermissionUser | null {
  if (userOrEmail == null) return null;
  if (typeof userOrEmail === "string") return { email: userOrEmail };
  return userOrEmail;
}

/** Account Details / set-add virtual balance. */
export function canControlVirtualWallet(
  userOrEmail: PermissionUser | string | null | undefined,
): boolean {
  const u = asPermissionUser(userOrEmail);
  if (u?.canAdjustWallet === true) return true;
  return isPrivilegedAccount(u?.email);
}

/** Swipe clear exited position + Profile clear-all. */
export function canClearPaperPositions(
  userOrEmail: PermissionUser | string | null | undefined,
): boolean {
  const u = asPermissionUser(userOrEmail);
  if (u?.canClearPositions === true) return true;
  return isPrivilegedAccount(u?.email);
}

export function canOpenReports(userOrEmail: PermissionUser | string | null | undefined): boolean {
  return canClearPaperPositions(userOrEmail);
}

export function canOpenAccountDetails(
  userOrEmail: PermissionUser | string | null | undefined,
): boolean {
  return canControlVirtualWallet(userOrEmail);
}
