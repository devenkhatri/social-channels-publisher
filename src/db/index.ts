import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";
import { config } from "@/lib/config";

const dbDir = path.join(process.cwd(), "data");
const dbPath = path.join(dbDir, "social-publisher.db");

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Initialize tables if they don't already exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS zernio_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_key TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS zernio_profiles (
    id TEXT PRIMARY KEY,
    zernio_account_id TEXT NOT NULL REFERENCES zernio_accounts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    profile_name TEXT,
    profile_avatar TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS content_items (
    id TEXT PRIMARY KEY,
    folder_name TEXT NOT NULL,
    original_folder_name TEXT NOT NULL,
    folder_path TEXT NOT NULL,
    drive_item_id TEXT NOT NULL UNIQUE,
    is_done INTEGER NOT NULL DEFAULT 0,
    title TEXT,
    cover_image TEXT,
    slide_count INTEGER DEFAULT 0,
    synced_at TEXT,
    renamed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS channel_posts (
    id TEXT PRIMARY KEY,
    content_item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    title TEXT,
    body TEXT,
    media_type TEXT,
    post_type TEXT,
    zernio_account_id TEXT REFERENCES zernio_accounts(id),
    zernio_profile_id TEXT REFERENCES zernio_profiles(id),
    status TEXT NOT NULL DEFAULT 'draft',
    scheduled_for TEXT,
    published_at TEXT,
    zernio_post_id TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS oauth_tokens (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

export const db = drizzle(sqlite, { schema });
export { schema };
