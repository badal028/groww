import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DB_FILE = resolve("server", "data", "users.json");

const defaultSiteSettings = () => ({
  marketBanner: {
    enabled: false,
    closedOn: "",
    opensAt: "",
  },
  leaderboardHiddenUserIds: [],
});

const ensureDb = () => {
  const dir = dirname(DB_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(DB_FILE)) {
    writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2), "utf-8");
  }
};

const readDb = () => {
  ensureDb();
  try {
    const raw = readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    const users = Array.isArray(parsed?.users) ? parsed.users : [];
    const contests = Array.isArray(parsed?.contests) ? parsed.contests : [];
    const siteSettings = {
      ...defaultSiteSettings(),
      ...(typeof parsed?.siteSettings === "object" && parsed.siteSettings ? parsed.siteSettings : {}),
      marketBanner: {
        ...defaultSiteSettings().marketBanner,
        ...(typeof parsed?.siteSettings?.marketBanner === "object" ? parsed.siteSettings.marketBanner : {}),
      },
      leaderboardHiddenUserIds: Array.isArray(parsed?.siteSettings?.leaderboardHiddenUserIds)
        ? parsed.siteSettings.leaderboardHiddenUserIds.map((x) => String(x))
        : [],
    };
    return { users, contests, siteSettings };
  } catch {
    return { users: [], contests: [], siteSettings: defaultSiteSettings() };
  }
};

const writeDb = (db) => {
  ensureDb();
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
};

export const getUserByEmail = (email) => {
  const db = readDb();
  return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
};

export const getUserById = (id) => {
  const db = readDb();
  return db.users.find((u) => u.id === id) || null;
};

export const createUser = (user) => {
  const db = readDb();
  db.users.push(user);
  writeDb(db);
  return user;
};

export const updateUser = (id, updater) => {
  const db = readDb();
  const idx = db.users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  db.users[idx] = updater(db.users[idx]);
  writeDb(db);
  return db.users[idx];
};

export const getAllUsers = () => {
  const db = readDb();
  return Array.isArray(db?.users) ? db.users : [];
};

export const getAllContests = () => {
  const db = readDb();
  return Array.isArray(db?.contests) ? db.contests : [];
};

export const upsertContest = (contestId, updater) => {
  const db = readDb();
  const contests = Array.isArray(db.contests) ? [...db.contests] : [];
  const idx = contests.findIndex((c) => c.id === contestId);
  if (idx === -1) {
    contests.push(updater(null));
  } else {
    contests[idx] = updater(contests[idx]);
  }
  db.contests = contests;
  writeDb(db);
  return db.contests.find((c) => c.id === contestId) || null;
};

export const getSiteSettings = () => readDb().siteSettings || defaultSiteSettings();

export const updateSiteSettings = (updater) => {
  const db = readDb();
  const prev = db.siteSettings || defaultSiteSettings();
  const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
  db.siteSettings = {
    ...defaultSiteSettings(),
    ...next,
    marketBanner: {
      ...defaultSiteSettings().marketBanner,
      ...(next.marketBanner || {}),
    },
    leaderboardHiddenUserIds: Array.isArray(next.leaderboardHiddenUserIds)
      ? next.leaderboardHiddenUserIds.map((x) => String(x))
      : [],
  };
  writeDb(db);
  return db.siteSettings;
};

export const readAllData = () => {
  return readDb();
};

export const writeAllData = (nextDb) => {
  const prev = readDb();
  const users = Array.isArray(nextDb?.users) ? nextDb.users : prev.users;
  const contests = Array.isArray(nextDb?.contests) ? nextDb.contests : prev.contests;
  const siteSettings =
    nextDb?.siteSettings !== undefined
      ? {
          ...defaultSiteSettings(),
          ...nextDb.siteSettings,
          marketBanner: {
            ...defaultSiteSettings().marketBanner,
            ...(nextDb.siteSettings?.marketBanner || {}),
          },
          leaderboardHiddenUserIds: Array.isArray(nextDb.siteSettings?.leaderboardHiddenUserIds)
            ? nextDb.siteSettings.leaderboardHiddenUserIds.map((x) => String(x))
            : [],
        }
      : prev.siteSettings || defaultSiteSettings();
  writeDb({ users, contests, siteSettings });
};
