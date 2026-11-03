import { defineConfig } from "drizzle-kit";
import fs from "fs";
import path from "path";

// Auto-load .env.local if not already in environment
if (!process.env.TURSO_DATABASE_URL && (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith("./") || process.env.DATABASE_URL.startsWith("file:"))) {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const idx = trimmed.indexOf("=");
          if (idx !== -1) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim();
            if (!process.env[key] || (key === "DATABASE_URL" && !process.env[key]?.startsWith("libsql:"))) {
              process.env[key] = val;
            }
          }
        }
      }
    }
  } catch {
    // Non-fatal
  }
}

const databaseUrl =
  process.env.TURSO_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "./data/social-publisher.db";

const isTurso =
  databaseUrl.startsWith("libsql://") ||
  databaseUrl.startsWith("https://") ||
  Boolean(process.env.TURSO_AUTH_TOKEN);

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: isTurso ? "turso" : "sqlite",
  dbCredentials: {
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
