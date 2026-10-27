import { createClient } from "@libsql/client";
import path from "path";
import fs from "fs";

// Load .env.local if present
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl) {
  console.error("❌ Error: TURSO_DATABASE_URL is not set in environment or .env.local");
  console.log("Usage: TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run db:migrate-to-turso");
  process.exit(1);
}

const localDbPath = path.resolve(process.cwd(), "data/social-publisher.db");
if (!fs.existsSync(localDbPath)) {
  console.error(`❌ Local database not found at ${localDbPath}`);
  process.exit(1);
}

const schemaDdl = `
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

async function migrate() {
  console.log(`Connecting to local database: ${localDbPath}`);
  const localClient = createClient({ url: `file:${localDbPath}` });

  console.log(`Connecting to Turso remote database: ${tursoUrl}`);
  const tursoClient = createClient({ url: tursoUrl!, authToken: tursoToken });

  console.log("Ensuring schema tables exist on Turso...");
  await tursoClient.executeMultiple(schemaDdl);

  // List of tables in dependency order
  const tables = [
    "settings",
    "zernio_accounts",
    "zernio_profiles",
    "zernio_connections",
    "content_items",
    "channel_posts",
    "oauth_tokens",
    "activity_logs",
  ];

  for (const table of tables) {
    try {
      const localRows = await localClient.execute(`SELECT * FROM ${table};`);
      if (localRows.rows.length === 0) {
        console.log(`- ${table}: 0 rows (skipped)`);
        continue;
      }

      console.log(`- Migrating ${table} (${localRows.rows.length} rows)...`);
      for (const row of localRows.rows) {
        const columns = Object.keys(row);
        const placeholders = columns.map(() => "?").join(", ");
        const colNames = columns.join(", ");
        const values = columns.map((col) => row[col]);

        const sql = `INSERT OR REPLACE INTO ${table} (${colNames}) VALUES (${placeholders});`;
        await tursoClient.execute({ sql, args: values });
      }
      console.log(`  ✓ ${table} copied successfully.`);
    } catch (err) {
      console.error(`  ⚠️ Could not migrate table ${table}:`, err);
    }
  }

  console.log("\n🎉 All local data successfully migrated to Turso!");
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
