import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// 1. App settings (key-value store for OneDrive config, flags, etc.)
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// 2. Zernio accounts
export const zernioAccounts = sqliteTable("zernio_accounts", {
  id: text("id").primaryKey(), // UUID
  name: text("name").notNull(), // Display name e.g. "Main Account"
  apiKey: text("api_key").notNull(), // Encrypted API key
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// 3. Discovered Zernio profiles
export const zernioProfiles = sqliteTable("zernio_profiles", {
  id: text("id").primaryKey(), // UUID
  zernioAccountId: text("zernio_account_id")
    .notNull()
    .references(() => zernioAccounts.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(), // 'linkedin' | 'youtube' | 'instagram' | 'facebook'
  profileId: text("profile_id").notNull(),
  profileName: text("profile_name"),
  profileAvatar: text("profile_avatar"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// 4. Content items (OneDrive folders)
export const contentItems = sqliteTable("content_items", {
  id: text("id").primaryKey(), // UUID
  folderName: text("folder_name").notNull(), // e.g. "20261026-0823" or "20261026-0823-Done"
  originalFolderName: text("original_folder_name").notNull(), // Base name without "-Done"
  folderPath: text("folder_path").notNull(),
  driveItemId: text("drive_item_id").notNull().unique(), // Immutable ID in OneDrive
  isDone: integer("is_done").notNull().default(0), // 1 if ends with "-Done" (published), 0 if unpublished
  title: text("title"), // Extracted from caption.md or linkedin-post.md
  coverImage: text("cover_image"), // Path or item ID to cover.svg / thumbnail
  slideCount: integer("slide_count").default(0), // Number of slide files in slides/
  syncedAt: text("synced_at"),
  renamedAt: text("renamed_at"), // When folder was renamed to -Done on OneDrive
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// 5. Per-channel posts
export const channelPosts = sqliteTable("channel_posts", {
  id: text("id").primaryKey(), // UUID
  contentItemId: text("content_item_id")
    .notNull()
    .references(() => contentItems.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(), // 'linkedin' | 'youtube' | 'instagram' | 'facebook' | 'skool'
  title: text("title"),
  body: text("body"),
  mediaType: text("media_type"), // 'video' | 'pdf' | 'video_reel' | 'carousel' | null
  postType: text("post_type"), // 'reel' | 'video' | 'document' | 'carousel' | 'feed'
  zernioAccountId: text("zernio_account_id").references(() => zernioAccounts.id),
  zernioProfileId: text("zernio_profile_id").references(() => zernioProfiles.id),
  status: text("status").notNull().default("draft"), // 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed'
  scheduledFor: text("scheduled_for"),
  publishedAt: text("published_at"),
  zernioPostId: text("zernio_post_id"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// 6. OneDrive OAuth tokens
export const oauthTokens = sqliteTable("oauth_tokens", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(), // 'microsoft'
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});
