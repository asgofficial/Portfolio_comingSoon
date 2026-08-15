import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The DB file lives next to this module by default. On most hosts (Render,
// Railway, Fly.io) attach a persistent disk/volume and point DB_PATH at a
// file inside it, otherwise the data is lost on every redeploy.
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'subscribers.db')

// Ensure the containing folder exists.
import { mkdirSync } from 'node:fs'
mkdirSync(path.dirname(dbPath), { recursive: true })

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS subscribers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    source        TEXT,
    ip_hash       TEXT,
    confirmed     INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS idx_subscribers_created_at ON subscribers(created_at);
`)

export const insertSubscriber = db.prepare(`
  INSERT INTO subscribers (email, source, ip_hash)
  VALUES (@email, @source, @ipHash)
`)

export const findSubscriberByEmail = db.prepare(`
  SELECT id, email, created_at, source, confirmed FROM subscribers WHERE email = ?
`)

export const listSubscribers = db.prepare(`
  SELECT id, email, created_at, source, confirmed FROM subscribers ORDER BY created_at DESC
`)

export const deleteSubscriberById = db.prepare(`
  DELETE FROM subscribers WHERE id = ?
`)

export const countSubscribers = db.prepare(`
  SELECT COUNT(*) AS count FROM subscribers
`)
