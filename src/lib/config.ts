import { z } from "zod";

const envSchema = z.object({
  ADMIN_PASSWORD: z.string().default("admin123"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters long").default("ecf3f28535c2993d8cb3053901e9c2c884450090a2011de87d17d289bd30f048"),
  DATABASE_URL: z.string().default("./data/social-publisher.db"),
  TURSO_DATABASE_URL: z.string().optional().default(""),
  TURSO_AUTH_TOKEN: z.string().optional().default(""),
  ENCRYPTION_KEY: z.string().length(64, "ENCRYPTION_KEY must be a 64-character hex string (32 bytes)").default("36e2fdc7e919d390819193e349d42df042bcab2bd42461b3be107221fadee0b6"),
  AZURE_CLIENT_ID: z.string().optional().default(""),
  AZURE_CLIENT_SECRET: z.string().optional().default(""),
  AZURE_TENANT_ID: z.string().optional().default("common"),
  AZURE_REDIRECT_URI: z.string().optional().default("http://localhost:3000/auth/microsoft/callback"),
  APIFY_API_TOKEN: z.string().optional().default(""),
  SKOOL_GROUP_SLUG: z.string().optional().default(""),
  SKOOL_EMAIL: z.string().optional().default(""),
  SKOOL_PASSWORD: z.string().optional().default(""),
  SKOOL_LABEL_ID: z.string().optional().default(""),
});

export const config = envSchema.parse({
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  SESSION_SECRET: process.env.SESSION_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
  AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
  AZURE_REDIRECT_URI: process.env.AZURE_REDIRECT_URI,
  APIFY_API_TOKEN: process.env.APIFY_API_TOKEN,
  SKOOL_GROUP_SLUG: process.env.SKOOL_GROUP_SLUG,
  SKOOL_EMAIL: process.env.SKOOL_EMAIL,
  SKOOL_PASSWORD: process.env.SKOOL_PASSWORD,
  SKOOL_LABEL_ID: process.env.SKOOL_LABEL_ID,
});
