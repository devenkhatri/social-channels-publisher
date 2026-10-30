import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// Determine database URL and auth token
const databaseUrl =
  process.env.TURSO_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "file:./data/social-publisher.db";

const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const isRemote =
  databaseUrl.startsWith("libsql://") ||
  databaseUrl.startsWith("https://") ||
  databaseUrl.startsWith("http://");

let formattedUrl = databaseUrl;

// If local file, ensure data directory exists and normalize file URI
if (!isRemote) {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const cleanPath = databaseUrl.replace(/^file:/, "");
  const resolvedPath = path.isAbsolute(cleanPath)
    ? cleanPath
    : path.join(dataDir, path.basename(cleanPath) || "social-publisher.db");
  formattedUrl = `file:${resolvedPath}`;
}

export const client = createClient({
  url: formattedUrl,
  authToken: isRemote ? authToken : undefined,
});

export const db = drizzle(client, { schema });
export { schema };

// DDL for automatic bootstrap / fallback
const initSql = `
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
    platform TEXT DEFAULT 'profile',
    profile_id TEXT NOT NULL,
    profile_name TEXT,
    profile_avatar TEXT,
    is_default INTEGER DEFAULT 0,
    color TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS zernio_connections (
    id TEXT PRIMARY KEY,
    zernio_account_id TEXT NOT NULL REFERENCES zernio_accounts(id) ON DELETE CASCADE,
    zernio_profile_id TEXT NOT NULL REFERENCES zernio_profiles(id) ON DELETE CASCADE,
    connection_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    username TEXT,
    display_name TEXT,
    profile_picture TEXT,
    profile_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    platform_status TEXT,
    followers_count INTEGER,
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
    zernio_connection_id TEXT REFERENCES zernio_connections(id),
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

  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content_item_id TEXT,
    channel TEXT,
    status TEXT NOT NULL DEFAULT 'info',
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`;

let isInitialized = false;
export async function ensureDbInitialized() {
  if (isInitialized) return;
  try {
    await client.executeMultiple(initSql);
    // Backward-compatible column additions
    try { await client.execute("ALTER TABLE zernio_profiles ADD COLUMN is_default INTEGER DEFAULT 0;"); } catch {}
    try { await client.execute("ALTER TABLE zernio_profiles ADD COLUMN color TEXT;"); } catch {}
    try { await client.execute("ALTER TABLE channel_posts ADD COLUMN zernio_connection_id TEXT;"); } catch {}
    try { await client.execute("ALTER TABLE channel_posts ADD COLUMN platform_post_url TEXT;"); } catch {}
    try { await client.execute("ALTER TABLE channel_posts ADD COLUMN platform_post_id TEXT;"); } catch {}
    isInitialized = true;
  } catch (e) {
    console.warn("DB bootstrap warning:", e);
  }
}

// Automatically trigger initialization asynchronously
ensureDbInitialized().catch(() => {});

export function checkpointDb() {
  if (isRemote) {
    // Turso handles WAL checkpointing automatically in cloud
    return;
  }
  try {
    client.execute("PRAGMA wal_checkpoint(PASSIVE)").catch(() => {});
  } catch (e) {
    console.warn("WAL checkpoint error:", e);
  }
}
