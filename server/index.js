import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { KiteConnect } from "kiteconnect";
import { createUser, getUserByEmail, getUserById, updateUser, getAllUsers } from "./store.js";
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

dotenv.config({ path: ".env.server" });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:8080";
const jwtSecret = process.env.JWT_SECRET || "dev-insecure-secret-change-this";
const defaultWalletBalance = Number(process.env.DEFAULT_VIRTUAL_BALANCE_INR || 10_000_000);
const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();

const apiKey = process.env.KITE_API_KEY;
const apiSecret = process.env.KITE_API_SECRET;
const redirectUrl = process.env.KITE_REDIRECT_URL || "http://127.0.0.1:3001/kite/callback";

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
app.use(express.json());

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
      realizedPnlInr: 0,
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
        realizedPnlInr: Number(user.realizedPnlInr || 0),
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

    const token = createToken(user);
    return res.json({
      status: "ok",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        walletInr: user.walletInr,
        realizedPnlInr: Number(user.realizedPnlInr || 0),
      },
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error?.message || "Login failed" });
  }
});

app.get("/auth/me", authMiddleware, (req, res) => {
  const user = req.user;
  res.json({
    status: "ok",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      walletInr: user.walletInr,
      realizedPnlInr: Number(user.realizedPnlInr || 0),
    },
  });
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

app.get("/paper/orders", authMiddleware, (req, res) => {
  const orders = req.user.orders || [];
  res.json({ status: "ok", orders: [...orders].reverse() });
});

app.get("/paper/positions", authMiddleware, (req, res) => {
  const positions = req.user.positions || [];
  res.json({ status: "ok", positions });
});

// -------------------------
// Admin (paper data only)
// -------------------------
app.get("/admin/summary/today", authMiddleware, ensureAdmin, (req, res) => {
  const users = getAllUsers();
  const today = isoDateInIST(new Date());
  const signupsToday = users.filter((u) => isoDateInIST(u.createdAt) === today);
  return res.json({
    status: "ok",
    today,
    signupsTodayCount: signupsToday.length,
    signupsToday: signupsToday.map((u) => ({ id: u.id, email: u.email })),
  });
});

app.get("/admin/users", authMiddleware, ensureAdmin, (req, res) => {
  const users = getAllUsers();
  return res.json({
    status: "ok",
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      walletInr: Number(u.walletInr ?? 0),
      realizedPnlInr: Number(u.realizedPnlInr ?? 0),
      createdAt: u.createdAt,
      ordersCount: Array.isArray(u.orders) ? u.orders.length : 0,
      positionsCount: Array.isArray(u.positions) ? u.positions.length : 0,
    })),
  });
});

app.get("/admin/users/:id/orders", authMiddleware, ensureAdmin, (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ status: "error", message: "User not found" });
  return res.json({
    status: "ok",
    orders: Array.isArray(user.orders) ? user.orders : [],
  });
});

app.get("/admin/users/:id/positions", authMiddleware, ensureAdmin, (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ status: "error", message: "User not found" });
  return res.json({
    status: "ok",
    positions: Array.isArray(user.positions) ? user.positions : [],
  });
});

app.get("/admin/users/pnl", authMiddleware, ensureAdmin, async (req, res) => {
  const users = getAllUsers();

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
        walletInr: Number(u.walletInr ?? 0),
        realizedPnlInr: Number(u.realizedPnlInr ?? 0),
        openPnlInr: 0,
        totalPnlInr: Number(u.realizedPnlInr ?? 0),
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
          walletInr: Number(u.walletInr ?? 0),
          realizedPnlInr: Number(u.realizedPnlInr ?? 0),
          openPnlInr: 0,
          totalPnlInr: Number(u.realizedPnlInr ?? 0),
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
          walletInr: Number(u.walletInr ?? 0),
          realizedPnlInr: realized,
          openPnlInr: open,
          totalPnlInr: Number((realized + open).toFixed(2)),
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
            };
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
  res.json({ status: "ok" });
});

// In production deployments we can serve the built frontend from this server.
// This lets you run only one public service and keeps URLs under the same domain.
const distDir = process.env.FRONTEND_DIST_DIR
  ? String(process.env.FRONTEND_DIST_DIR)
  : path.resolve(process.cwd(), "dist");
if (existsSync(path.join(distDir, "index.html"))) {
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
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
