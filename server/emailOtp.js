import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const EMAIL_VERIFICATION_TOKEN_TTL = "15m";
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/** @type {Map<string, { hash: string; expiresAt: number; attempts: number; lastSentAt: number }>} */
const otpStore = new Map();

const otpKey = (email, purpose) => `${String(purpose || "signup").trim()}:${String(email || "").trim().toLowerCase()}`;

export const isEmailOtpEnabled = () => Boolean(String(process.env.BREVO_API_KEY || "").trim());

/** Local dev only — set ALLOW_SIGNUP_WITHOUT_EMAIL_OTP=1 in .env.server to skip OTP. */
export const isSignupOtpBypassed = () =>
  process.env.ALLOW_SIGNUP_WITHOUT_EMAIL_OTP === "1" && !isEmailOtpEnabled();

export const isSignupOtpRequired = () => isEmailOtpEnabled() || !isSignupOtpBypassed();

/** @returns {{ name: string; email: string } | null} */
function getSender() {
  const raw = String(process.env.BREVO_FROM_EMAIL || "").trim();
  if (!raw) return null;

  const angle = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (angle) {
    return { name: angle[1].trim(), email: angle[2].trim().toLowerCase() };
  }

  const name = String(process.env.BREVO_FROM_NAME || "GrowwTrader").trim();
  return { name, email: raw.toLowerCase() };
}

export function generateOtpCode() {
  return String(randomInt(100_000, 1_000_000));
}

function pruneExpiredOtps() {
  const now = Date.now();
  for (const [key, row] of otpStore) {
    if (row.expiresAt <= now) otpStore.delete(key);
  }
}

/**
 * @param {{ to: string; subject: string; html: string; text: string }} opts
 */
async function sendViaBrevo({ to, subject, html, text }) {
  const apiKey = String(process.env.BREVO_API_KEY || "").trim();
  if (!apiKey) {
    return { ok: false, status: 503, message: "Email verification is not configured on this server" };
  }

  const sender = getSender();
  if (!sender?.email) {
    return {
      ok: false,
      status: 503,
      message: "Set BREVO_FROM_EMAIL in .env.server (must be a verified sender in Brevo).",
    };
  }

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: sender.name, email: sender.email },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let msg = String(data?.message || data?.error || `Brevo API error (${res.status})`);
    if (/unrecognised IP|unrecognized IP|authorised_ips|authorized_ips/i.test(msg)) {
      msg =
        "Brevo blocked this server IP. In Brevo go to Security → Authorized IPs → add your IP or disable IP restriction, then try again.";
    }
    // eslint-disable-next-line no-console
    console.error("[email-otp] Brevo error:", data);
    return { ok: false, status: 502, message: msg };
  }

  // eslint-disable-next-line no-console
  console.log(`[email-otp] Brevo sent to ${to}${data?.messageId ? ` (id ${data.messageId})` : ""}`);
  return { ok: true, messageId: data?.messageId };
}

/**
 * @param {{ email: string; purpose?: string; displayName?: string }} opts
 */
export async function sendSignupEmailOtp({ email, purpose = "signup", displayName = "GrowwTrader" }) {
  if (!isEmailOtpEnabled()) {
    return { ok: false, status: 503, message: "Email verification is not configured on this server" };
  }

  const emailNorm = String(email || "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return { ok: false, status: 400, message: "Enter a valid email address" };
  }

  pruneExpiredOtps();
  const key = otpKey(emailNorm, purpose);
  const now = Date.now();
  const existing = otpStore.get(key);
  if (existing && now - existing.lastSentAt < OTP_COOLDOWN_MS) {
    const waitSec = Math.ceil((OTP_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
    return { ok: false, status: 429, message: `Please wait ${waitSec}s before requesting another code` };
  }

  const code = generateOtpCode();
  const hash = await bcrypt.hash(code, 10);
  otpStore.set(key, {
    hash,
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: now,
  });

  const subject = `${code} is your ${displayName} verification code`;
  const text = `Your verification code for ${displayName} is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
      <p>Your verification code for <strong>${displayName}</strong>:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${code}</p>
      <p style="color:#555">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
    </div>
  `;

  try {
    const sent = await sendViaBrevo({ to: emailNorm, subject, html, text });
    if (!sent.ok) {
      otpStore.delete(key);
      return sent;
    }
  } catch (e) {
    otpStore.delete(key);
    return { ok: false, status: 502, message: e?.message || "Failed to send verification email" };
  }

  return { ok: true, message: "Verification code sent. Check your inbox (and spam folder)." };
}

/**
 * @param {{ email: string; otp: string; purpose?: string; jwtSecret: string }} opts
 */
export function verifySignupEmailOtp({ email, otp, purpose = "signup", jwtSecret }) {
  const emailNorm = String(email || "")
    .trim()
    .toLowerCase();
  const code = String(otp || "").trim();
  if (!emailNorm || !/^\d{6}$/.test(code)) {
    return { ok: false, status: 400, message: "Enter the 6-digit code from your email" };
  }

  pruneExpiredOtps();
  const key = otpKey(emailNorm, purpose);
  const row = otpStore.get(key);
  if (!row || row.expiresAt <= Date.now()) {
    otpStore.delete(key);
    return { ok: false, status: 400, message: "Code expired. Request a new one." };
  }

  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    otpStore.delete(key);
    return { ok: false, status: 429, message: "Too many attempts. Request a new code." };
  }

  row.attempts += 1;
  const match = bcrypt.compareSync(code, row.hash);
  if (!match) {
    return { ok: false, status: 400, message: "Incorrect code. Try again." };
  }

  otpStore.delete(key);
  const emailVerificationToken = jwt.sign(
    { typ: "email_verified", email: emailNorm, purpose },
    jwtSecret,
    { expiresIn: EMAIL_VERIFICATION_TOKEN_TTL },
  );

  return { ok: true, emailVerificationToken, message: "Email verified" };
}

/**
 * @param {{ token: string; email: string; purpose?: string; jwtSecret: string }} opts
 */
export function assertEmailVerificationToken({ token, email, purpose = "signup", jwtSecret }) {
  if (isSignupOtpBypassed()) return { ok: true };

  if (!isEmailOtpEnabled()) {
    return {
      ok: false,
      status: 503,
      message: "Email verification is not configured. Set BREVO_API_KEY in .env.server and restart the server.",
    };
  }

  const emailNorm = String(email || "")
    .trim()
    .toLowerCase();
  const raw = String(token || "").trim();
  if (!raw) {
    return { ok: false, status: 403, message: "Verify your email with the code we sent before creating an account" };
  }

  try {
    const payload = jwt.verify(raw, jwtSecret);
    if (payload?.typ !== "email_verified") throw new Error("invalid type");
    if (String(payload?.email || "").toLowerCase() !== emailNorm) throw new Error("email mismatch");
    if (String(payload?.purpose || "signup") !== String(purpose || "signup")) throw new Error("purpose mismatch");
    return { ok: true };
  } catch {
    return { ok: false, status: 403, message: "Email verification expired. Request a new code and try again." };
  }
}
