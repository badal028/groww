/** Must match `VITE_ADMIN_EMAIL` / server `ADMIN_EMAIL` default. */
export const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || "pbadal392@gmail.com")
  .trim()
  .toLowerCase();

/** Must match server `SIGNUP_ALLOWED_EMAILS` (email/password + Google new users). */
const SIGNUP_ALLOWED_EMAILS = new Set(
  ["badal@gmail.com", "badal1@gmail.com", "pbadal392@gmail.com"].map((e) => e.trim().toLowerCase()),
);

export function isAdminEmail(email?: string | null): boolean {
  return String(email || "")
    .trim()
    .toLowerCase() === ADMIN_EMAIL;
}

export function isSignupAllowedEmail(email?: string | null): boolean {
  return SIGNUP_ALLOWED_EMAILS.has(
    String(email || "")
      .trim()
      .toLowerCase(),
  );
}
