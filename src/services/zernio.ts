import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/crypto";

const ZERNIO_BASE_URL = process.env.ZERNIO_BASE_URL || "https://api.zernio.com/v1";

export interface ZernioAccountView {
  id: string;
  name: string;
  maskedApiKey: string;
  createdAt: string | null;
  profiles: Array<{
    id: string;
    platform: string;
    profileId: string;
    profileName: string | null;
    profileAvatar: string | null;
  }>;
}

/**
 * Lists all configured Zernio accounts with masked API keys and associated profiles
 */
export async function getZernioAccounts(): Promise<ZernioAccountView[]> {
  const accounts = await db.select().from(schema.zernioAccounts);
  const profiles = await db.select().from(schema.zernioProfiles);

  return accounts.map((acc) => {
    let plainKey = "";
    try {
      plainKey = decrypt(acc.apiKey);
    } catch {
      plainKey = "••••••••";
    }

    const maskedApiKey =
      plainKey.length > 8
        ? `${plainKey.slice(0, 4)}••••${plainKey.slice(-4)}`
        : "••••••••";

    const accountProfiles = profiles.filter((p) => p.zernioAccountId === acc.id);

    return {
      id: acc.id,
      name: acc.name,
      maskedApiKey,
      createdAt: acc.createdAt,
      profiles: accountProfiles.map((p) => ({
        id: p.id,
        platform: p.platform,
        profileId: p.profileId,
        profileName: p.profileName,
        profileAvatar: p.profileAvatar,
      })),
    };
  });
}

/**
 * Adds a new Zernio account with encrypted API key
 */
export async function addZernioAccount(name: string, apiKey: string): Promise<{ id: string; name: string }> {
  if (!name.trim() || !apiKey.trim()) {
    throw new Error("Account name and API key are required.");
  }

  const id = crypto.randomUUID();
  const encryptedKey = encrypt(apiKey.trim());

  await db.insert(schema.zernioAccounts).values({
    id,
    name: name.trim(),
    apiKey: encryptedKey,
  });

  // Attempt automatic profile discovery
  try {
    await discoverProfiles(id);
  } catch (err) {
    console.warn("Initial profile discovery failed, can be refreshed later:", err);
  }

  return { id, name: name.trim() };
}

/**
 * Deletes a Zernio account and cascades to associated profiles
 */
export async function deleteZernioAccount(id: string): Promise<void> {
  await db.delete(schema.zernioProfiles).where(eq(schema.zernioProfiles.zernioAccountId, id));
  await db.delete(schema.zernioAccounts).where(eq(schema.zernioAccounts.id, id));
}

/**
 * Gets the decrypted API key for a given Zernio account ID
 */
export async function getDecryptedApiKey(accountId: string): Promise<string> {
  const acc = await db
    .select()
    .from(schema.zernioAccounts)
    .where(eq(schema.zernioAccounts.id, accountId));

  if (acc.length === 0) {
    throw new Error(`Zernio account ${accountId} not found.`);
  }

  return decrypt(acc[0].apiKey);
}

/**
 * Tests connection with Zernio API using the given API key
 */
export async function testZernioConnection(apiKey: string): Promise<{
  valid: boolean;
  message: string;
  profilesCount?: number;
}> {
  try {
    const res = await fetch(`${ZERNIO_BASE_URL}/profiles`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (res.status === 401 || res.status === 403) {
      return { valid: false, message: "Invalid Zernio API key (Unauthorized)" };
    }

    if (!res.ok) {
      // Try fallback to /accounts if /profiles endpoint differs
      const accountsRes = await fetch(`${ZERNIO_BASE_URL}/accounts`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!accountsRes.ok) {
        return {
          valid: false,
          message: `Zernio API returned status ${res.status}: ${res.statusText}`,
        };
      }

      const data = await accountsRes.json();
      const count = Array.isArray(data) ? data.length : data?.data?.length || 0;
      return {
        valid: true,
        message: `Connected successfully! Found ${count} connected social profile(s).`,
        profilesCount: count,
      };
    }

    const data = await res.json();
    const count = Array.isArray(data) ? data.length : data?.data?.length || 0;
    return {
      valid: true,
      message: `Connected successfully! Found ${count} connected social profile(s).`,
      profilesCount: count,
    };
  } catch (error: any) {
    return {
      valid: false,
      message: `Failed to connect to Zernio API: ${error?.message || "Network error"}`,
    };
  }
}

/**
 * Discovers connected social profiles for a Zernio account and stores them in DB
 */
export async function discoverProfiles(accountId: string): Promise<number> {
  const apiKey = await getDecryptedApiKey(accountId);

  let profilesData: any[] = [];

  // Try /profiles endpoint
  let res = await fetch(`${ZERNIO_BASE_URL}/profiles`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    // Fallback to /accounts endpoint
    res = await fetch(`${ZERNIO_BASE_URL}/accounts`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch profiles from Zernio: ${res.statusText}`);
  }

  const json = await res.json();
  profilesData = Array.isArray(json) ? json : json?.data || json?.profiles || json?.accounts || [];

  // Remove existing profiles for this account to keep fresh sync
  await db.delete(schema.zernioProfiles).where(eq(schema.zernioProfiles.zernioAccountId, accountId));

  let insertedCount = 0;
  for (const p of profilesData) {
    const platform = (p.platform || p.provider || p.type || "unknown").toLowerCase();
    const profileId = p.id || p.accountId || p.profileId || String(p._id);
    const profileName = p.name || p.displayName || p.username || `${platform} Profile`;
    const profileAvatar = p.avatarUrl || p.picture || p.image || null;

    if (profileId) {
      await db.insert(schema.zernioProfiles).values({
        id: crypto.randomUUID(),
        zernioAccountId: accountId,
        platform,
        profileId: String(profileId),
        profileName,
        profileAvatar,
      });
      insertedCount++;
    }
  }

  return insertedCount;
}

/**
 * Requests a presigned upload URL from Zernio and uploads binary buffer
 */
export async function uploadMediaToZernio(
  apiKey: string,
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<{ publicUrl: string; key?: string }> {
  // Step 1: Request presigned URL
  const presignRes = await fetch(`${ZERNIO_BASE_URL}/media/presign`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename,
      contentType,
    }),
  });

  if (!presignRes.ok) {
    const errorText = await presignRes.text();
    throw new Error(`Failed to request presigned upload URL from Zernio: ${errorText}`);
  }

  const { uploadUrl, publicUrl, key } = await presignRes.json();

  if (!uploadUrl) {
    throw new Error("Zernio did not return an uploadUrl in presign response.");
  }

  // Step 2: PUT binary buffer to uploadUrl
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Length": buffer.length.toString(),
    },
    body: new Uint8Array(buffer),
  });

  if (!uploadRes.ok) {
    throw new Error(`Failed to upload media to Zernio S3/storage: ${uploadRes.statusText}`);
  }

  return { publicUrl, key };
}

export interface ZernioPublishPayload {
  platform: "linkedin" | "youtube" | "instagram" | "facebook";
  accountId: string; // The social profile ID in Zernio
  content: string;
  title?: string | null;
  mediaUrls?: string[];
  postType?: "reel" | "video" | "document" | "carousel" | "feed";
  publishNow?: boolean;
  scheduledFor?: string | null;
}

/**
 * Publishes a post to Zernio
 */
export async function publishPostToZernio(
  apiKey: string,
  payload: ZernioPublishPayload
): Promise<{ id: string; status: string; rawResponse: any }> {
  const idempotencyKey = crypto.randomUUID();

  const body: any = {
    platforms: [
      {
        platform: payload.platform,
        accountId: payload.accountId,
      },
    ],
    content: payload.content,
    publishNow: payload.publishNow ?? true,
  };

  if (payload.title) {
    body.title = payload.title;
  }

  if (payload.mediaUrls && payload.mediaUrls.length > 0) {
    body.mediaUrls = payload.mediaUrls;
  }

  if (payload.postType) {
    body.postType = payload.postType;
  }

  if (payload.scheduledFor) {
    body.scheduledFor = payload.scheduledFor;
    body.publishNow = false;
  }

  const res = await fetch(`${ZERNIO_BASE_URL}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  const responseJson = await res.json();

  if (!res.ok) {
    const errorMsg = responseJson?.message || responseJson?.error || JSON.stringify(responseJson);
    throw new Error(`Zernio publishing error: ${errorMsg}`);
  }

  const postId = responseJson.id || responseJson.postId || responseJson.data?.id || idempotencyKey;
  const status = responseJson.status || "published";

  return {
    id: String(postId),
    status,
    rawResponse: responseJson,
  };
}
