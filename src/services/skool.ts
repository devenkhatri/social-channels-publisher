import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { stripMarkdown } from "./extractor";

const ACTOR_NAME = "cristiantala~skool-all-in-one-api";
const APIFY_BASE_URL = "https://api.apify.com/v2/acts";

export interface SkoolCategory {
  id: string;
  name: string;
  color?: string;
  postWriteRole?: number;
}

export interface SkoolPublishParams {
  title?: string | null;
  body?: string | null;
  youtubeUrl: string;
  labelId?: string | null;
}

export interface SkoolPublishResult {
  success: boolean;
  url: string;
  postId: string;
  title: string;
}

/**
 * Sanitizes a raw Skool group slug from a full URL, trailing slashes, or whitespace.
 * e.g. "https://www.skool.com/practical-ai-9211/" -> "practical-ai-9211"
 */
export function sanitizeGroupSlug(rawSlug?: string | null): string {
  if (!rawSlug) return "";
  let slug = rawSlug.trim();
  slug = slug.replace(/^https?:\/\/(www\.)?skool\.com\//i, "");
  slug = slug.replace(/^\/+|\/+$/g, "");
  slug = slug.split("/")[0].split("?")[0].trim();
  return slug;
}

/**
 * Validates that all required Skool and Apify environment variables are present.
 */
function getSkoolConfig() {
  const token = process.env.APIFY_API_TOKEN?.trim();
  const groupSlug = sanitizeGroupSlug(process.env.SKOOL_GROUP_SLUG);
  const email = process.env.SKOOL_EMAIL?.trim();
  const password = process.env.SKOOL_PASSWORD?.trim();
  const defaultLabelId = process.env.SKOOL_LABEL_ID?.trim() || null;

  if (!token) {
    throw new Error("Missing APIFY_API_TOKEN in environment. Please add it to your .env.local file.");
  }
  if (!groupSlug) {
    throw new Error("Missing SKOOL_GROUP_SLUG in environment. Please add it to your .env.local file.");
  }
  if (!email || !password) {
    throw new Error("Missing SKOOL_EMAIL or SKOOL_PASSWORD in environment. Please add them to your .env.local file.");
  }

  return { token, groupSlug, email, password, defaultLabelId };
}

/**
 * Reads cached Skool session cookies from the settings table.
 */
async function getCachedSkoolCookies(): Promise<string | null> {
  try {
    const rows = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, "skool_session_cookies"));

    if (rows.length === 0) return null;

    const data = JSON.parse(rows[0].value);
    if (!data.cookies) return null;

    // Check if expired or within 30 min of expiration
    if (data.expiresAt) {
      const expiresAt = new Date(data.expiresAt).getTime();
      const now = Date.now();
      if (expiresAt - now < 30 * 60 * 1000) {
        console.log("[Skool Service] Cached session cookies expired or near expiration");
        return null;
      }
    }

    return data.cookies;
  } catch (err) {
    console.warn("[Skool Service] Failed to read cached cookies:", err);
    return null;
  }
}

/**
 * Persists Skool session cookies into the settings table.
 */
async function saveSkoolCookies(cookies: string, expiresAt?: string): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    const payload = JSON.stringify({ cookies, expiresAt });

    const existing = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, "skool_session_cookies"));

    if (existing.length > 0) {
      await db
        .update(schema.settings)
        .set({ value: payload, updatedAt: nowIso })
        .where(eq(schema.settings.key, "skool_session_cookies"));
    } else {
      await db.insert(schema.settings).values({
        key: "skool_session_cookies",
        value: payload,
        updatedAt: nowIso,
      });
    }
    console.log("[Skool Service] Cached new session cookies in settings");
  } catch (err) {
    console.warn("[Skool Service] Failed to save session cookies:", err);
  }
}

/**
 * Calls the Apify Actor synchronously and returns the first dataset item.
 */
async function runApifyActor(input: Record<string, any>, timeoutSeconds = 120): Promise<any> {
  const { token } = getSkoolConfig();
  const url = `${APIFY_BASE_URL}/${ACTOR_NAME}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=${timeoutSeconds}`;

  console.log(`[Skool Service] Invoking Apify actor for action: ${input.action}`);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Skool Service] Apify HTTP error:", response.status, errorText);
    throw new Error(`Apify run failed (HTTP ${response.status}): ${errorText.slice(0, 300)}`);
  }

  const items = await response.json();
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Apify actor returned empty dataset items");
  }

  return items[0];
}

/**
 * Performs auth:login to acquire fresh session cookies.
 */
export async function loginToSkool(): Promise<string> {
  const { groupSlug, email, password } = getSkoolConfig();

  console.log(`[Skool Service] Authenticating with Skool community '${groupSlug}' via Playwright...`);
  const result = await runApifyActor(
    {
      action: "auth:login",
      groupSlug,
      email,
      password,
    },
    120
  );

  if (result.success === false || !result.cookies) {
    const errMsg = result.error || result.errorCode || result.hint || "Skool authentication failed";
    console.error("[Skool Service] Login failure:", errMsg);
    throw new Error(`Skool Login Error: ${errMsg}`);
  }

  await saveSkoolCookies(result.cookies, result.expiresAt);
  return result.cookies;
}

/**
 * Retrieves the categories / labels available for the Skool community.
 * Uses cached categories if available (24-hour cache), otherwise queries Skool via Apify.
 */
export async function getSkoolCategories(): Promise<SkoolCategory[]> {
  try {
    // Check cached categories in settings
    const cachedRow = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, "skool_cached_labels"));

    if (cachedRow.length > 0) {
      const parsed = JSON.parse(cachedRow[0].value);
      const cacheAge = Date.now() - new Date(parsed.cachedAt || 0).getTime();
      if (cacheAge < 24 * 60 * 60 * 1000 && Array.isArray(parsed.categories)) {
        return parsed.categories;
      }
    }
  } catch (e) {
    console.warn("[Skool Service] Error reading cached categories:", e);
  }

  try {
    const { groupSlug, email, password } = getSkoolConfig();
    let cookies = await getCachedSkoolCookies();

    let input: Record<string, any> = {
      action: "groups:get",
      groupSlug,
      params: { slug: groupSlug },
    };

    if (cookies) {
      input.cookies = cookies;
    } else {
      input.email = email;
      input.password = password;
    }

    const res = await runApifyActor(input, 60);

    if (res && Array.isArray(res.labels)) {
      const categories: SkoolCategory[] = res.labels.map((l: any) => ({
        id: l.id,
        name: l.metadata?.displayName || l.name || "General",
        color: l.metadata?.color,
        postWriteRole: l.metadata?.postWriteRole,
      }));

      // Cache categories
      try {
        const payload = JSON.stringify({ categories, cachedAt: new Date().toISOString() });
        const existing = await db
          .select()
          .from(schema.settings)
          .where(eq(schema.settings.key, "skool_cached_labels"));

        if (existing.length > 0) {
          await db
            .update(schema.settings)
            .set({ value: payload, updatedAt: new Date().toISOString() })
            .where(eq(schema.settings.key, "skool_cached_labels"));
        } else {
          await db.insert(schema.settings).values({
            key: "skool_cached_labels",
            value: payload,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (saveErr) {
        console.warn("[Skool Service] Failed to cache categories:", saveErr);
      }

      return categories;
    }

    return [];
  } catch (err: any) {
    console.error("[Skool Service] Failed to fetch Skool categories:", err);
    return [];
  }
}

/**
 * Publishes a post to the configured Skool community with the YouTube post URL attached.
 */
export async function publishPostToSkool({
  title,
  body,
  youtubeUrl,
  labelId,
}: SkoolPublishParams): Promise<SkoolPublishResult> {
  const { groupSlug, email, password, defaultLabelId } = getSkoolConfig();

  if (!youtubeUrl || !youtubeUrl.trim()) {
    throw new Error("Cannot publish to Skool without a YouTube video URL.");
  }

  const cleanYouTubeUrl = youtubeUrl.trim();
  const cleanTitle = stripMarkdown(title || "New Community Video").trim();
  let cleanBody = stripMarkdown(body || "").trim();

  // Attach YouTube URL to the content body if not already present
  if (!cleanBody.includes(cleanYouTubeUrl)) {
    cleanBody = cleanBody
      ? `${cleanBody}\n\n${cleanYouTubeUrl}`
      : cleanYouTubeUrl;
  }

  // Resolve target category label
  let effectiveLabelId = labelId || defaultLabelId;

  // If no labelId provided, try to pick the first available category from the community
  if (!effectiveLabelId) {
    try {
      const categories = await getSkoolCategories();
      if (categories.length > 0) {
        // Prefer "Tips & Tutorials", "AI Strategy", or first category
        const preferred =
          categories.find((c) => /tutorial|strategy|insight|tool|review/i.test(c.name)) ||
          categories[0];
        effectiveLabelId = preferred.id;
        console.log(`[Skool Service] Auto-selected category: ${preferred.name} (${preferred.id})`);
      }
    } catch (catErr) {
      console.warn("[Skool Service] Could not auto-detect category:", catErr);
    }
  }

  // Get or refresh cookies
  let cookies = await getCachedSkoolCookies();
  if (!cookies) {
    cookies = await loginToSkool();
  }

  // Helper to execute post creation
  const executeCreate = async (sessionCookies: string) => {
    return await runApifyActor(
      {
        action: "posts:create",
        groupSlug,
        cookies: sessionCookies,
        params: {
          title: cleanTitle,
          content: cleanBody,
          ...(effectiveLabelId ? { labelId: effectiveLabelId } : {}),
          notifyAll: false,
        },
      },
      120
    );
  };

  let result = await executeCreate(cookies);

  // If session expired or WAF challenge triggered, refresh cookies and retry once
  if (
    result.success === false &&
    (result.errorCode === "WAF_EXPIRED" ||
      result.errorCode === "AUTH_ERROR" ||
      result.errorCategory === "auth_error")
  ) {
    console.log("[Skool Service] Session expired or challenge detected, refreshing cookies and retrying...");
    cookies = await loginToSkool();
    result = await executeCreate(cookies);
  }

  // Check for error in result
  if (result.success === false || result.error || !result.url) {
    const errorDetails =
      result.error ||
      result.errorCode ||
      result.hint ||
      "Apify actor reported failure when creating Skool post";
    console.error("[Skool Service] Skool post creation failed:", result);
    throw new Error(`Skool API Error: ${errorDetails}`);
  }

  console.log(`[Skool Service] Successfully published to Skool! URL: ${result.url}`);
  return {
    success: true,
    url: result.url,
    postId: result.id || "",
    title: cleanTitle,
  };
}

