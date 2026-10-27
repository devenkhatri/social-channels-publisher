import { defineConfig } from "drizzle-kit";

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
