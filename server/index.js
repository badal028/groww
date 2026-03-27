import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHmac, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const KITE_AUTH_FILE = path.join(repoRoot, "server", "data", "kiteAuth.json");
import { createServer } from "node:http";
import { KiteConnect } from "kiteconnect";
import { OAuth2Client } from "google-auth-library";
import Razorpay from "razorpay";
import {
  createUser,
  getUserByEmail,
  getUserById,
  updateUser,
  getAllUsers,
  getAllContests,
  upsertContest,
  readAllData,
  writeAllData,
  getSiteSettings,
  updateSiteSettings,
} from "./store.js";
import { attachMarketStream, bumpMarketStreamResync } from "./marketStream.js";

let kiteInstrumentsCache = null;
let kiteInstrumentsLoadedAt = 0;
const KITE_INSTRUMENTS_CACHE_MS = 6 * 60 * 60 * 1000; // 6h

const todayISOInIST = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
};

const isoDateInIST = (dateLike) => {
  const dt = new Date(dateLike);
  if (!Number.isFinite(dt.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dt);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
};

const istMinutesNow = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(new Date());
  const hh = Number(parts.find((p) => p.type === "hour")?.value || "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value || "0");
  const weekday = String(parts.find((p) => p.type === "weekday")?.value || "");
  return { mins: hh * 60 + mm, weekday };
};

const isWithinMarketHoursIST = () => {
  const { mins, weekday } = istMinutesNow();
  const isWeekend = weekday === "Sat" || weekday === "Sun";
  if (isWeekend) return false;
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
};

const pruneExitedPositionsBeforeToday = (positions) => {
  const today = todayISOInIST();
  return (Array.isArray(positions) ? positions : []).filter((p) => {
    if (!p?.exited) return true;
    const d = isoDateInIST(p?.exitedAt);
    return d === today;
  });
};

const activeContestDateISO = () => {
  const base = new Date();
  const { mins } = istMinutesNow();
  // Contest ends at 3:30 PM IST. Before/at close => current day contest; after close => next day.
  const shiftDays = mins > 15 * 60 + 30 ? 1 : 0;
  const dt = new Date(base.getTime() + shiftDays * 86400000);
  return isoDateInIST(dt);
};

/** Client-facing contest: cap participants + show correct IST calendar day (stale contestDateISO when carry-over). */
const augmentContestForApi = (contest) => {
  if (!contest) return null;
  const maxCap = Number(contest.maxParticipants || maxContestParticipants);
  const participants = (Array.isArray(contest.participants) ? contest.participants : []).slice(0, Math.max(0, maxCap));
  return {
    ...contest,
    participants,
    activeContestDayISO: activeContestDateISO(),
  };
};

const currentPracticeContestForApi = () => {
  const today = activeContestDateISO();
  const users = getAllUsers();
  const hiddenSet = new Set((getSiteSettings().leaderboardHiddenUserIds || []).map((x) => String(x)));
  return {
    id: `practice-${today}`,
    title: "Practice League",
    contestDateISO: today,
    activeContestDayISO: today,
    entryFeeInr: 0,
    minParticipants: 1,
    maxParticipants: 999999,
    participants: users
      .filter((u) => !hiddenSet.has(String(u.id)))
      .map((u) => ({ userId: u.id, joinedAt: String(u.createdAt || new Date().toISOString()) })),
    payouts: [],
    prizePoolInr: { first: 0, second: 0, third: 0 },
    status: "OPEN",
    leagueType: "practice",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

const hiddenLeaderboardUserSet = () => new Set((getSiteSettings().leaderboardHiddenUserIds || []).map((x) => String(x)));

const isSameISTDay = (dateLike, dayISO) => {
  if (!dateLike || !dayISO) return false;
  return isoDateInIST(dateLike) === dayISO;
};

const isDailyOpenPosition = (p, dayISO) => {
  const qty = Number(p?.quantity || 0);
  const avg = Number(p?.avgPrice || 0);
  if (!(qty > 0 && avg > 0)) return false;
  if (Boolean(p?.exited)) return false;
  const anchor = p?.openedAt || p?.lastTradedAt || p?.createdAt;
  return isSameISTDay(anchor, dayISO);
};

const collectQuoteSymbolsForDay = (users, dayISO) => {
  const symbols = [];
  for (const u of Array.isArray(users) ? users : []) {
    for (const p of u?.positions || []) {
      if (!isDailyOpenPosition(p, dayISO)) continue;
      const k = resolveKiteSymbolFromPosition(p);
      if (k) symbols.push(k);
    }
  }
  return [...new Set(symbols)];
};

const getQuotesForUsersDay = async (users, dayISO) => {
  const symbols = collectQuoteSymbolsForDay(users, dayISO);
  if (!symbols.length || !auth.accessToken) return {};
  try {
    kite.setAccessToken(auth.accessToken);
    return await kite.getQuote(symbols);
  } catch {
    return {};
  }
};

const dailyContestLeaderboardForUsers = (users, dayISO, quotes) => {
  return [...(Array.isArray(users) ? users : [])]
    .map((u) => {
      let realizedToday = 0;
      let openToday = 0;
      for (const p of u?.positions || []) {
        const openedToday = isSameISTDay(p?.openedAt || p?.lastTradedAt || p?.createdAt, dayISO);
        if (Boolean(p?.exited) && isSameISTDay(p?.exitedAt, dayISO) && openedToday) {
          realizedToday += Number(p?.realizedPnlInr || 0);
          continue;
        }
        if (!isDailyOpenPosition(p, dayISO)) continue;
        const qty = Number(p?.quantity || 0);
        const avg = Number(p?.avgPrice || 0);
        const k = resolveKiteSymbolFromPosition(p);
        const q = k ? quotes?.[k] : null;
        const lp = Number(q?.last_price ?? q?.lastPrice ?? q?.ltp ?? q?.last ?? 0);
        if (Number.isFinite(lp) && lp > 0) openToday += (lp - avg) * qty;
      }
      const total = Number((realizedToday + openToday).toFixed(2));
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl || null,
        totalPnlInr: total,
      };
    })
    .sort((a, b) => {
      const bucket = (v) => (v > 0 ? 0 : v < 0 ? 1 : 2); // positive first, then negative, zeros last
      const ba = bucket(a.totalPnlInr);
      const bb = bucket(b.totalPnlInr);
      if (ba !== bb) return ba - bb;
      return b.totalPnlInr - a.totalPnlInr;
    })
    .map((r, idx) => ({ ...r, rank: idx + 1 }));
};

const ensureUserFinancials = (u) => ({
  ...u,
  walletInr: Number(u.walletInr ?? defaultWalletBalance),
  realizedPnlInr: Number(u.realizedPnlInr ?? 0),
  realWalletInr: Number(u.realWalletInr ?? 0),
  avatarUrl: u.avatarUrl || null,
  walletPayments: Array.isArray(u.walletPayments) ? u.walletPayments : [],
  withdrawalRequests: Array.isArray(u.withdrawalRequests) ? u.withdrawalRequests : [],
  cashfreePayments: Array.isArray(u.cashfreePayments) ? u.cashfreePayments : [],
});

const isSeededUser = (u) => {
  const email = String(u?.email || "").toLowerCase();
  return Boolean(u?.isSeeded) || email.endsWith("@growwseed.local");
};

const currentContestOrCreate = () => {
  const today = activeContestDateISO();
  const all = getAllContests();

  // If someone already joined an OPEN contest, keep using that same contest
  // (do not roll to next day) until admin finalizes it.
  const openWithParticipants = all
    .filter((c) => c?.status === "OPEN" && Array.isArray(c.participants) && c.participants.length > 0)
    .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || "") - Date.parse(a.updatedAt || a.createdAt || ""));

  if (openWithParticipants.length) return openWithParticipants[0];

  const id = `contest-${today}`;
  return upsertContest(id, (prev) => {
    if (prev) {
      // No participants in any existing OPEN contest; safe to refresh.
      return { ...prev, contestDateISO: today, updatedAt: new Date().toISOString() };
    }
    return {
      id,
      title: "The Pro-League",
      contestDateISO: today,
      entryFeeInr: defaultContestFeeInr,
      minParticipants: minContestParticipants,
      maxParticipants: maxContestParticipants,
      prizePoolInr: { first: 10000, second: 5000, third: 2000 },
      participants: [],
      payouts: [],
      status: "OPEN",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
};

const parseExpiryToISO = (expiryLabel) => {
  // Kite instrument master expiry can appear in multiple shapes:
  // - "YYYY-MM-DD"
  // - "19-Mar-2026"
  // - sometimes with time suffixes like "YYYY-MM-DDTHH:mm:ss" (rare, but observed)
  const s = String(expiryLabel || "").trim();
  if (!s) return "";

  // Handle ISO prefix (even if string has time suffix)
  const isoPrefix = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoPrefix) return `${isoPrefix[1]}-${isoPrefix[2]}-${isoPrefix[3]}`;

  // Handle "DD-MMM-YYYY" prefix
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (m) {
    const dd = String(m[1]).padStart(2, "0");
    const mon = String(m[2]).toUpperCase();
    const yyyy = m[3];
    const monthMap = {
      JAN: "01",
      FEB: "02",
      MAR: "03",
      APR: "04",
      MAY: "05",
      JUN: "06",
      JUL: "07",
      AUG: "08",
      SEP: "09",
      OCT: "10",
      NOV: "11",
      DEC: "12",
    };
    const mm = monthMap[mon];
    if (mm) return `${yyyy}-${mm}-${dd}`;
  }

  // Fallback: last resort, try splitting by "-" and mapping numeric month too
  const parts = s.split("-");
  if (parts.length >= 3) {
    const [ddRaw, monRaw, yyyyRaw] = parts;
    const dd = String(ddRaw).padStart(2, "0");
    const yyyy = String(yyyyRaw).match(/\d{4}/)?.[0];
    const monDigits = String(monRaw).trim();
    const mm = /^\d{1,2}$/.test(monDigits) ? monDigits.padStart(2, "0") : null;
    if (yyyy && mm) return `${yyyy}-${mm}-${dd}`;
  }

  return "";
};

const parseCSV = (csvText) => {
  const stripQuotes = (v) => (typeof v === "string" ? v.replace(/^\"|\"$/g, "") : v);
  const lines = String(csvText).split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const idx = {};
  header.forEach((h, i) => (idx[h] = i));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length < header.length) continue;
    const segment = stripQuotes(parts[idx.segment]);
    const exchange = stripQuotes(parts[idx.exchange]);
    const tradingsymbol = stripQuotes(parts[idx.tradingsymbol]);
    const instrument_type = stripQuotes(parts[idx.instrument_type]);
    const name = stripQuotes(parts[idx.name]);
    const expiry = stripQuotes(parts[idx.expiry]);
    const strikeRaw = parts[idx.strike];
    const strike = strikeRaw ? Number(strikeRaw) : null;
    const tokenRaw = idx.instrument_token != null ? stripQuotes(parts[idx.instrument_token]) : "";
    const instrument_token = tokenRaw ? Number(tokenRaw) : null;
    rows.push({
      segment,
      exchange,
      tradingsymbol,
      instrument_type,
      name,
      expiry,
      strike,
      instrument_token: Number.isFinite(instrument_token) ? instrument_token : null,
    });
  }
  return rows;
};

const loadKiteInstruments = async () => {
  const now = Date.now();
  if (kiteInstrumentsCache && now - kiteInstrumentsLoadedAt < KITE_INSTRUMENTS_CACHE_MS) {
    return kiteInstrumentsCache;
  }

  const url = "https://api.kite.trade/instruments";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load Kite instruments: ${res.status}`);
  const text = await res.text();
  const parsed = parseCSV(text);
  kiteInstrumentsCache = parsed;
  kiteInstrumentsLoadedAt = now;
  return parsed;
};

const normalizeUnderlyingInput = (u) =>
  String(u || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const getUnderlyingQuoteSymbol = (underlyingNormalized) => {
  // Indices mapping (from earlier testing / Kite conventions)
  if (underlyingNormalized === "SENSEX") return "BSE:SENSEX";
  if (underlyingNormalized === "BANK NIFTY" || underlyingNormalized === "BANKNIFTY") return "NSE:NIFTY BANK";
  if (underlyingNormalized === "NIFTY 50" || underlyingNormalized === "NIFTY50" || underlyingNormalized === "NIFTY") return "NSE:NIFTY 50";

  // Stocks/options: expect exchange NSE
  return `NSE:${underlyingNormalized.replace(/\s/g, "")}`;
};

const getIndexNameCandidates = (underlyingNormalized) => {
  if (underlyingNormalized === "SENSEX") return ["SENSEX"];
  // Bank Nifty naming varies across Kite instrument masters.
  // Keep multiple candidates to avoid empty/partial expiry lists.
  if (underlyingNormalized === "BANK NIFTY" || underlyingNormalized === "BANKNIFTY")
    return ["BANKEX", "NIFTY BANK", "BANKNIFTY"];
  // Kite uses "NIFTY" naming for Nifty 50 options.
  if (underlyingNormalized === "NIFTY 50" || underlyingNormalized === "NIFTY50" || underlyingNormalized === "NIFTY") return ["NIFTY"];
  return [underlyingNormalized];
};

const getStockNameCandidates = (instruments, underlyingNormalized) => {
  // For options, Kite often matches by `name` (e.g., "RELIANCE INDUSTRIES")
  // while the equity tradingsymbol is just "RELIANCE".
  const candidates = new Set([underlyingNormalized]);

  const fromEq = instruments.filter((r) => {
    // EQ instruments have segment=EQ and instrument_type=EQ (depending on header)
    // We'll check both fields defensively.
    const isEqSeg = String(r.segment || "").toUpperCase() === "EQ";
    const isEqType = String(r.instrument_type || "").toUpperCase() === "EQ";
    return isEqSeg || isEqType;
  });

  for (const r of fromEq) {
    if (!r.tradingsymbol || !r.name) continue;
    const sym = String(r.tradingsymbol).toUpperCase();
    const nm = String(r.name).toUpperCase();
    if (sym === underlyingNormalized) {
      candidates.add(String(r.name).toUpperCase());
    }
    // Fallback for cases where tradingsymbol differs (rare, but helps with some aliases).
    if (!candidates.has(nm) && nm.includes(underlyingNormalized)) {
      candidates.add(nm);
    }
  }

  return Array.from(candidates);
};

const getIndexStrikeStep = (underlyingNormalized) => {
  if (underlyingNormalized.includes("NIFTY")) return 50;
  if (underlyingNormalized.includes("BANK")) return 100;
  if (underlyingNormalized.includes("SENSEX")) return 100;
  return 1;
};

const toExpiryLabel = (isoDate) => {
  // Convert "YYYY-MM-DD" => "DD-MMM-YYYY"
  const [yyyy, mm, dd] = String(isoDate).split("-");
  const monthMap = {
    "01": "Jan",
    "02": "Feb",
    "03": "Mar",
    "04": "Apr",
    "05": "May",
    "06": "Jun",
    "07": "Jul",
    "08": "Aug",
    "09": "Sep",
    "10": "Oct",
    "11": "Nov",
    "12": "Dec",
  };
  const mon = monthMap[String(mm).padStart(2, "0")] || "Jan";
  return `${dd}-${mon}-${yyyy}`;
};

dotenv.config({ path: path.join(repoRoot, ".env.server") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const app = express();
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS) || 1);
}
const port = Number(process.env.PORT || 3001);
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:8080";
const jwtSecret = process.env.JWT_SECRET || "dev-insecure-secret-change-this";
const defaultWalletBalance = Number(process.env.DEFAULT_VIRTUAL_BALANCE_INR || 10_000_000);
const defaultContestFeeInr = Number(process.env.DEFAULT_CONTEST_FEE_INR || 79);
const minContestParticipants = Number(process.env.MIN_CONTEST_PARTICIPANTS || 500);
const maxContestParticipants = Number(process.env.MAX_CONTEST_PARTICIPANTS || 500);
const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
/** Must match Google Cloud "Authorized redirect URIs" exactly (e.g. https://growwtrader.in/auth/google/callback). */
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI || `http://127.0.0.1:${port}/auth/google/callback`;

let googleOAuthClient = null;
if (googleClientId && googleClientSecret) {
  googleOAuthClient = new OAuth2Client(googleClientId, googleClientSecret, googleRedirectUri);
  // eslint-disable-next-line no-console
  console.log(
    `Google OAuth: register these under Authorized redirect URIs (local dev uses request host — add BOTH if you switch localhost vs 127.0.0.1):\n  http://localhost:${port}/auth/google/callback\n  http://127.0.0.1:${port}/auth/google/callback\n  (production: ${googleRedirectUri})`,
  );
} else {
  // eslint-disable-next-line no-console
  console.warn("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing. /auth/google will be unavailable.");
}

/** Callback URL sent to Google — must match Authorized redirect URIs exactly (same host as /auth/google). */
const getGoogleOAuthRedirectUri = (req) => {
  const host = req.get("host");
  if (!host) return googleRedirectUri;
  const rawProto = req.get("x-forwarded-proto") || req.protocol || "http";
  const proto = String(rawProto).split(",")[0].trim();
  return `${proto}://${host}/auth/google/callback`;
};

/** CSRF state for OAuth (single-node; good enough for one PM2 process). */
const oauthStates = new Map();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const pruneOAuthStates = () => {
  const now = Date.now();
  for (const [k, t] of oauthStates) {
    if (now - t > OAUTH_STATE_TTL_MS) oauthStates.delete(k);
  }
};
const saveOAuthState = (state) => {
  pruneOAuthStates();
  oauthStates.set(state, Date.now());
};
const consumeOAuthState = (state) => {
  const t = oauthStates.get(state);
  if (!t || Date.now() - t > OAUTH_STATE_TTL_MS) return false;
  oauthStates.delete(state);
  return true;
};

const apiKey = process.env.KITE_API_KEY;
const apiSecret = process.env.KITE_API_SECRET;
const redirectUrl = process.env.KITE_REDIRECT_URL || "http://127.0.0.1:3001/kite/callback";

const cashfreeAppId = process.env.CASHFREE_APP_ID;
const cashfreeSecretKey = process.env.CASHFREE_SECRET_KEY;
const cashfreeEnv = process.env.CASHFREE_ENV === "production" ? "production" : "sandbox";
const cashfreeApiBase = cashfreeEnv === "production" ? "https://api.cashfree.com" : "https://sandbox.cashfree.com";
const cashfreeApiVersion = process.env.CASHFREE_API_VERSION || "2022-01-01";
const configuredNotifyUrl = String(process.env.CASHFREE_NOTIFY_URL || "").trim();
const defaultNotifyUrl = `https://growwtrader.in/payments/cashfree/webhook`;
const cashfreeNotifyUrl = configuredNotifyUrl.startsWith("https://") ? configuredNotifyUrl : defaultNotifyUrl;

const isCashfreePaid = (value) => {
  const v = String(value || "").trim().toUpperCase();
  return v === "PAID" || v === "SUCCESS" || v === "ORDER_PAID" || v === "PAYMENT_SUCCESS";
};

const settleCashfreeOrderForUser = ({
  userId,
  orderId,
  amountInr,
  paid,
  paymentId = "",
  signature = "",
}) => {
  const user = getUserById(userId);
  if (!user || !orderId) return null;

  return updateUser(userId, (prev) => {
    const normalized = ensureUserFinancials(prev);
    const nextCashfreePayments = Array.isArray(normalized.cashfreePayments) ? [...normalized.cashfreePayments] : [];
    const existingIdx = nextCashfreePayments.findIndex((p) => p.orderId === orderId);
    const status = paid ? "PAID" : "FAILED";
    const safeAmountInr = Number(Number(amountInr || 0).toFixed(2));

    if (existingIdx >= 0) {
      nextCashfreePayments[existingIdx] = {
        ...nextCashfreePayments[existingIdx],
        status,
        updatedAt: new Date().toISOString(),
      };
    } else {
      nextCashfreePayments.push({
        orderId,
        cashfreeOrderId: orderId,
        amountInr: safeAmountInr,
        status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    let nextRealWallet = Number(normalized.realWalletInr || 0);
    let nextWalletPayments = Array.isArray(normalized.walletPayments) ? [...normalized.walletPayments] : [];
    if (paid && safeAmountInr > 0) {
      const alreadyLogged = nextWalletPayments.some((p) => p.orderId === orderId && p.via === "cashfree");
      if (!alreadyLogged) {
        nextRealWallet = Number((nextRealWallet + safeAmountInr).toFixed(2));
        nextWalletPayments.push({
          id: randomUUID(),
          amountInr: safeAmountInr,
          orderId,
          paymentId: String(paymentId || ""),
          signature,
          createdAt: new Date().toISOString(),
          via: "cashfree",
        });
      }
    }

    return {
      ...normalized,
      realWalletInr: nextRealWallet,
      walletPayments: nextWalletPayments,
      cashfreePayments: nextCashfreePayments,
      updatedAt: new Date().toISOString(),
    };
  });
};

const fetchCashfreeOrderPaidStatus = async (orderId) => {
  if (!cashfreeAppId || !cashfreeSecretKey) return { ok: false, paid: false };
  const headers = {
    "Content-Type": "application/json",
    "x-client-id": cashfreeAppId,
    "x-client-secret": cashfreeSecretKey,
    "x-api-version": cashfreeApiVersion,
  };

  // 1) Order status endpoint
  const orderRes = await fetch(`${cashfreeApiBase}/pg/orders/${encodeURIComponent(orderId)}`, { headers });
  const orderData = await orderRes.json().catch(() => ({}));
  if (orderRes.ok) {
    const orderStatus = String(orderData?.order_status || orderData?.data?.order_status || "").toUpperCase();
    const amountInr = Number(orderData?.order_amount || orderData?.data?.order_amount || 0);
    if (isCashfreePaid(orderStatus)) return { ok: true, paid: true, amountInr };
  }

  // 2) Payments list endpoint fallback
  const paymentsRes = await fetch(`${cashfreeApiBase}/pg/orders/${encodeURIComponent(orderId)}/payments`, { headers });
  const paymentsData = await paymentsRes.json().catch(() => ({}));
  if (!paymentsRes.ok) return { ok: false, paid: false };

  const rows = Array.isArray(paymentsData) ? paymentsData : Array.isArray(paymentsData?.data) ? paymentsData.data : [];
  for (const row of rows) {
    const paymentStatus = String(row?.payment_status || row?.paymentStatus || "").toUpperCase();
    if (isCashfreePaid(paymentStatus)) {
      const amountInr = Number(row?.payment_amount || row?.order_amount || row?.amount || 0);
      const paymentId = String(row?.cf_payment_id || row?.payment_id || "");
      return { ok: true, paid: true, amountInr, paymentId };
    }
  }
  return { ok: true, paid: false };
};

const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
let razorpay = null;
if (razorpayKeyId && razorpayKeySecret) {
  razorpay = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });
} else {
  // eslint-disable-next-line no-console
  console.warn("RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing. Real wallet payment endpoints disabled.");
}

if (!apiKey || !apiSecret) {
  // eslint-disable-next-line no-console
  console.warn("KITE_API_KEY or KITE_API_SECRET missing. Kite routes will fail until provided.");
}

const kite = new KiteConnect({
  api_key: apiKey || "",
});

let auth = {
  accessToken: null,
  publicToken: null,
  userId: null,
  updatedAt: null,
};

// Persist Kite access token so the server restart doesn't force re-login every time.
try {
  if (existsSync(KITE_AUTH_FILE)) {
    const raw = readFileSync(KITE_AUTH_FILE, "utf-8");
    const saved = JSON.parse(raw);
    if (saved?.accessToken) {
      auth = {
        ...auth,
        accessToken: saved.accessToken,
        publicToken: saved.publicToken || null,
        userId: saved.userId || null,
        updatedAt: saved.updatedAt || new Date().toISOString(),
      };
      kite.setAccessToken(saved.accessToken);
      // eslint-disable-next-line no-console
      console.log("[Kite] Restored persisted access token from disk");
      // Kick market stream sync if your helper depends on auth.accessToken.
      bumpMarketStreamResync();
    }
  }
} catch {
  // ignore disk issues
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser tools (curl/postman) and local dev origins.
      if (!origin) return callback(null, true);
      const allowed =
        origin === frontendOrigin ||
        /^http:\/\/localhost:\d+$/.test(origin) ||
        /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);
      return callback(allowed ? null : new Error("Not allowed by CORS"), allowed);
    },
    credentials: true,
  }),
);
app.use(
  express.json({
    limit: "6mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf?.toString?.() || "";
    },
  }),
);

const createToken = (user) =>
  jwt.sign({ sub: user.id, email: user.email }, jwtSecret, {
    expiresIn: "7d",
  });

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ status: "error", message: "Missing token" });

  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = getUserById(payload.sub);
    if (!user) return res.status(401).json({ status: "error", message: "Invalid token user" });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ status: "error", message: "Invalid or expired token" });
  }
};

const ensureAdmin = (req, res, next) => {
  const userEmail = String(req.user?.email || "").trim().toLowerCase();
  if (!adminEmail) return res.status(500).json({ status: "error", message: "ADMIN_EMAIL not set on server" });
  if (!userEmail || userEmail !== adminEmail) {
    return res.status(403).json({ status: "error", message: "Admin only" });
  }
  return next();
};

const ensureAuth = (req, res, next) => {
  if (!auth.accessToken) {
    return res.status(401).json({
      status: "error",
      message: "Kite not authenticated. Complete /kite/login first.",
    });
  }
  kite.setAccessToken(auth.accessToken);
  return next();
};

const buildInstrumentKey = (payload) => {
  if (payload.instrumentType === "FO") {
    return [
      payload.symbol,
      payload.optionType || "CE",
      payload.strike || 0,
      payload.expiry || "NA",
    ].join(":");
  }
  return `EQ:${payload.symbol}`;
};

const resolveKiteSymbolFromPosition = (p) => {
  const kiteSym = String(p?.kiteSymbol || "").trim();
  if (kiteSym) return kiteSym;
  const instrumentType = String(p?.instrumentType || "").toUpperCase();
  if (instrumentType === "EQ") {
    const sym = String(p?.symbol || "").replace(/\s/g, "").toUpperCase();
    if (!sym) return null;
    return `NSE:${sym}`;
  }
  return null;
};

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    authenticated: Boolean(auth.accessToken),
    userId: auth.userId,
    updatedAt: auth.updatedAt,
  });
});

/** Public: market closed / reopen notice (admin-controlled). */
app.get("/api/market-banner", (_req, res) => {
  const s = getSiteSettings();
  const b = s.marketBanner || {};
  const enabled = Boolean(b.enabled);
  const closedOn = String(b.closedOn || "").trim();
  const opensAt = String(b.opensAt || "").trim();
  const message =
    enabled && closedOn && opensAt
      ? `Please note that markets are closed on ${closedOn} and will open at ${opensAt}.`
      : enabled && (closedOn || opensAt)
        ? `Please note that markets are closed on ${closedOn || "the scheduled date"} and will open at ${opensAt || "the scheduled time"}.`
        : "";
  return res.json({ status: "ok", enabled, closedOn, opensAt, message });
});

app.post("/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ status: "error", message: "name, email, password are required" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ status: "error", message: "Password should be at least 6 characters" });
    }

    const existing = getUserByEmail(email);
    if (existing) return res.status(409).json({ status: "error", message: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = createUser({
      id: randomUUID(),
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      passwordHash,
      walletInr: defaultWalletBalance,
      realWalletInr: 0,
      realizedPnlInr: 0,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
    });

    const token = createToken(user);
    return res.status(201).json({
      status: "ok",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        walletInr: user.walletInr,
        realWalletInr: Number(user.realWalletInr || 0),
        realizedPnlInr: Number(user.realizedPnlInr || 0),
        avatarUrl: user.avatarUrl || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error?.message || "Signup failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ status: "error", message: "email and password are required" });
    }

    const user = getUserByEmail(email);
    if (!user) return res.status(401).json({ status: "error", message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ status: "error", message: "Invalid credentials" });
    const normalizedUser = ensureUserFinancials(user);

    const token = createToken(normalizedUser);
    return res.json({
      status: "ok",
      token,
      user: {
        id: normalizedUser.id,
        name: normalizedUser.name,
        email: normalizedUser.email,
        walletInr: normalizedUser.walletInr,
        realWalletInr: normalizedUser.realWalletInr,
        realizedPnlInr: Number(normalizedUser.realizedPnlInr || 0),
        avatarUrl: normalizedUser.avatarUrl || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error?.message || "Login failed" });
  }
});

app.get("/auth/me", authMiddleware, (req, res) => {
  const pruned = pruneExitedPositionsBeforeToday(req.user.positions || []);
  const persisted = updateUser(req.user.id, (prev) => ({
    ...prev,
    positions: pruned,
    updatedAt: new Date().toISOString(),
  }));
  const user = ensureUserFinancials(persisted || req.user);
  res.json({
    status: "ok",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      walletInr: user.walletInr,
      realWalletInr: Number(user.realWalletInr || 0),
      realizedPnlInr: Number(user.realizedPnlInr || 0),
      avatarUrl: user.avatarUrl || null,
    },
  });
});

/** Start Google OAuth (browser redirect). */
app.get("/auth/google", (req, res) => {
  if (!googleOAuthClient) {
    return res.status(503).send("Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }
  const redirectUri = getGoogleOAuthRedirectUri(req);
  const state = randomUUID();
  saveOAuthState(state);
  const url = googleOAuthClient.generateAuthUrl({
    access_type: "online",
    scope: [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    state,
    prompt: "select_account",
    redirect_uri: redirectUri,
  });
  res.redirect(url);
});

/** Google redirects here with ?code=&state= */
app.get("/auth/google/callback", async (req, res) => {
  const qErr = req.query.error;
  if (qErr) {
    return res.redirect(`${frontendOrigin}/login?error=${encodeURIComponent(String(qErr))}`);
  }
  const code = req.query.code;
  const state = req.query.state;
  if (!googleOAuthClient) {
    return res.redirect(`${frontendOrigin}/login?error=oauth_not_configured`);
  }
  if (typeof code !== "string" || typeof state !== "string" || !consumeOAuthState(state)) {
    return res.redirect(`${frontendOrigin}/login?error=invalid_state`);
  }
  try {
    const redirectUri = getGoogleOAuthRedirectUri(req);
    const { tokens } = await googleOAuthClient.getToken({ code, redirect_uri: redirectUri });
    if (!tokens.access_token) throw new Error("No access token from Google");

    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) throw new Error(`Google userinfo ${userRes.status}`);
    const profile = await userRes.json();

    const email = String(profile.email || "")
      .trim()
      .toLowerCase();
    const name = String(profile.name || profile.given_name || email.split("@")[0] || "User").trim();
    const sub = String(profile.sub || "");
    const avatarUrl = String(profile.picture || "").trim() || null;
    if (!email) throw new Error("Google did not return an email");

    let user = getUserByEmail(email);
    if (!user) {
      const passwordHash = await bcrypt.hash(randomUUID() + sub + jwtSecret, 10);
      user = createUser({
        id: randomUUID(),
        name,
        email,
        passwordHash,
        googleSub: sub,
        walletInr: defaultWalletBalance,
        realWalletInr: 0,
        realizedPnlInr: 0,
        avatarUrl,
        createdAt: new Date().toISOString(),
      });
    } else if (sub) {
      const linked = updateUser(user.id, (prev) => ({ ...prev, googleSub: sub, avatarUrl: prev.avatarUrl || avatarUrl }));
      if (linked) user = linked;
    }

    const token = createToken(user);
    return res.redirect(`${frontendOrigin}/login#token=${encodeURIComponent(token)}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Google OAuth callback error:", e?.message || e);
    return res.redirect(`${frontendOrigin}/login?error=google_auth_failed`);
  }
});

app.get("/wallet", authMiddleware, (req, res) => {
  res.json({
    status: "ok",
    walletInr: req.user.walletInr,
    formatted: `₹${Number(req.user.walletInr).toLocaleString("en-IN")}`,
  });
});

app.post("/wallet/reset", authMiddleware, (req, res) => {
  const updated = updateUser(req.user.id, (prev) => ({
    ...prev,
    walletInr: defaultWalletBalance,
    realizedPnlInr: 0,
    updatedAt: new Date().toISOString(),
  }));
  if (!updated) return res.status(404).json({ status: "error", message: "User not found" });
  return res.json({
    status: "ok",
    walletInr: updated.walletInr,
    formatted: `₹${Number(updated.walletInr).toLocaleString("en-IN")}`,
  });
});

app.post("/payments/razorpay/order", authMiddleware, async (req, res) => {
  try {
    if (!razorpay || !razorpayKeyId) {
      return res.status(503).json({ status: "error", message: "Razorpay not configured" });
    }
    const amountInr = Number(req.body?.amountInr || 0);
    if (!Number.isFinite(amountInr) || amountInr <= 0) {
      return res.status(400).json({ status: "error", message: "amountInr must be positive" });
    }
    const amountPaise = Math.round(amountInr * 100);
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `rw_${req.user.id.slice(0, 8)}_${Date.now()}`,
      notes: {
        userId: req.user.id,
        userEmail: req.user.email,
      },
    });
    return res.json({
      status: "ok",
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      keyId: razorpayKeyId,
    });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e?.message || "Could not create payment order" });
  }
});

app.post("/payments/razorpay/verify", authMiddleware, (req, res) => {
  try {
    if (!razorpayKeySecret) {
      return res.status(503).json({ status: "error", message: "Razorpay not configured" });
    }
    const orderId = String(req.body?.razorpay_order_id || "");
    const paymentId = String(req.body?.razorpay_payment_id || "");
    const signature = String(req.body?.razorpay_signature || "");
    const amountInr = Number(req.body?.amountInr || 0);
    if (!orderId || !paymentId || !signature || !(amountInr > 0)) {
      return res.status(400).json({ status: "error", message: "Invalid payment payload" });
    }
    const expected = createHmac("sha256", razorpayKeySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    if (expected !== signature) {
      return res.status(400).json({ status: "error", message: "Invalid payment signature" });
    }

    const user = ensureUserFinancials(req.user);
    const alreadyCredited = user.walletPayments.some((p) => p.paymentId === paymentId);
    if (alreadyCredited) {
      return res.json({ status: "ok", realWalletInr: user.realWalletInr, duplicate: true });
    }

    const updated = updateUser(req.user.id, (prev) => {
      const normalized = ensureUserFinancials(prev);
      return {
        ...normalized,
        realWalletInr: Number((normalized.realWalletInr + amountInr).toFixed(2)),
        walletPayments: [
          ...normalized.walletPayments,
          {
            id: randomUUID(),
            amountInr: Number(amountInr.toFixed(2)),
            orderId,
            paymentId,
            signature,
            createdAt: new Date().toISOString(),
            via: "razorpay",
          },
        ],
        updatedAt: new Date().toISOString(),
      };
    });
    if (!updated) return res.status(404).json({ status: "error", message: "User not found" });
    return res.json({ status: "ok", realWalletInr: Number(updated.realWalletInr || 0) });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e?.message || "Payment verification failed" });
  }
});

app.post("/payments/cashfree/order", authMiddleware, async (req, res) => {
  try {
    if (!cashfreeAppId || !cashfreeSecretKey) {
      return res.status(503).json({ status: "error", message: "Cashfree not configured" });
    }

    const amountInr = Number(req.body?.amountInr || 0);
    if (!Number.isFinite(amountInr) || amountInr <= 0) {
      return res.status(400).json({ status: "error", message: "amountInr must be positive" });
    }

    const orderId = `cf_${randomUUID()}`;
    const configuredReturnUrl = String(process.env.CASHFREE_RETURN_URL || "").trim();
    const defaultReturnUrl = "https://growwtrader.in/profile";
    const safeReturnUrl = configuredReturnUrl.startsWith("https://")
      ? configuredReturnUrl
      : defaultReturnUrl;
    const returnUrl = `${safeReturnUrl}${safeReturnUrl.includes("?") ? "&" : "?"}cashfreeOrderId=${encodeURIComponent(orderId)}`;

    const customerPhone = String(req.user.phone || req.user.mobile || "").trim();
    const resolvedPhone = /^[6-9]\d{9}$/.test(customerPhone)
      ? customerPhone
      : "9999999999";

    const body = {
      order_id: orderId,
      order_amount: Number(amountInr.toFixed(2)),
      order_currency: "INR",
      order_note: "Top up real wallet",
      customer_details: {
        customer_id: req.user.id,
        customer_email: req.user.email,
        customer_phone: resolvedPhone,
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: cashfreeNotifyUrl,
      },
    };

    // Debug output
    console.log("[Cashfree] create order", {
      cashfreeEnv,
      cashfreeApiBase,
      cashfreeAppId,
      cashfreeNotifyUrl,
      orderId,
      amountInr,
      returnUrl,
      body,
    });

    const cfResponse = await fetch(`${cashfreeApiBase}/pg/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": cashfreeAppId,
        "x-client-secret": cashfreeSecretKey,
        "x-api-version": cashfreeApiVersion,
      },
      body: JSON.stringify(body),
    });

    const cfData = await cfResponse.json().catch(() => ({}));
    console.log("[Cashfree] response", {
      status: cfResponse.status,
      statusText: cfResponse.statusText,
      cfData,
    });
    if (!cfResponse.ok || (cfData.status && cfData.status !== "OK" && cfData.status !== "SUCCESS")) {
      const msg = cfData.message || cfData.msg || "Could not create Cashfree order";
      return res.status(502).json({ status: "error", message: msg, raw: cfData });
    }

    const paymentLink =
      cfData.data?.payment_link ||
      cfData.data?.payment_link_url ||
      cfData.data?.payment_url ||
      cfData.data?.checkout_url ||
      cfData.data?.link ||
      cfData.payment_link ||
      cfData.link;

    if (!paymentLink) {
      return res.status(502).json({
        status: "error",
        message: "Cashfree did not return payment link",
        raw: cfData,
      });
    }

    const cashfreeOrderId = cfData.data?.order_id || cfData.order_id || "";

    updateUser(req.user.id, (prev) => {
      const normalized = ensureUserFinancials(prev);
      return {
        ...normalized,
        cashfreePayments: [
          ...normalized.cashfreePayments,
          {
            orderId,
            cashfreeOrderId,
            amountInr,
            status: "PENDING",
            createdAt: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      };
    });

    return res.json({ status: "ok", paymentLink, orderId });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e?.message || "Could not create Cashfree order" });
  }
});

app.post("/payments/cashfree/webhook", async (req, res) => {
  try {
    if (!cashfreeSecretKey) {
      return res.status(503).json({ status: "error", message: "Cashfree not configured" });
    }

    const signature = String(req.headers["x-webhook-signature"] || "");
    const timestamp = String(req.headers["x-webhook-timestamp"] || "");
    const raw = String(req.rawBody || "");
    const signedPayload = `${timestamp}${raw}`;
    const expected = createHmac("sha256", cashfreeSecretKey).update(signedPayload).digest("base64");
    if (!signature || !timestamp || signature !== expected) {
      return res.status(400).json({ status: "error", message: "Invalid webhook signature" });
    }

    const payload = req.body || {};
    const data = payload.data || {};
    const order = data.order || {};
    const payment = data.payment || {};
    const customer = data.customer_details || order.customer_details || {};

    const orderId = String(order.order_id || "");
    const event = String(payload.type || "").toUpperCase();
    const status = String(payment.payment_status || "").toUpperCase();
    const amountInr = Number(order.order_amount || payment.payment_amount || 0);
    const userId = String(customer.customer_id || "");

    console.log("[Cashfree webhook] payload", { payload, orderId, event, status, amountInr, userId });

    if (!orderId || !userId) {
      return res.status(400).json({ status: "error", message: "Missing order_id or customer_id" });
    }

    const paid = isCashfreePaid(status) || isCashfreePaid(event);
    const updated = settleCashfreeOrderForUser({
      userId,
      orderId,
      amountInr,
      paid,
      paymentId: String(payment.cf_payment_id || ""),
      signature,
    });
    if (!updated) return res.status(404).json({ status: "error", message: "User not found" });

    return res.json({ status: "ok" });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e?.message || "Webhook handling failed" });
  }
});

app.get("/payments/cashfree/status/:orderId", authMiddleware, async (req, res) => {
  try {
    const orderId = String(req.params.orderId || "");
    if (!orderId) return res.status(400).json({ status: "error", message: "orderId required" });

    let user = ensureUserFinancials(req.user);
    let record = (user.cashfreePayments || []).find((p) => p.orderId === orderId);
    if (!record) return res.status(404).json({ status: "error", message: "Order not found" });

    // If webhook is delayed/missed, reconcile directly with Cashfree and settle here.
    if (String(record.status || "").toUpperCase() !== "PAID") {
      const verify = await fetchCashfreeOrderPaidStatus(orderId);
      if (verify.ok && verify.paid) {
        const updated = settleCashfreeOrderForUser({
          userId: user.id,
          orderId,
          amountInr: Number(verify.amountInr || record.amountInr || 0),
          paid: true,
          paymentId: String(verify.paymentId || ""),
          signature: "status-reconcile",
        });
        if (updated) {
          user = ensureUserFinancials(updated);
          record = (user.cashfreePayments || []).find((p) => p.orderId === orderId) || record;
        }
      }
    }

    return res.json({ status: "ok", order: record, realWalletInr: Number(user.realWalletInr || 0) });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e?.message || "Status check failed" });
  }
});

/** Optional server-to-server reconciliation webhook from Razorpay. */
app.post("/payments/razorpay/webhook", (req, res) => {
  try {
    if (!razorpayWebhookSecret) {
      return res.status(503).json({ status: "error", message: "Webhook secret not configured" });
    }
    const signature = String(req.headers["x-razorpay-signature"] || "");
    const raw = String(req.rawBody || "");
    const expected = createHmac("sha256", razorpayWebhookSecret).update(raw).digest("hex");
    if (!signature || signature !== expected) {
      return res.status(400).json({ status: "error", message: "Invalid webhook signature" });
    }

    const event = req.body?.event;
    const payment = req.body?.payload?.payment?.entity;
    if (!payment?.id) return res.json({ status: "ok", ignored: true });
    if (event !== "payment.captured" && event !== "order.paid") {
      return res.json({ status: "ok", ignored: true, event });
    }

    const userId = String(payment?.notes?.userId || "");
    const amountInr = Number(payment?.amount || 0) / 100;
    const orderId = String(payment?.order_id || "");
    const paymentId = String(payment?.id || "");
    if (!userId || !(amountInr > 0) || !paymentId) {
      return res.json({ status: "ok", ignored: true, reason: "missing user or amount" });
    }

    const user = getUserById(userId);
    if (!user) return res.json({ status: "ok", ignored: true, reason: "user not found" });
    const normalized = ensureUserFinancials(user);
    const already = normalized.walletPayments.some((p) => p.paymentId === paymentId);
    if (already) return res.json({ status: "ok", duplicate: true });

    updateUser(userId, (prev) => {
      const u = ensureUserFinancials(prev);
      return {
        ...u,
        realWalletInr: Number((u.realWalletInr + amountInr).toFixed(2)),
        walletPayments: [
          ...u.walletPayments,
          {
            id: randomUUID(),
            amountInr: Number(amountInr.toFixed(2)),
            orderId,
            paymentId,
            signature,
            createdAt: new Date().toISOString(),
            via: "webhook",
          },
        ],
        updatedAt: new Date().toISOString(),
      };
    });
    return res.json({ status: "ok" });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e?.message || "Webhook handling failed" });
  }
});

app.post("/wallet/real/add", authMiddleware, (req, res) => {
  const amount = Number(req.body?.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ status: "error", message: "amount must be positive" });
  }
  const updated = updateUser(req.user.id, (prev) => ({
    ...prev,
    realWalletInr: Number((Number(prev.realWalletInr || 0) + amount).toFixed(2)),
    updatedAt: new Date().toISOString(),
  }));
  if (!updated) return res.status(404).json({ status: "error", message: "User not found" });
  return res.json({
    status: "ok",
    realWalletInr: Number(updated.realWalletInr || 0),
  });
});

app.post("/wallet/withdraw/request", authMiddleware, (req, res) => {
  const amountInr = Number(req.body?.amountInr || 0);
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    return res.status(400).json({ status: "error", message: "amountInr must be positive" });
  }
  const user = ensureUserFinancials(req.user);
  if (user.realWalletInr < amountInr) {
    return res.status(400).json({ status: "error", message: "Insufficient real balance" });
  }
  const requestId = randomUUID();
  const updated = updateUser(req.user.id, (prev) => {
    const normalized = ensureUserFinancials(prev);
    return {
      ...normalized,
      realWalletInr: Number((normalized.realWalletInr - amountInr).toFixed(2)),
      withdrawalRequests: [
        ...normalized.withdrawalRequests,
        {
          id: requestId,
          amountInr: Number(amountInr.toFixed(2)),
          status: "PENDING",
          requestedAt: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    };
  });
  return res.json({
    status: "ok",
    requestId,
    realWalletInr: Number(updated?.realWalletInr || 0),
  });
});

app.get("/wallet/withdraw/requests", authMiddleware, (req, res) => {
  const u = ensureUserFinancials(req.user);
  return res.json({ status: "ok", requests: u.withdrawalRequests || [] });
});

app.patch("/auth/profile", authMiddleware, (req, res) => {
  const nextName = req.body?.name != null ? String(req.body.name).trim() : null;
  const nextAvatar = req.body?.avatarUrl != null ? String(req.body.avatarUrl).trim() : null;
  if (nextName !== null && nextName.length === 0) {
    return res.status(400).json({ status: "error", message: "name cannot be empty" });
  }
  const updated = updateUser(req.user.id, (prev) => ({
    ...prev,
    ...(nextName !== null ? { name: nextName } : {}),
    ...(nextAvatar !== null ? { avatarUrl: nextAvatar || null } : {}),
    updatedAt: new Date().toISOString(),
  }));
  if (!updated) return res.status(404).json({ status: "error", message: "User not found" });
  return res.json({
    status: "ok",
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      walletInr: Number(updated.walletInr || 0),
      realWalletInr: Number(updated.realWalletInr || 0),
      realizedPnlInr: Number(updated.realizedPnlInr || 0),
      avatarUrl: updated.avatarUrl || null,
    },
  });
});

app.get("/contest/current", authMiddleware, (req, res) => {
  const contest = currentContestOrCreate();
  const capped = augmentContestForApi(contest);
  const practiceContest = currentPracticeContestForApi();
  const uid = req.user.id;
  const joined = (capped?.participants || []).some((p) => p.userId === uid);
  return res.json({
    status: "ok",
    contest: capped,
    prizeContest: capped,
    practiceContest,
    joined,
    joinedPrize: joined,
    joinedPractice: true,
    realWalletInr: Number(req.user.realWalletInr || 0),
  });
});

app.post("/contest/join", authMiddleware, (req, res) => {
  const hiddenSet = hiddenLeaderboardUserSet();
  if (hiddenSet.has(String(req.user.id))) {
    return res.status(400).json({ status: "error", message: "User is removed from leaderboard participation" });
  }
  const contest = currentContestOrCreate();
  if (contest.status !== "OPEN") {
    return res.status(400).json({ status: "error", message: "Contest is not open" });
  }
  const already = Array.isArray(contest.participants) && contest.participants.some((p) => p.userId === req.user.id);
  if (already) return res.json({ status: "ok", contest: augmentContestForApi(contest), joined: true });
  if ((contest.participants?.length || 0) >= Number(contest.maxParticipants || maxContestParticipants)) {
    return res.status(400).json({ status: "error", message: "Contest is full" });
  }
  const fee = Number(contest.entryFeeInr || defaultContestFeeInr);
  const currentReal = Number(req.user.realWalletInr || 0);
  if (currentReal < fee) {
    return res.status(400).json({ status: "error", message: "Insufficient real balance" });
  }
  const updatedUser = updateUser(req.user.id, (prev) => ({
    ...prev,
    realWalletInr: Number((Number(prev.realWalletInr || 0) - fee).toFixed(2)),
    updatedAt: new Date().toISOString(),
  }));
  if (!updatedUser) return res.status(404).json({ status: "error", message: "User not found" });
  const updatedContest = upsertContest(contest.id, (prev) => {
    const maxCap = Number(prev?.maxParticipants || maxContestParticipants);
    const prevParticipants = Array.isArray(prev?.participants) ? prev.participants : [];
    if (prevParticipants.length >= maxCap) return { ...prev, updatedAt: new Date().toISOString() };
    return {
      ...prev,
      participants: [...prevParticipants, { userId: req.user.id, joinedAt: new Date().toISOString() }].slice(0, maxCap),
      updatedAt: new Date().toISOString(),
    };
  });
  return res.json({
    status: "ok",
    contest: augmentContestForApi(updatedContest),
    realWalletInr: Number(updatedUser.realWalletInr || 0),
  });
});

app.get("/contest/leaderboard", authMiddleware, async (req, res) => {
  const contest = currentContestOrCreate();
  const cappedContest = augmentContestForApi(contest);
  const practiceContest = currentPracticeContestForApi();
  const dayISO = String(cappedContest?.contestDateISO || todayISOInIST());
  const hiddenSet = hiddenLeaderboardUserSet();
  const participants = cappedContest?.participants || [];
  const minParticipants = Math.max(1, Number(contest.minParticipants || minContestParticipants));
  const contestStarted = participants.length >= minParticipants;
  const joinedAtByUserId = new Map(
    participants.map((p) => [String(p.userId), String(p.joinedAt || "")]),
  );
  const users = getAllUsers().filter((u) => participants.some((p) => p.userId === u.id) && !hiddenSet.has(String(u.id)));
  const practiceUsers = getAllUsers().filter((u) => !hiddenSet.has(String(u.id)));

  // If not started, keep leaderboard stable + non-winner (no P&L).
  if (!contestStarted) {
    const ordered = [...users].sort((a, b) => {
      const aa = joinedAtByUserId.get(a.id) || "";
      const bb = joinedAtByUserId.get(b.id) || "";
      const da = Number.isFinite(Date.parse(aa)) ? Date.parse(aa) : 0;
      const db = Number.isFinite(Date.parse(bb)) ? Date.parse(bb) : 0;
      return da - db;
    });
    const leaderboard = ordered.map((u, idx) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl || null,
      totalPnlInr: 0,
      rank: null,
    }));
    const practiceQuotes = await getQuotesForUsersDay(practiceUsers, dayISO);
    const practiceLeaderboard = dailyContestLeaderboardForUsers(practiceUsers, dayISO, practiceQuotes);
    const me = leaderboard.find((x) => x.userId === req.user.id) || null;
    const mePractice = practiceLeaderboard.find((x) => x.userId === req.user.id) || null;
    return res.json({
      status: "ok",
      contest: cappedContest,
      prizeContest: cappedContest,
      practiceContest,
      leaderboard,
      prizeLeaderboard: leaderboard,
      practiceLeaderboard,
      myRank: null,
      myPrizeRank: null,
      myPracticeRank: mePractice?.rank || null,
      participantCount: participants.length,
    });
  }

  const allQuotes = await getQuotesForUsersDay(practiceUsers, dayISO);
  const leaderboard = dailyContestLeaderboardForUsers(users, dayISO, allQuotes);
  const practiceLeaderboard = dailyContestLeaderboardForUsers(practiceUsers, dayISO, allQuotes);
  const me = leaderboard.find((x) => x.userId === req.user.id) || null;
  const mePractice = practiceLeaderboard.find((x) => x.userId === req.user.id) || null;
  return res.json({
    status: "ok",
    contest: cappedContest,
    prizeContest: cappedContest,
    practiceContest,
    leaderboard,
    prizeLeaderboard: leaderboard,
    practiceLeaderboard,
    myRank: me?.rank || null,
    myPrizeRank: me?.rank || null,
    myPracticeRank: mePractice?.rank || null,
    participantCount: participants.length,
  });
});

app.get("/paper/orders", authMiddleware, (req, res) => {
  const orders = req.user.orders || [];
  res.json({ status: "ok", orders: [...orders].reverse() });
});

app.get("/paper/positions", authMiddleware, (req, res) => {
  const pruned = pruneExitedPositionsBeforeToday(req.user.positions || []);
  const persisted = updateUser(req.user.id, (prev) => ({
    ...prev,
    positions: pruned,
    updatedAt: new Date().toISOString(),
  }));
  const positions = persisted?.positions || pruned;
  res.json({ status: "ok", positions });
});

// -------------------------
// Admin (paper data only)
// -------------------------
app.get("/admin/summary/today", authMiddleware, ensureAdmin, (req, res) => {
  const users = getAllUsers().filter((u) => !isSeededUser(u));
  const today = isoDateInIST(new Date());
  const signupsToday = users.filter((u) => isoDateInIST(u.createdAt) === today);
  return res.json({
    status: "ok",
    today,
    signupsTodayCount: signupsToday.length,
    signupsToday: signupsToday.map((u) => ({ id: u.id, email: u.email, createdAt: u.createdAt })),
  });
});

/** Last N calendar days (IST) with signup counts and emails — for admin table. */
app.get("/admin/signups/daily", authMiddleware, ensureAdmin, (req, res) => {
  const users = getAllUsers().filter((u) => !isSeededUser(u));
  const days = Math.min(90, Math.max(1, Number(req.query.days || 14)));
  const dates = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    dates.push(isoDateInIST(new Date(Date.now() - i * 86400000)));
  }
  const byDate = new Map();
  for (const u of users) {
    const d = isoDateInIST(u.createdAt);
    if (!d) continue;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push({ id: u.id, email: u.email, createdAt: u.createdAt });
  }
  const rows = dates.map((date) => {
    const signups = byDate.get(date) || [];
    return { date, count: signups.length, signups };
  });
  return res.json({ status: "ok", rows });
});

app.get("/admin/users", authMiddleware, ensureAdmin, (req, res) => {
  const users = getAllUsers().filter((u) => !isSeededUser(u));
  return res.json({
    status: "ok",
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      walletInr: Number(u.walletInr ?? 0),
      realWalletInr: Number(u.realWalletInr ?? 0),
      realizedPnlInr: Number(u.realizedPnlInr ?? 0),
      createdAt: u.createdAt,
      ordersCount: Array.isArray(u.orders) ? u.orders.length : 0,
      positionsCount: Array.isArray(u.positions) ? u.positions.length : 0,
    })),
  });
});

app.post("/admin/users/delete", authMiddleware, ensureAdmin, (req, res) => {
  const ids = Array.isArray(req.body?.userIds) ? req.body.userIds.map((x) => String(x)) : [];
  if (!ids.length) return res.status(400).json({ status: "error", message: "userIds are required" });
  const idSet = new Set(ids);
  const db = readAllData();
  const users = Array.isArray(db.users) ? db.users : [];
  const contests = Array.isArray(db.contests) ? db.contests : [];
  const nextUsers = users.filter((u) => !idSet.has(String(u.id)));
  const nextContests = contests.map((c) => ({
    ...c,
    participants: (Array.isArray(c?.participants) ? c.participants : []).filter((p) => !idSet.has(String(p.userId))),
    payouts: (Array.isArray(c?.payouts) ? c.payouts : []).filter((p) => !idSet.has(String(p.userId))),
    updatedAt: new Date().toISOString(),
  }));
  const prevHidden = Array.isArray(db?.siteSettings?.leaderboardHiddenUserIds)
    ? db.siteSettings.leaderboardHiddenUserIds.map((x) => String(x))
    : [];
  const nextHidden = prevHidden.filter((x) => !idSet.has(String(x)));
  writeAllData({
    users: nextUsers,
    contests: nextContests,
    siteSettings: {
      ...(db.siteSettings || {}),
      leaderboardHiddenUserIds: nextHidden,
    },
  });
  return res.json({ status: "ok", deleted: users.length - nextUsers.length });
});

app.post("/admin/leaderboard/remove-users", authMiddleware, ensureAdmin, (req, res) => {
  const ids = Array.isArray(req.body?.userIds) ? req.body.userIds.map((x) => String(x)) : [];
  if (!ids.length) return res.status(400).json({ status: "error", message: "userIds are required" });
  const idSet = new Set(ids);
  const settings = updateSiteSettings((prev) => {
    const cur = Array.isArray(prev?.leaderboardHiddenUserIds) ? prev.leaderboardHiddenUserIds.map((x) => String(x)) : [];
    return {
      ...prev,
      leaderboardHiddenUserIds: [...new Set([...cur, ...ids])],
    };
  });
  const contest = currentContestOrCreate();
  const updatedContest = upsertContest(contest.id, (prev) => ({
    ...prev,
    participants: (Array.isArray(prev?.participants) ? prev.participants : []).filter((p) => !idSet.has(String(p.userId))),
    payouts: (Array.isArray(prev?.payouts) ? prev.payouts : []).filter((p) => !idSet.has(String(p.userId))),
    updatedAt: new Date().toISOString(),
  }));
  return res.json({
    status: "ok",
    hiddenUserIds: settings.leaderboardHiddenUserIds || [],
    contest: augmentContestForApi(updatedContest),
  });
});

app.get("/admin/withdrawals", authMiddleware, ensureAdmin, (req, res) => {
  const users = getAllUsers();
  const rows = [];
  for (const u of users) {
    const requests = Array.isArray(u.withdrawalRequests) ? u.withdrawalRequests : [];
    for (const r of requests) {
      rows.push({
        userId: u.id,
        userEmail: u.email,
        userName: u.name,
        ...r,
      });
    }
  }
  rows.sort((a, b) => Date.parse(b.requestedAt || "") - Date.parse(a.requestedAt || ""));
  return res.json({ status: "ok", withdrawals: rows });
});

app.post("/admin/withdrawals/:userId/:requestId/approve", authMiddleware, ensureAdmin, (req, res) => {
  const { userId, requestId } = req.params;
  const target = getUserById(userId);
  if (!target) return res.status(404).json({ status: "error", message: "User not found" });
  const updated = updateUser(userId, (prev) => {
    const normalized = ensureUserFinancials(prev);
    const requests = normalized.withdrawalRequests.map((r) =>
      r.id === requestId && r.status === "PENDING"
        ? { ...r, status: "APPROVED", reviewedAt: new Date().toISOString() }
        : r,
    );
    return { ...normalized, withdrawalRequests: requests, updatedAt: new Date().toISOString() };
  });
  return res.json({ status: "ok", requests: updated?.withdrawalRequests || [] });
});

app.post("/admin/withdrawals/:userId/:requestId/reject", authMiddleware, ensureAdmin, (req, res) => {
  const { userId, requestId } = req.params;
  const target = getUserById(userId);
  if (!target) return res.status(404).json({ status: "error", message: "User not found" });
  const updated = updateUser(userId, (prev) => {
    const normalized = ensureUserFinancials(prev);
    let nextBalance = normalized.realWalletInr;
    const requests = normalized.withdrawalRequests.map((r) => {
      if (r.id !== requestId || r.status !== "PENDING") return r;
      nextBalance = Number((nextBalance + Number(r.amountInr || 0)).toFixed(2));
      return { ...r, status: "REJECTED", reviewedAt: new Date().toISOString() };
    });
    return { ...normalized, realWalletInr: nextBalance, withdrawalRequests: requests, updatedAt: new Date().toISOString() };
  });
  return res.json({ status: "ok", requests: updated?.withdrawalRequests || [] });
});

app.get("/admin/contest/current", authMiddleware, ensureAdmin, (req, res) => {
  const contest = currentContestOrCreate();
  return res.json({ status: "ok", contest: augmentContestForApi(contest) });
});

app.get("/admin/contest/winners", authMiddleware, ensureAdmin, async (req, res) => {
  const contest = currentContestOrCreate();
  const hiddenSet = hiddenLeaderboardUserSet();
  const users = getAllUsers().filter((u) => !hiddenSet.has(String(u.id)));
  const dayISO = String(contest?.contestDateISO || todayISOInIST());
  const userById = new Map(users.map((u) => [u.id, u]));
  const participants = Array.isArray(contest?.participants) ? contest.participants : [];
  const prizeUsers = participants
    .map((p) => userById.get(String(p.userId)))
    .filter(Boolean);
  const prizeQuotes = await getQuotesForUsersDay(prizeUsers, dayISO);
  const practiceQuotes = await getQuotesForUsersDay(users, dayISO);
  const computedPrize = dailyContestLeaderboardForUsers(prizeUsers, dayISO, prizeQuotes).slice(0, 3);
  const computedPrizeByUserId = new Map(computedPrize.map((r) => [r.userId, r]));
  const prizeTop3 =
    contest?.status === "FINALIZED" && Array.isArray(contest?.payouts) && contest.payouts.length
      ? contest.payouts
          .slice()
          .sort((a, b) => Number(a.rank || 0) - Number(b.rank || 0))
          .slice(0, 3)
          .map((p) => {
            const u = userById.get(String(p.userId));
            return {
              rank: Number(p.rank || 0),
              userId: String(p.userId),
              name: String(u?.name || "Unknown"),
              email: String(u?.email || ""),
              totalPnlInr: Number(computedPrizeByUserId.get(String(p.userId))?.totalPnlInr || 0),
              amountInr: Number(p.amountInr || 0),
              payoutStatus: String(p.status || "PENDING"),
            };
          })
      : computedPrize.map((r) => ({ ...r, amountInr: 0, payoutStatus: contest?.status === "FINALIZED" ? "PENDING" : "NOT_FINALIZED" }));

  const practiceTop3 = dailyContestLeaderboardForUsers(users, dayISO, practiceQuotes).slice(0, 3).map((r) => ({
    ...r,
    amountInr: 0,
    payoutStatus: "PRACTICE",
  }));

  return res.json({
    status: "ok",
    contestDateISO: activeContestDateISO(),
    prizeFinalized: contest?.status === "FINALIZED",
    prizeTop3,
    practiceTop3,
  });
});

app.get("/admin/market-banner", authMiddleware, ensureAdmin, (req, res) => {
  return res.json({ status: "ok", marketBanner: getSiteSettings().marketBanner });
});

app.post("/admin/market-banner", authMiddleware, ensureAdmin, (req, res) => {
  const { enabled, closedOn, opensAt } = req.body || {};
  const next = updateSiteSettings((prev) => ({
    ...prev,
    marketBanner: {
      ...prev.marketBanner,
      ...(typeof enabled === "boolean" ? { enabled } : {}),
      ...(closedOn !== undefined ? { closedOn: String(closedOn || "").trim() } : {}),
      ...(opensAt !== undefined ? { opensAt: String(opensAt || "").trim() } : {}),
    },
  }));
  return res.json({ status: "ok", marketBanner: next.marketBanner });
});

app.post("/admin/contest/seed-dummy", authMiddleware, ensureAdmin, async (req, res) => {
  const requestedCount = Number(req.body?.count || 250);
  const count = Number.isFinite(requestedCount) && requestedCount > 0 ? Math.floor(requestedCount) : 250;

  const contest = currentContestOrCreate();
  if (!contest || contest.status !== "OPEN") {
    return res.status(400).json({ status: "error", message: "No OPEN contest to seed" });
  }

  const participants = Array.isArray(contest.participants) ? contest.participants : [];
  const remaining = Math.max(0, Number(contest.maxParticipants || maxContestParticipants) - participants.length);
  const toAdd = Math.min(count, remaining);

  if (toAdd <= 0) return res.json({ status: "ok", contest: augmentContestForApi(contest), added: 0 });

  // Avoid name repetition within a seeded batch.
  const seedFirstNames = [
    "Ramesh",
    "Pooja Patel",
    "Nitin Yadav",
    "Kavita",
    "Imran Khan",
    "Meena Prajapati",
    "Suresh",
    "Aarti Shah",
    "Raju Bharwad",
    "Neha",
    "Manoj Singh",
    "Farida",
    "Jignesh Patel",
    "Rekha",
    "Salim Khan",
    "Heena Mistry",
    "Ashok",
    "Kiran Desai",
    "Bharat",
    "Shabnam",
    "Prakash Yadav",
    "Pinal Patel",
    "Dinesh",
    "Nagma",
    "Yusuf Khan",
    "Bhavna",
    "Mahesh Prajapati",
    "Rupal",
    "Sameer Khan",
    "Usha",
    "Rajesh",
    "Sonal Shah",
    "Gopal Bharwad",
    "Anita",
    "Kunal Patel",
    "Tasneem",
    "Vinod",
    "Jyoti",
    "Arvind Yadav",
    "Zoya Khan",
    "Sandeep",
    "Komal",
    "Mukesh Patel",
    "Seema",
    "Rashid Khan",
    "Daksha",
    "Harish",
    "Neelam",
    "Paresh Shah",
    "Mariam",
    "Chandan",
    "Rachna",
    "Altaf Khan",
    "Kalpana",
    "Bhupendra Patel",
    "Rina",
    "Sohail Khan",
    "Priti",
    "Naresh",
    "Hina",
    "Tejas Shah",
    "Varsha",
    "Javed Khan",
    "Leena",
    "Rakesh",
    "Suman",
    "Nilesh Patel",
    "Rubina",
    "Iqbal Khan",
    "Bina",
    "Ajay",
    "Payal",
    "Pravin Shah",
    "Farhan Khan",
    "Shilpa",
    "Dilip",
    "Charu",
    "Keshav Yadav",
    "Afreen",
    "Mohan",
    "Gita",
    "Junaid Khan",
    "Sheetal",
    "Jagdish",
    "Ritu",
    "Hasmukh Patel",
    "Saba",
    "Sanjay",
    "Kanchan",
    "Parvez Khan",
    "Radhika",
    "Hemant",
    "Maya",
    "Bipin Patel",
    "Reshma",
    "Tariq Khan",
    "Alpa",
    "Rohit",
    "Kavya",
    "Nadeem Khan",
    "Sarita",
    "Ghanshyam",
    "Manisha",
    "Wasim Khan",
    "Kamini",
    "Vikas",
    "Sharda",
    "Adil Khan",
    "Heena",
    "Umesh",
    "Lakshmi",
    "Danish Khan",
    "Poonam",
    "Om",
    "Nirmala",
    "Nawaz Khan",
    "Bharti",
    "Ritesh",
    "Sejal",
    "Shahid Khan",
    "Trupti",
    "Chetan Patel",
    "Urmila",
    "Zubair Khan",
    "Asha",
    "Tarun",
    "Nayana",
    "Faizal Khan",
    "Meera",
    "Raj",
    "Kusum",
    "Aslam Khan",
    "Pinky",
    "Mahendra",
    "Deepak",
    "Nasreen",
    "Pradeep",
    "Vandana",
    "Irfan Khan",
    "Babita",
    "Rohan",
    "Shyam Yadav",
    "Amina Khan",
    "Yogesh",
    "Kiran",
    "Gaurav",
    "Feroza Khan",
    "Harendra",
    "Anita Patel",
    "Kamal",
    "Rukhsar Khan",
    "Suraj",
    "Hema",
    "Jayesh Patel",
    "Tabassum Khan",
    "Lata",
    "Mukund",
    "Nisha",
    "Rafiq Khan",
    "Chandrakant",
    "Priti Patel",
    "Manoj",
    "Yasmin Khan",
    "Ajit",
    "Aarti",
    "Harpreet Singh",
    "Simran Kaur",
    "Gurpreet Singh",
    "Manpreet",
    "Kuldeep Singh",
    "Jaspreet Kaur",
    "Balwinder Singh",
    "Harleen",
    "Sukhwinder Singh",
    "Navjot",
    "Amarjeet Singh",
    "Rupinder Kaur",
    "Paramjit Singh",
    "Kirandeep",
    "Gagandeep Singh",
    "Jasleen",
    "Surjit Singh",
    "Inderjeet",
    "Daljit Singh",
    "Kamaldeep",
    "Hardeep Singh",
    "Amrit",
    "Ravinder Singh",
    "Gurleen",
    "Jagjit Singh",
    "Baljeet",
    "Sandeep Singh",
    "Charanjeet",
    "Rajbir Singh",
    "Amandeep",
    "Pritam Singh",
    "Kulwinder",
    "Mohinder Singh",
    "Harjit",
    "Tejinder Singh",
    "Jaspal",
    "Surinder Singh",
    "Manjeet",
    "Satnam Singh",
    "Balraj Singh",
    "Kanchan",
    "Radhika",
    "Amandeep Kaur",
    "Gurvinder Singh",
  ];

  const existingEmails = new Set(getAllUsers().map((u) => String(u.email || "").toLowerCase()));
  const nowISO = new Date().toISOString();
  const dummyPasswordHash = await bcrypt.hash("dummyPassword123", 10);

  const usedNames = new Set();
  const dummyUsers = [];

  for (let i = 0; i < toAdd; i += 1) {
    const baseName = seedFirstNames[i % seedFirstNames.length] || `Dummy User ${i + 1}`;
    let name = String(baseName).trim();
    if (!name) name = `Dummy User ${i + 1}`;

    // Ensure no repetition within this seeded batch.
    if (usedNames.has(name)) name = `${name} ${i + 1}`;
    usedNames.add(name);

    let email = `seed-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-${i + 1}@growwseed.local`;
    email = email.slice(0, 120).toLowerCase();
    if (existingEmails.has(email)) email = `seed-${randomUUID().slice(0, 8)}-${i + 1}@growwseed.local`;
    existingEmails.add(email);

    const id = randomUUID();
    createUser({
      id,
      name,
      email,
      passwordHash: dummyPasswordHash,
      walletInr: defaultWalletBalance,
      realWalletInr: 0,
      realizedPnlInr: 0,
      avatarUrl: null,
      createdAt: nowISO,
      updatedAt: nowISO,
      orders: [],
      positions: [],
      withdrawalRequests: [],
      cashfreePayments: [],
      isSeeded: true,
      seededAt: nowISO,
    });
    dummyUsers.push({ id, name, email });
  }

  const joinedAt = nowISO;
  const updatedContest = upsertContest(contest.id, (prev) => {
    const maxCap = Number(prev?.maxParticipants || maxContestParticipants);
    const prevParticipants = Array.isArray(prev?.participants) ? prev.participants : [];
    const nextParticipants = [
      ...prevParticipants,
      ...dummyUsers.map((u) => ({ userId: u.id, joinedAt })),
    ].slice(0, Math.max(0, maxCap));
    return {
      ...prev,
      participants: nextParticipants,
      updatedAt: new Date().toISOString(),
    };
  });

  return res.json({ status: "ok", contest: augmentContestForApi(updatedContest), added: dummyUsers.length });
});

app.post("/admin/contest/unseed-dummy", authMiddleware, ensureAdmin, (req, res) => {
  const contest = currentContestOrCreate();
  const contestId = contest?.id;
  if (!contestId) return res.status(400).json({ status: "error", message: "Contest not found" });

  const db = readAllData();
  const users = Array.isArray(db.users) ? db.users : [];
  const seededIds = new Set(users.filter((u) => isSeededUser(u)).map((u) => u.id));
  const keptUsers = users.filter((u) => !seededIds.has(u.id));

  const contests = Array.isArray(db.contests) ? db.contests : [];
  const nextContests = contests.map((c) => {
    if (c.id !== contestId) return c;
    const maxCap = Number(c.maxParticipants || maxContestParticipants);
    const prunedParticipants = (Array.isArray(c.participants) ? c.participants : [])
      .filter((p) => !seededIds.has(p.userId))
      .slice(0, Math.max(0, maxCap));
    return {
      ...c,
      participants: prunedParticipants,
      updatedAt: new Date().toISOString(),
    };
  });

  writeAllData({ users: keptUsers, contests: nextContests });
  const fresh = getAllContests().find((c) => c.id === contestId) || currentContestOrCreate();
  const removed = users.length - keptUsers.length;
  return res.json({ status: "ok", contest: augmentContestForApi(fresh), removed });
});

app.post("/admin/contest/config", authMiddleware, ensureAdmin, (req, res) => {
  const contest = currentContestOrCreate();
  const entryFeeInr = Number(req.body?.entryFeeInr ?? contest.entryFeeInr);
  const maxParticipants = Number(req.body?.maxParticipants ?? contest.maxParticipants);
  const minParticipants = Number(req.body?.minParticipants ?? contest.minParticipants);
  const first = Number(req.body?.firstPrizeInr ?? contest.prizePoolInr?.first ?? 10000);
  const second = Number(req.body?.secondPrizeInr ?? contest.prizePoolInr?.second ?? 5000);
  const third = Number(req.body?.thirdPrizeInr ?? contest.prizePoolInr?.third ?? 2000);
  const updated = upsertContest(contest.id, (prev) => ({
    ...prev,
    entryFeeInr: Number.isFinite(entryFeeInr) && entryFeeInr > 0 ? entryFeeInr : prev.entryFeeInr,
    maxParticipants: Number.isFinite(maxParticipants) && maxParticipants > 0 ? maxParticipants : prev.maxParticipants,
    minParticipants: Number.isFinite(minParticipants) && minParticipants > 0 ? minParticipants : prev.minParticipants,
    prizePoolInr: {
      first: Number.isFinite(first) ? first : prev.prizePoolInr?.first ?? 10000,
      second: Number.isFinite(second) ? second : prev.prizePoolInr?.second ?? 5000,
      third: Number.isFinite(third) ? third : prev.prizePoolInr?.third ?? 2000,
    },
    updatedAt: new Date().toISOString(),
  }));
  return res.json({ status: "ok", contest: updated });
});

app.post("/admin/contest/finalize", authMiddleware, ensureAdmin, async (req, res) => {
  const contest = currentContestOrCreate();
  if (contest.status === "FINALIZED") {
    return res.json({ status: "ok", contest });
  }
  const participants = contest.participants || [];
  if (participants.length < Number(contest.minParticipants || minContestParticipants)) {
    return res.status(400).json({
      status: "error",
      message: `Minimum ${Number(contest.minParticipants || minContestParticipants)} participants required`,
    });
  }

  const hiddenSet = hiddenLeaderboardUserSet();
  const users = getAllUsers().filter((u) => participants.some((p) => p.userId === u.id) && !hiddenSet.has(String(u.id)));
  const dayISO = String(contest?.contestDateISO || todayISOInIST());
  const quotes = await getQuotesForUsersDay(users, dayISO);
  const ranking = dailyContestLeaderboardForUsers(users, dayISO, quotes).map((r) => ({
    userId: r.userId,
    totalPnlInr: r.totalPnlInr,
  }));

  const winners = ranking.slice(0, 3);
  const payouts = winners.map((w, idx) => ({
    userId: w.userId,
    rank: idx + 1,
    amountInr: idx === 0 ? Number(contest.prizePoolInr?.first || 10000) : idx === 1 ? Number(contest.prizePoolInr?.second || 5000) : Number(contest.prizePoolInr?.third || 2000),
    status: "PENDING",
    createdAt: new Date().toISOString(),
  }));

  const updated = upsertContest(contest.id, (prev) => ({
    ...prev,
    status: "FINALIZED",
    finalizedAt: new Date().toISOString(),
    payouts,
    updatedAt: new Date().toISOString(),
  }));
  return res.json({ status: "ok", contest: updated });
});

app.post("/admin/contest/release", authMiddleware, ensureAdmin, (req, res) => {
  const contest = currentContestOrCreate();
  const userId = String(req.body?.userId || "");
  const updated = upsertContest(contest.id, (prev) => {
    const payouts = (prev.payouts || []).map((p) =>
      p.userId === userId && p.status === "PENDING"
        ? { ...p, status: "RELEASED", releasedAt: new Date().toISOString() }
        : p,
    );
    return { ...prev, payouts, updatedAt: new Date().toISOString() };
  });
  const payout = (updated.payouts || []).find((p) => p.userId === userId);
  if (!payout) return res.status(404).json({ status: "error", message: "Payout not found" });
  if (payout.status !== "RELEASED") {
    return res.status(400).json({ status: "error", message: "Payout not released" });
  }
  const u = getUserById(userId);
  if (!u) return res.status(404).json({ status: "error", message: "User not found" });
  const credited = updateUser(userId, (prev) => ({
    ...prev,
    realWalletInr: Number((Number(prev.realWalletInr || 0) + Number(payout.amountInr || 0)).toFixed(2)),
    updatedAt: new Date().toISOString(),
  }));
  return res.json({
    status: "ok",
    contest: updated,
    user: credited ? { id: credited.id, realWalletInr: Number(credited.realWalletInr || 0) } : null,
  });
});

app.get("/admin/users/:id/orders", authMiddleware, ensureAdmin, (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ status: "error", message: "User not found" });
  const orders = Array.isArray(user.orders) ? user.orders : [];
  orders.sort((a, b) => Date.parse(b.filledAt || "") - Date.parse(a.filledAt || ""));
  return res.json({
    status: "ok",
    orders,
  });
});

app.get("/admin/users/:id/positions", authMiddleware, ensureAdmin, (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ status: "error", message: "User not found" });
  const positions = Array.isArray(user.positions) ? user.positions : [];
  // Latest activity first: prefer lastTradedAt, else exitedAt, else openedAt.
  positions.sort((a, b) => {
    const ta = Date.parse(a.lastTradedAt || a.exitedAt || a.openedAt || "");
    const tb = Date.parse(b.lastTradedAt || b.exitedAt || b.openedAt || "");
    return tb - ta;
  });
  return res.json({
    status: "ok",
    positions,
  });
});

app.get("/admin/users/pnl", authMiddleware, ensureAdmin, async (req, res) => {
  const users = getAllUsers().filter((u) => !isSeededUser(u));
  const hiddenSet = hiddenLeaderboardUserSet();

  const realizedByUser = new Map();
  for (const u of users) {
    realizedByUser.set(u.id, Number(u.realizedPnlInr ?? 0));
  }

  // If Kite isn't authenticated, we can still return realized P&L.
  const canQuote = Boolean(auth.accessToken);
  let openPnlByUser = new Map();
  for (const u of users) openPnlByUser.set(u.id, 0);

  if (!canQuote) {
    return res.json({
      status: "ok",
      openPnlAvailable: false,
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
        walletInr: Number(u.walletInr ?? 0),
        realWalletInr: Number(u.realWalletInr ?? 0),
        realizedPnlInr: Number(u.realizedPnlInr ?? 0),
        openPnlInr: 0,
        totalPnlInr: Number(u.realizedPnlInr ?? 0),
        hiddenFromLeaderboard: hiddenSet.has(String(u.id)),
      })),
    });
  }

  try {
    kite.setAccessToken(auth.accessToken);

    const toQuote = [];
    const symbols = new Set();
    for (const u of users) {
      const positions = Array.isArray(u.positions) ? u.positions : [];
      for (const p of positions) {
        const qty = Number(p?.quantity ?? 0);
        const avg = Number(p?.avgPrice ?? 0);
        if (!(qty > 0 && avg > 0)) continue;
        const k = resolveKiteSymbolFromPosition(p);
        if (!k) continue;
        symbols.add(k);
        toQuote.push({ userId: u.id, kiteSymbol: k, avgPrice: avg, quantity: qty });
      }
    }

    const uniqueSymbols = [...symbols];
    if (uniqueSymbols.length === 0) {
      return res.json({
        status: "ok",
        openPnlAvailable: true,
        users: users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          createdAt: u.createdAt,
          walletInr: Number(u.walletInr ?? 0),
          realWalletInr: Number(u.realWalletInr ?? 0),
          realizedPnlInr: Number(u.realizedPnlInr ?? 0),
          openPnlInr: 0,
          totalPnlInr: Number(u.realizedPnlInr ?? 0),
          hiddenFromLeaderboard: hiddenSet.has(String(u.id)),
        })),
      });
    }

    const quotes = await kite.getQuote(uniqueSymbols);

    for (const u of users) openPnlByUser.set(u.id, 0);
    for (const leg of toQuote) {
      const q = quotes?.[leg.kiteSymbol];
      const lpRaw = q?.last_price ?? q?.lastPrice ?? q?.ltp ?? q?.last ?? null;
      const lp = Number(lpRaw);
      if (!Number.isFinite(lp)) continue;
      const open = Number(((lp - leg.avgPrice) * leg.quantity).toFixed(2));
      openPnlByUser.set(leg.userId, Number((openPnlByUser.get(leg.userId) + open).toFixed(2)));
    }

    return res.json({
      status: "ok",
      openPnlAvailable: true,
      users: users.map((u) => {
        const realized = realizedByUser.get(u.id) ?? 0;
        const open = openPnlByUser.get(u.id) ?? 0;
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          createdAt: u.createdAt,
          walletInr: Number(u.walletInr ?? 0),
          realWalletInr: Number(u.realWalletInr ?? 0),
          realizedPnlInr: realized,
          openPnlInr: open,
          totalPnlInr: Number((realized + open).toFixed(2)),
          hiddenFromLeaderboard: hiddenSet.has(String(u.id)),
        };
      }),
    });
  } catch (e) {
    return res.status(500).json({
      status: "error",
      message: "Failed to compute open P&L",
      error: e?.message || String(e),
    });
  }
});

/**
 * Paper exit: liquidate at exitPrice (LTP), credit wallet qty×exitPrice, add realized P&L to running total.
 * If exitPrice omitted, uses avg (zero realized on that line; legacy behaviour).
 */
app.post("/paper/position/close", authMiddleware, (req, res) => {
  try {
    const { instrumentKey, exitPrice: exitRaw } = req.body || {};
    if (!instrumentKey || typeof instrumentKey !== "string") {
      return res.status(400).json({ status: "error", message: "instrumentKey is required" });
    }
    let lineRealizedOut = 0;
    const nowISO = new Date().toISOString();
    const updated = updateUser(req.user.id, (prev) => {
      const positions = prev.positions || [];
      const idx = positions.findIndex((p) => p.instrumentKey === instrumentKey);
      if (idx === -1) throw new Error("Position not found");
      const pos = positions[idx];
      const qty = Number(pos.quantity);
      const avg = Number(pos.avgPrice);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(avg) || avg < 0) {
        throw new Error("Position already exited or invalid");
      }
      const parsedExit = exitRaw != null && exitRaw !== "" ? Number(exitRaw) : NaN;
      const exitPx =
        Number.isFinite(parsedExit) && parsedExit >= 0 ? parsedExit : avg;
      const credit = Number((qty * exitPx).toFixed(2));
      const lineRealized = Number(((exitPx - avg) * qty).toFixed(2));
      lineRealizedOut = lineRealized;
      const prevRealized = Number(prev.realizedPnlInr || 0);
      const next = [...positions];
      next[idx] = {
        ...pos,
        quantity: 0,
        avgPrice: 0,
        exited: true,
        exitedAt: new Date().toISOString(),
        lastTradedAt: nowISO,
        exitPrice: Number(exitPx.toFixed(2)),
        realizedPnlInr: lineRealized,
      };
      return {
        ...prev,
        positions: next,
        walletInr: Number((Number(prev.walletInr || 0) + credit).toFixed(2)),
        realizedPnlInr: Number((prevRealized + lineRealized).toFixed(2)),
        updatedAt: new Date().toISOString(),
      };
    });
    if (!updated) return res.status(404).json({ status: "error", message: "User not found" });
    return res.json({
      status: "ok",
      walletInr: updated.walletInr,
      realizedPnlInr: Number(updated.realizedPnlInr || 0),
      lineRealized: lineRealizedOut,
      positions: updated.positions,
    });
  } catch (error) {
    return res.status(400).json({ status: "error", message: error?.message || "Close failed" });
  }
});

app.post("/paper/order", authMiddleware, (req, res) => {
  try {
    if (!isWithinMarketHoursIST()) {
      return res.status(400).json({
        status: "error",
        message: "Order not allowed outside market hours (9:15 AM - 3:30 PM IST)",
      });
    }
    const {
      symbol,
      side,
      quantity,
      price,
      orderMode = "MARKET",
      instrumentType = "EQ",
      optionType = null,
      strike = null,
      expiry = null,
      product = "NRML",
      kiteSymbol: kiteSymbolBody = null,
    } = req.body || {};

    if (!symbol || !side || !quantity || !price) {
      return res.status(400).json({ status: "error", message: "symbol, side, quantity, price are required" });
    }
    const normalizedSide = String(side).toUpperCase();
    if (!["BUY", "SELL"].includes(normalizedSide)) {
      return res.status(400).json({ status: "error", message: "side must be BUY or SELL" });
    }

    const qty = Number(quantity);
    const px = Number(price);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(px) || px <= 0) {
      return res.status(400).json({ status: "error", message: "quantity and price must be positive numbers" });
    }

    const notional = Number((qty * px).toFixed(2));
    const orderPayload = {
      symbol: String(symbol).toUpperCase(),
      side: normalizedSide,
      quantity: qty,
      price: px,
      orderMode: ["MARKET", "LIMIT"].includes(String(orderMode).toUpperCase())
        ? String(orderMode).toUpperCase()
        : "MARKET",
      instrumentType: String(instrumentType).toUpperCase(),
      optionType: optionType ? String(optionType).toUpperCase() : null,
      strike: strike ? Number(strike) : null,
      expiry: expiry || null,
      product: String(product).toUpperCase(),
    };
    const instrumentKey = buildInstrumentKey(orderPayload);

    const updated = updateUser(req.user.id, (prev) => {
      const orders = prev.orders || [];
      const positions = prev.positions || [];
      let walletInr = Number(prev.walletInr || 0);
      const nowISO = new Date().toISOString();

      const posIdx = positions.findIndex(
        (p) =>
          !p.exited &&
          Number(p.quantity || 0) > 0 &&
          String(p.baseInstrumentKey || p.instrumentKey) === instrumentKey,
      );
      const kiteSymNorm = kiteSymbolBody ? String(kiteSymbolBody).trim() : "";
      const hasAnyHistoryForContract = positions.some(
        (p) => String(p.baseInstrumentKey || p.instrumentKey) === instrumentKey,
      );
      const rowInstrumentKey = hasAnyHistoryForContract
        ? `${instrumentKey}#${randomUUID().slice(0, 8)}`
        : instrumentKey;
      const existingPos =
        posIdx >= 0
          ? { ...positions[posIdx] }
          : {
              instrumentKey: rowInstrumentKey,
              baseInstrumentKey: instrumentKey,
              symbol: orderPayload.symbol,
              instrumentType: orderPayload.instrumentType,
              optionType: orderPayload.optionType,
              strike: orderPayload.strike,
              expiry: orderPayload.expiry,
              quantity: 0,
              avgPrice: 0,
              kiteSymbol: kiteSymNorm || undefined,
              openedAt: nowISO,
              lastTradedAt: nowISO,
            };
      // If this position predates our timestamp fields, initialize them once.
      if (!existingPos.openedAt) existingPos.openedAt = nowISO;
      existingPos.lastTradedAt = nowISO;
      if (kiteSymNorm) existingPos.kiteSymbol = kiteSymNorm;

      if (orderPayload.side === "BUY") {
        if (walletInr < notional) {
          throw new Error("Insufficient virtual balance");
        }
        const newQty = existingPos.quantity + qty;
        const newAvg =
          newQty > 0
            ? Number(((existingPos.avgPrice * existingPos.quantity + notional) / newQty).toFixed(2))
            : 0;
        existingPos.quantity = newQty;
        existingPos.avgPrice = newAvg;
        walletInr = Number((walletInr - notional).toFixed(2));
      } else {
        if (existingPos.quantity < qty) {
          throw new Error("Insufficient quantity to sell");
        }
        existingPos.quantity = Number((existingPos.quantity - qty).toFixed(6));
        walletInr = Number((walletInr + notional).toFixed(2));
      }

      if (posIdx >= 0) positions[posIdx] = existingPos;
      else positions.push(existingPos);

      const filteredPositions = positions.filter((p) => p.quantity > 0 || p.exited);
      const newOrder = {
        id: randomUUID(),
        ...orderPayload,
        notional,
        status: "FILLED",
        filledAt: new Date().toISOString(),
      };
      orders.push(newOrder);

      return {
        ...prev,
        walletInr,
        positions: filteredPositions,
        orders,
        updatedAt: new Date().toISOString(),
      };
    });

    return res.json({
      status: "ok",
      order: updated.orders[updated.orders.length - 1],
      walletInr: updated.walletInr,
      positions: updated.positions,
    });
  } catch (error) {
    return res.status(400).json({ status: "error", message: error?.message || "Order placement failed" });
  }
});

app.get("/kite/login", (_req, res) => {
  if (!apiKey) return res.status(500).send("Missing KITE_API_KEY");
  const loginUrl = kite.getLoginURL();
  return res.redirect(loginUrl);
});

app.get("/kite/callback", async (req, res) => {
  try {
    const requestToken = req.query.request_token;
    if (!requestToken || typeof requestToken !== "string") {
      return res.status(400).send("Missing request_token");
    }
    if (!apiSecret) return res.status(500).send("Missing KITE_API_SECRET");

    const session = await kite.generateSession(requestToken, apiSecret);
    auth = {
      accessToken: session.access_token,
      publicToken: session.public_token || null,
      userId: session.user_id || null,
      updatedAt: new Date().toISOString(),
    };
    kite.setAccessToken(session.access_token);
    bumpMarketStreamResync();

    // Persist for next server restart.
    try {
      writeFileSync(KITE_AUTH_FILE, JSON.stringify(auth, null, 2), "utf-8");
    } catch {
      // ignore
    }

    return res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <h2>Kite login successful</h2>
          <p>User: ${auth.userId || "unknown"}</p>
          <p>You can close this tab and return to app.</p>
          <a href="${frontendOrigin}/stocks">Go to Stocks page</a>
        </body>
      </html>
    `);
  } catch (error) {
    return res.status(500).send(`Login failed: ${error?.message || "Unknown error"}`);
  }
});

app.get("/api/quotes", ensureAuth, async (req, res) => {
  try {
    const raw = req.query.symbols;
    if (!raw || typeof raw !== "string") {
      return res.status(400).json({ status: "error", message: "symbols query is required" });
    }

    const instruments = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (instruments.length === 0) {
      return res.status(400).json({ status: "error", message: "No instruments provided" });
    }

    const quotes = await kite.getQuote(instruments);
    return res.json({ status: "ok", quotes });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error?.message || "Quote fetch failed" });
  }
});

app.get("/api/options-chain", ensureAuth, async (req, res) => {
  try {
    const underlyingRaw = req.query.underlying;
    if (!underlyingRaw || typeof underlyingRaw !== "string") {
      return res.status(400).json({ status: "error", message: "underlying query is required" });
    }

    const underlyingNormalized = normalizeUnderlyingInput(underlyingRaw);
    const strikeCount = Number(req.query.strikeCount || 7); // rows = 2*count+1
    const chosenTotalStrikes = 2 * strikeCount + 1;

    const expiryISO = req.query.expiryISO ? String(req.query.expiryISO) : null;

    const instruments = await loadKiteInstruments();

    const underlyingQuoteSymbols = (() => {
      // Try both NSE and BSE for stocks, but only the expected exchange for indices.
      const isIndex =
        underlyingNormalized === "SENSEX" ||
        underlyingNormalized === "BANK NIFTY" ||
        underlyingNormalized === "BANKNIFTY" ||
        underlyingNormalized === "NIFTY 50" ||
        underlyingNormalized === "NIFTY50" ||
        underlyingNormalized === "NIFTY";
      if (isIndex) return [getUnderlyingQuoteSymbol(underlyingNormalized)];
      const sym = underlyingNormalized.replace(/\s/g, "");
      return [`NSE:${sym}`, `BSE:${sym}`];
    })();

    const underlyingQuotes = await kite.getQuote(underlyingQuoteSymbols);
    const underlyingQuote =
      underlyingQuotes?.[underlyingQuoteSymbols[0]] ||
      underlyingQuotes?.[underlyingQuoteSymbols[1]] ||
      underlyingQuotes?.[Object.keys(underlyingQuotes || {})[0]];

    const underlyingLtpRaw =
      underlyingQuote?.last_price ??
      underlyingQuote?.lastPrice ??
      underlyingQuote?.ltp ??
      underlyingQuote?.last ??
      null;
    const underlyingLtp = Number(underlyingLtpRaw);
    if (!Number.isFinite(underlyingLtp) || underlyingLtp <= 0) {
      return res.status(404).json({ status: "error", message: "Underlying quote not found" });
    }

    const isIndex =
      underlyingNormalized === "SENSEX" ||
      underlyingNormalized === "BANK NIFTY" ||
      underlyingNormalized === "BANKNIFTY" ||
      underlyingNormalized === "NIFTY 50" ||
      underlyingNormalized === "NIFTY50" ||
      underlyingNormalized === "NIFTY";

    const nameCandidates = isIndex ? getIndexNameCandidates(underlyingNormalized) : getStockNameCandidates(instruments, underlyingNormalized);

    const nameCandidatesUpper = new Set(
      nameCandidates.map((x) => String(x).toUpperCase()),
    );

    // Filter option instruments for CE/PE
    const optionRows = instruments.filter((r) => {
      const seg = String(r.segment || "").toUpperCase();
      // Kite uses different segments for options like NFO-OPT, BFO-OPT, etc.
      if (!seg.includes("OPT")) return false;
      if (!r.tradingsymbol) return false;
      if (!r.expiry) return false;
      if (!r.name) return false;
      // Kite `name` sometimes includes extra words (e.g. "RELIANCE INDUSTRIES").
      if (!nameCandidatesUpper.has(String(r.name).toUpperCase())) return false;
      if (r.instrument_type !== "CE" && r.instrument_type !== "PE") return false;
      if (!r.strike || !Number.isFinite(r.strike)) return false;
      return true;
    });

    if (optionRows.length === 0) {
      return res.status(404).json({ status: "error", message: "No option instruments found for underlying" });
    }

    const formatExpiryForDropdown = (isoLike) => {
      const iso = parseExpiryToISO(String(isoLike).trim()).slice(0, 10);
      return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    };

    const uniqueExpiryRaw = Array.from(new Set(optionRows.map((r) => r.expiry)));
    const expiriesAll = uniqueExpiryRaw
      .map((lbl) => {
        const iso = parseExpiryToISO(String(lbl).trim()).slice(0, 10);
        const t = new Date(`${iso}T00:00:00Z`).getTime();
        return { iso, t };
      })
      .filter((x) => Number.isFinite(x.t))
      .sort((a, b) => a.t - b.t)
      .map(({ iso }) => ({
        iso,
        label: formatExpiryForDropdown(iso),
      }));

    // Bank Nifty monthly-only: show only 1 expiry per month (the last expiry date in that month).
    const bankNiftyMonthlyOnly = underlyingNormalized === "BANK NIFTY" || underlyingNormalized === "BANKNIFTY";
    const uniqueExpiryLabels = Array.from(new Set(optionRows.map((r) => r.expiry)));
    const expiryLabelToIso = uniqueExpiryLabels
      .map((lbl) => {
        const iso = parseExpiryToISO(String(lbl).trim()).slice(0, 10);
        const t = new Date(`${iso}T00:00:00Z`).getTime();
        return { lbl, iso, t };
      })
      .filter((x) => x.iso && Number.isFinite(x.t))
      .sort((a, b) => a.t - b.t);

    const monthlyIsoSet = new Set();
    const monthlyLabelSet = new Set();
    if (bankNiftyMonthlyOnly) {
      const byMonth = new Map(); // yyyy-mm -> { lbl, iso, t }
      for (const it of expiryLabelToIso) {
        const key = it.iso.slice(0, 7); // yyyy-mm
        const prev = byMonth.get(key);
        if (!prev || it.iso > prev.iso) byMonth.set(key, it);
      }
      for (const it of byMonth.values()) {
        monthlyIsoSet.add(it.iso);
        monthlyLabelSet.add(it.lbl);
      }
    }

    // Choose expiry (next expiry first; not the earliest even if expired)
    let chosenExpiryLabel = null;
    if (expiryISO) {
      // Kite instrument master expiry is already "YYYY-MM-DD".
      // If caller passes "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss", normalize to "YYYY-MM-DD".
      const targetIso = String(expiryISO).slice(0, 10);
      if (bankNiftyMonthlyOnly) {
        // Find the original `optionRows[].expiry` label that matches this ISO date
        // (so we can safely use it in `r.expiry === chosenExpiryLabel`).
        chosenExpiryLabel =
          expiryLabelToIso.find((x) => x.iso === targetIso)?.lbl ||
          expiryLabelToIso
            .filter((x) => monthlyLabelSet.has(x.lbl))
            .find((x) => x.t >= Date.now())?.lbl ||
          expiryLabelToIso.find((x) => monthlyLabelSet.has(x.lbl))?.lbl ||
          targetIso;
      } else {
        chosenExpiryLabel = targetIso;
      }
    } else {
      // nearest future expiry
      const now = new Date();
      const nowTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const candidates = bankNiftyMonthlyOnly
        ? expiryLabelToIso.filter((x) => monthlyLabelSet.has(x.lbl))
        : expiryLabelToIso;
      chosenExpiryLabel = candidates.find((x) => x.t >= nowTime)?.lbl || candidates[0]?.lbl || uniqueExpiryLabels[0];
    }

    const filtered = optionRows.filter((r) => r.expiry === chosenExpiryLabel);
    const strikes = Array.from(new Set(filtered.map((r) => r.strike))).sort((a, b) => a - b);
    if (strikes.length === 0) {
      return res.status(404).json({ status: "error", message: "No strikes for chosen expiry" });
    }

    const step = getIndexStrikeStep(underlyingNormalized);
    const atmStrike = step > 1 ? Math.round(underlyingLtp / step) * step : strikes.reduce((best, s) => (Math.abs(s - underlyingLtp) < Math.abs(best - underlyingLtp) ? s : best), strikes[0]);

    const strikeSelection = strikes
      .slice()
      .sort((a, b) => Math.abs(a - atmStrike) - Math.abs(b - atmStrike))
      .slice(0, chosenTotalStrikes)
      .sort((a, b) => a - b);

    const contracts = [];
    for (const strike of strikeSelection) {
      const ce = filtered.find((r) => r.strike === strike && r.instrument_type === "CE");
      const pe = filtered.find((r) => r.strike === strike && r.instrument_type === "PE");

      if (pe) {
        const kiteSymbol = `${pe.exchange}:${pe.tradingsymbol}`;
        contracts.push({ type: "PE", strike, tradingSymbol: pe.tradingsymbol, kiteSymbol });
      }
      if (ce) {
        const kiteSymbol = `${ce.exchange}:${ce.tradingsymbol}`;
        contracts.push({ type: "CE", strike, tradingSymbol: ce.tradingsymbol, kiteSymbol });
      }
    }

    const symbols = contracts.map((c) => c.kiteSymbol);
    const optionQuotes = await kite.getQuote(symbols);

    const expiryISOResolved = String(parseExpiryToISO(chosenExpiryLabel)).slice(0, 10);
    const expiryLabelPretty = new Date(`${expiryISOResolved}T00:00:00Z`).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const cleanExpiryLabel = expiryLabelPretty.replace(/, \d{4}$/, "");

    // Dropdown: upcoming expiries (today IST onward) + always include active expiry
    const todayIst = todayISOInIST();
    let expiries = expiriesAll.filter((e) => e.iso >= todayIst);
    if (bankNiftyMonthlyOnly) expiries = expiries.filter((e) => monthlyIsoSet.has(e.iso));
    if (expiries.length === 0) expiries = [...expiriesAll];
    if (!expiries.some((e) => e.iso === expiryISOResolved)) {
      expiries.push({
        iso: expiryISOResolved,
        label: formatExpiryForDropdown(expiryISOResolved),
      });
      expiries.sort((a, b) => a.iso.localeCompare(b.iso));
    }

    // Build rows
    const byStrike = {};
    for (const c of contracts) {
      const q =
        optionQuotes?.[c.kiteSymbol] ||
        optionQuotes?.[c.tradingSymbol] ||
        optionQuotes?.[symbols.find((s) => s.endsWith(`:${c.tradingSymbol}`))];
      const lastRaw = q?.last_price ?? q?.lastPrice ?? q?.ltp ?? null;
      const changeRaw = q?.net_change ?? q?.netChange ?? q?.change ?? null;
      const last = Number(lastRaw);
      const change = Number(changeRaw);
      const o = {
        kiteSymbol: c.kiteSymbol,
        tradingSymbol: c.tradingSymbol,
        optionType: c.type,
        strike: c.strike,
        expiryISO: expiryISOResolved,
        lastPrice: Number.isFinite(last) ? last : null,
        netChange: Number.isFinite(change) ? change : null,
      };
      byStrike[c.strike] = byStrike[c.strike] || { strike: c.strike, CE: null, PE: null };
      if (c.type === "CE") byStrike[c.strike].CE = o;
      if (c.type === "PE") byStrike[c.strike].PE = o;
    }

    const rows = strikeSelection.map((s) => ({
      strike: s,
      CE: byStrike[s]?.CE || null,
      PE: byStrike[s]?.PE || null,
    }));

    return res.json({
      status: "ok",
      underlying: underlyingNormalized,
      underlyingLtp,
      expiryISO: expiryISOResolved,
      expiryLabel: cleanExpiryLabel,
      expiries,
      rows,
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error?.message || "Options chain failed" });
  }
});

app.post("/kite/logout", (_req, res) => {
  auth = { accessToken: null, publicToken: null, userId: null, updatedAt: null };
  try {
    if (existsSync(KITE_AUTH_FILE)) unlinkSync(KITE_AUTH_FILE);
  } catch {
    // ignore
  }
  res.json({ status: "ok" });
});

// In production deployments we can serve the built frontend from this server.
// This lets you run only one public service and keeps URLs under the same domain.
const distDir = process.env.FRONTEND_DIST_DIR
  ? String(process.env.FRONTEND_DIST_DIR)
  : path.join(repoRoot, "dist");
if (existsSync(path.join(distDir, "index.html"))) {
  app.use(express.static(distDir));
  // Express 5 / path-to-regexp: app.get("*") throws; use a no-path middleware instead.
  app.use((req, res, next) => {
    // Don't interfere with backend API routes.
    // Note: do NOT skip "/admin" — the React admin page is at /admin.
    // Admin *API* routes (/admin/users, etc.) are registered above and match first.
    if (
      req.path.startsWith("/paper") ||
      req.path.startsWith("/auth") ||
      req.path.startsWith("/wallet") ||
      req.path.startsWith("/kite") ||
      req.path.startsWith("/api") ||
      req.path.startsWith("/ws")
    ) {
      return next();
    }
    return res.sendFile(path.join(distDir, "index.html"));
  });
}

const httpServer = createServer(app);

attachMarketStream(httpServer, {
  jwtSecret,
  getUserById,
  getKiteAuth: () => ({ apiKey, accessToken: auth.accessToken }),
  loadKiteInstruments,
});

httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Kite backend listening on http://localhost:${port} (HTTP + /ws/market)`);
});
