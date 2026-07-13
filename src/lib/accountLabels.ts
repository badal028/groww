/** Must match `VITE_ADMIN_EMAIL` / server `ADMIN_EMAIL` default. */
export const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || "pbadal392@gmail.com")
  .trim()
  .toLowerCase();

export function isAdminEmail(email?: string | null): boolean {
  return String(email || "")
    .trim()
    .toLowerCase() === ADMIN_EMAIL;
}
