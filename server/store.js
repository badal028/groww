import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DB_FILE = resolve("server", "data", "users.json");

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
    if (!Array.isArray(parsed?.users)) return { users: [] };
    return parsed;
  } catch {
    return { users: [] };
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
