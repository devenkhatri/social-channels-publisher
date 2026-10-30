import { db, schema, checkpointDb } from "@/db";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/crypto";

const ZERNIO_BASE_URL = process.env.ZERNIO_BASE_URL || "https://api.zernio.com/v1";

export interface ZernioConnectionView {
  id: string;
  connectionId: string;
  platform: string;
  username: string | null;
  displayName: string | null;
  profilePicture: string | null;
  profileUrl: string | null;
  isActive: boolean;
  platformStatus: string | null;
  followersCount: number | null;
}

export interface ZernioProfileView {
  id: string;
  profileId: string;
  name: string;
  isDefault: boolean;
  color: string | null;
  connectionsCount: number;
  availableChannels: string[];
  connections: ZernioConnectionView[];
  // Backward compatibility
  platform?: string;
  profileName?: string | null;
  profileAvatar?: string | null;
}

export interface ZernioAccountView {
  id: string;
  name: string;
  maskedApiKey: string;
  createdAt: string | null;
  availableChannels: string[];
  profiles: ZernioProfileView[];
}

/**
 * Lists all configured Zernio accounts with masked API keys, associated profiles, and active connections
 */
export async function getZernioAccounts(): Promise<ZernioAccountView[]> {
  const accounts = await db.select().from(schema.zernioAccounts);
  const profiles = await db.select().from(schema.zernioProfiles);
  const connections = await db.select().from(schema.zernioConnections);

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
    const accountConnections = connections.filter((c) => c.zernioAccountId === acc.id);

    const accNameLower = (acc.name || "").toLowerCase();
    const isBizAccount =
      accNameLower.includes("biz") ||
      accNameLower.includes("page") ||
      accNameLower.includes("company") ||
      accNameLower.includes("org");

    // Compute unique active channels across the account
    const availableChannels = Array.from(
      new Set(
        accountConnections
          .filter((c) => c.isActive === 1)
          .flatMap((c) => {
            const plat = c.platform.toLowerCase();
            const dispLower = (c.displayName || "").toLowerCase();
            const isOrgOrPage =
              plat === "linkedin_page" ||
              isBizAccount ||
              Boolean(c.connectionId?.includes("::")) ||
              dispLower.includes("page") ||
              dispLower.includes("company") ||
              dispLower.includes("technolabs");

            if (plat === "linkedin" || plat === "linkedin_page") {
              return isOrgOrPage ? ["linkedin_page", "linkedin"] : ["linkedin", "linkedin_page"];
            }
            return [plat];
          })
      )
    );

    return {
      id: acc.id,
      name: acc.name,
      maskedApiKey,
      createdAt: acc.createdAt,
      availableChannels,
      profiles: accountProfiles.map((p) => {
        const profileConns = accountConnections.filter(
          (c) => c.zernioProfileId === p.id
        );
        const profileChannels = Array.from(
          new Set(
            profileConns
              .filter((c) => c.isActive === 1)
              .flatMap((c) => {
                const plat = c.platform.toLowerCase();
                const dispLower = (c.displayName || "").toLowerCase();
                const isOrgOrPage =
                  plat === "linkedin_page" ||
                  isBizAccount ||
                  Boolean(c.connectionId?.includes("::")) ||
                  dispLower.includes("page") ||
                  dispLower.includes("company") ||
                  dispLower.includes("technolabs");

                if (plat === "linkedin" || plat === "linkedin_page") {
                  return isOrgOrPage ? ["linkedin_page", "linkedin"] : ["linkedin", "linkedin_page"];
                }
                return [plat];
              })
          )
        );

        return {
          id: p.id,
          profileId: p.profileId,
          name: p.profileName || "Default Profile",
          isDefault: Boolean(p.isDefault),
          color: p.color,
          connectionsCount: profileConns.length,
          availableChannels: profileChannels,
          connections: profileConns.map((c) => {
            const rawPlat = c.platform.toLowerCase();
            const dispLower = (c.displayName || "").toLowerCase();
            const isConnBiz =
              rawPlat === "linkedin_page" ||
              isBizAccount ||
              Boolean(c.connectionId?.includes("::")) ||
              dispLower.includes("page") ||
              dispLower.includes("company") ||
              dispLower.includes("technolabs");
            const effectivePlatform =
              rawPlat === "linkedin" && isConnBiz ? "linkedin_page" : c.platform;

            return {
              id: c.id,
              connectionId: c.connectionId,
              platform: effectivePlatform,
              username: c.username,
              displayName: c.displayName,
              profilePicture: c.profilePicture,
              profileUrl: c.profileUrl,
              isActive: Boolean(c.isActive),
              platformStatus: c.platformStatus,
              followersCount: c.followersCount,
            };
          }),
          // Backward-compat fields
          platform: profileChannels[0] || p.platform || "profile",
          profileName: p.profileName,
          profileAvatar: p.profileAvatar,
        };
      }),
    };
  });
}

/**
 * Adds a new Zernio account with encrypted API key
 */
export async function addZernioAccount(
  name: string,
  apiKey: string
): Promise<{ id: string; name: string }> {
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
    console.warn(
      "Initial profile discovery failed, can be refreshed later:",
      err
    );
  }

  checkpointDb();

  return { id, name: name.trim() };
}

/**
 * Deletes a Zernio account and cascades to associated profiles and connections
 */
export async function deleteZernioAccount(id: string): Promise<void> {
  await db
    .delete(schema.zernioConnections)
    .where(eq(schema.zernioConnections.zernioAccountId, id));
  await db
    .delete(schema.zernioProfiles)
    .where(eq(schema.zernioProfiles.zernioAccountId, id));
  await db
    .delete(schema.zernioAccounts)
    .where(eq(schema.zernioAccounts.id, id));
  checkpointDb();
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
  connectionsCount?: number;
  availableChannels?: string[];
}> {
  try {
    const [profilesRes, accountsRes] = await Promise.all([
      fetch(`${ZERNIO_BASE_URL}/profiles`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }),
      fetch(`${ZERNIO_BASE_URL}/accounts`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }),
    ]);

    if (
      profilesRes.status === 401 ||
      profilesRes.status === 403 ||
      accountsRes.status === 401 ||
      accountsRes.status === 403
    ) {
      return { valid: false, message: "Invalid Zernio API key (Unauthorized)" };
    }

    if (!profilesRes.ok && !accountsRes.ok) {
      return {
        valid: false,
        message: `Zernio API returned status ${profilesRes.status}: ${profilesRes.statusText}`,
      };
    }

    let profilesCount = 0;
    if (profilesRes.ok) {
      const pData = await profilesRes.json();
      const rawList = Array.isArray(pData)
        ? pData
        : pData?.profiles || pData?.data || [];
      profilesCount = rawList.length;
    }

    let connectionsCount = 0;
    const channels: string[] = [];
    if (accountsRes.ok) {
      const aData = await accountsRes.json();
      const accountsList = Array.isArray(aData)
        ? aData
        : aData?.accounts || aData?.data || [];
      connectionsCount = accountsList.length;
      accountsList.forEach((acc: any) => {
        const rawPlatform = (acc.platform || "").toLowerCase();
        const normPlatform = rawPlatform === "x" ? "twitter" : rawPlatform;
        if (normPlatform && !channels.includes(normPlatform)) {
          channels.push(normPlatform);
        }
        if (rawPlatform === "linkedin") {
          const hasOrgs =
            (Array.isArray(acc.metadata?.availableOrganizations) &&
              acc.metadata.availableOrganizations.length > 0) ||
            acc.metadata?.accountType === "organization";
          if (hasOrgs && !channels.includes("linkedin_page")) {
            channels.push("linkedin_page");
          }
        }
      });
    }

    const channelsText =
      channels.length > 0
        ? ` (${channels.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(", ")})`
        : "";

    return {
      valid: true,
      message: `Connected successfully! Found ${profilesCount} profile(s) with ${connectionsCount} active connection(s)${channelsText}.`,
      profilesCount,
      connectionsCount,
      availableChannels: channels,
    };
  } catch (error: any) {
    return {
      valid: false,
      message: `Failed to connect to Zernio API: ${error?.message || "Network error"}`,
    };
  }
}

export interface DiscoveryResult {
  profilesCount: number;
  connectionsCount: number;
  availableChannels: string[];
}

/**
 * Discovers connected social profiles and active connections for a Zernio account and stores them in DB
 */
export async function discoverProfiles(accountId: string): Promise<DiscoveryResult> {
  const apiKey = await getDecryptedApiKey(accountId);

  const existingAcc = await db
    .select()
    .from(schema.zernioAccounts)
    .where(eq(schema.zernioAccounts.id, accountId));
  const accountNameLower = (existingAcc[0]?.name || "").toLowerCase();
  const isBizAccount =
    accountNameLower.includes("biz") ||
    accountNameLower.includes("page") ||
    accountNameLower.includes("company") ||
    accountNameLower.includes("org");

  // Fetch both /profiles and /accounts concurrently
  const [profilesRes, accountsRes] = await Promise.all([
    fetch(`${ZERNIO_BASE_URL}/profiles`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
    fetch(`${ZERNIO_BASE_URL}/accounts`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
  ]);

  if (!profilesRes.ok && !accountsRes.ok) {
    throw new Error(
      `Failed to fetch profiles/accounts from Zernio: ${profilesRes.statusText || accountsRes.statusText}`
    );
  }

  let rawProfiles: any[] = [];
  if (profilesRes.ok) {
    const json = await profilesRes.json();
    rawProfiles = Array.isArray(json)
      ? json
      : json?.profiles || json?.data || [];
  }

  let rawAccounts: any[] = [];
  if (accountsRes.ok) {
    const json = await accountsRes.json();
    rawAccounts = Array.isArray(json)
      ? json
      : json?.accounts || json?.data || [];
  }

  // If /profiles is empty but /accounts has connections, synthesize a default profile
  if (rawProfiles.length === 0 && rawAccounts.length > 0) {
    rawProfiles = [
      {
        _id: "default-profile",
        name: "Default Profile",
        isDefault: true,
      },
    ];
  }

  // Remove existing connections and profiles for this account to keep fresh sync
  await db
    .delete(schema.zernioConnections)
    .where(eq(schema.zernioConnections.zernioAccountId, accountId));
  await db
    .delete(schema.zernioProfiles)
    .where(eq(schema.zernioProfiles.zernioAccountId, accountId));

  let insertedProfilesCount = 0;
  let insertedConnectionsCount = 0;
  const discoveredChannels = new Set<string>();
  const assignedAccountIds = new Set<string>();

  for (const p of rawProfiles) {
    const zernioProfileId = String(p._id || p.id || p.profileId);
    const profileInternalId = crypto.randomUUID();
    const profileName = p.name || p.displayName || "Default Profile";
    const isDefault = p.isDefault ? 1 : rawProfiles.length === 1 ? 1 : 0;
    const color = p.color || null;

    await db.insert(schema.zernioProfiles).values({
      id: profileInternalId,
      zernioAccountId: accountId,
      platform: "profile",
      profileId: zernioProfileId,
      profileName,
      profileAvatar: null,
      isDefault,
      color,
    });
    insertedProfilesCount++;

    // Find all accounts associated with this profile
    const matchingAccounts = rawAccounts.filter((acc: any) => {
      const accProfId =
        typeof acc.profileId === "object" ? acc.profileId?._id : acc.profileId;
      return (
        accProfId === zernioProfileId ||
        (!accProfId && rawProfiles.length === 1)
      );
    });

    for (const acc of matchingAccounts) {
      const connZernioId = String(acc._id || acc.id || acc.accountId);
      assignedAccountIds.add(connZernioId);

      let platform = (
        acc.platform ||
        acc.provider ||
        acc.type ||
        "unknown"
      ).toLowerCase();
      if (platform === "x") platform = "twitter";
      if (
        platform === "linkedin" &&
        (acc.metadata?.accountType === "organization" ||
          acc.metadata?.isCompany ||
          acc.type === "company" ||
          isBizAccount)
      ) {
        platform = "linkedin_page";
      }

      if (acc.isActive !== false) {
        discoveredChannels.add(platform);
        if (platform === "linkedin_page") {
          discoveredChannels.add("linkedin");
        }
      }

      const username =
        acc.username ||
        acc.metadata?.profileData?.username ||
        acc.metadata?.userProfile?.username ||
        null;
      const displayName =
        acc.displayName ||
        acc.metadata?.profileData?.displayName ||
        acc.metadata?.userProfile?.displayName ||
        username ||
        `${platform} Channel`;
      const profilePicture =
        acc.profilePicture ||
        acc.metadata?.profileData?.profilePicture ||
        acc.metadata?.userProfile?.profilePicture ||
        null;
      const profileUrl =
        acc.profileUrl ||
        acc.metadata?.profileData?.profileUrl ||
        acc.metadata?.userProfile?.profileUrl ||
        null;
      const followersCount =
        typeof acc.followersCount === "number"
          ? acc.followersCount
          : typeof acc.metadata?.profileData?.followersCount === "number"
          ? acc.metadata?.profileData?.followersCount
          : null;

      await db.insert(schema.zernioConnections).values({
        id: crypto.randomUUID(),
        zernioAccountId: accountId,
        zernioProfileId: profileInternalId,
        connectionId: connZernioId,
        platform,
        username,
        displayName,
        profilePicture,
        profileUrl,
        isActive: acc.isActive !== false ? 1 : 0,
        platformStatus:
          acc.platformStatus || (acc.isActive !== false ? "active" : "inactive"),
        followersCount,
      });
      insertedConnectionsCount++;

      // Check for LinkedIn organization / company pages available to this account
      if (
        (platform === "linkedin" || platform === "linkedin_page") &&
        Array.isArray(acc.metadata?.availableOrganizations) &&
        acc.metadata.availableOrganizations.length > 0
      ) {
        for (const org of acc.metadata.availableOrganizations) {
          const orgUrn = org.urn || (org.id ? `urn:li:organization:${org.id}` : "");
          const compoundConnectionId = orgUrn
            ? `${connZernioId}::${orgUrn}`
            : `${connZernioId}::org-${org.id}`;
          const orgDisplayName = `${org.name || "LinkedIn Page"} (Business Page)`;
          const orgUsername = org.vanityName || (org.id ? String(org.id) : null);
          const orgLogo = org.logoUrl || null;
          const orgUrl = org.vanityName
            ? `https://www.linkedin.com/company/${org.vanityName}`
            : org.id
            ? `https://www.linkedin.com/company/${org.id}`
            : null;

          await db.insert(schema.zernioConnections).values({
            id: crypto.randomUUID(),
            zernioAccountId: accountId,
            zernioProfileId: profileInternalId,
            connectionId: compoundConnectionId,
            platform: "linkedin_page",
            username: orgUsername,
            displayName: orgDisplayName,
            profilePicture: orgLogo,
            profileUrl: orgUrl,
            isActive: acc.isActive !== false ? 1 : 0,
            platformStatus:
              acc.platformStatus || (acc.isActive !== false ? "active" : "inactive"),
            followersCount: null,
          });
          insertedConnectionsCount++;
          if (acc.isActive !== false) {
            discoveredChannels.add("linkedin_page");
          }
        }
      }
    }
  }

  // Handle any orphan accounts that weren't assigned to any profile
  const unassignedAccounts = rawAccounts.filter(
    (acc: any) =>
      !assignedAccountIds.has(String(acc._id || acc.id || acc.accountId))
  );

  if (unassignedAccounts.length > 0) {
    const fallbackProfileInternalId = crypto.randomUUID();
    await db.insert(schema.zernioProfiles).values({
      id: fallbackProfileInternalId,
      zernioAccountId: accountId,
      platform: "profile",
      profileId: "unassigned-profile",
      profileName: "Other Channels",
      isDefault: 0,
      color: null,
    });
    insertedProfilesCount++;

    for (const acc of unassignedAccounts) {
      const connZernioId = String(acc._id || acc.id || acc.accountId);
      let platform = (acc.platform || "unknown").toLowerCase();
      if (platform === "x") platform = "twitter";
      if (
        platform === "linkedin" &&
        (acc.metadata?.accountType === "organization" ||
          acc.metadata?.isCompany ||
          acc.type === "company" ||
          isBizAccount)
      ) {
        platform = "linkedin_page";
      }
      if (acc.isActive !== false) {
        discoveredChannels.add(platform);
        if (platform === "linkedin_page") {
          discoveredChannels.add("linkedin");
        }
      }

      await db.insert(schema.zernioConnections).values({
        id: crypto.randomUUID(),
        zernioAccountId: accountId,
        zernioProfileId: fallbackProfileInternalId,
        connectionId: connZernioId,
        platform,
        username: acc.username || null,
        displayName: acc.displayName || acc.username || `${platform} Channel`,
        profilePicture: acc.profilePicture || null,
        profileUrl: acc.profileUrl || null,
        isActive: acc.isActive !== false ? 1 : 0,
        platformStatus: acc.platformStatus || "active",
        followersCount:
          typeof acc.followersCount === "number" ? acc.followersCount : null,
      });
      insertedConnectionsCount++;

      // Check for LinkedIn organization / company pages
      if (
        (platform === "linkedin" || platform === "linkedin_page") &&
        Array.isArray(acc.metadata?.availableOrganizations) &&
        acc.metadata.availableOrganizations.length > 0
      ) {
        for (const org of acc.metadata.availableOrganizations) {
          const orgUrn = org.urn || (org.id ? `urn:li:organization:${org.id}` : "");
          const compoundConnectionId = orgUrn
            ? `${connZernioId}::${orgUrn}`
            : `${connZernioId}::org-${org.id}`;
          const orgDisplayName = `${org.name || "LinkedIn Page"} (Business Page)`;
          const orgUsername = org.vanityName || (org.id ? String(org.id) : null);
          const orgLogo = org.logoUrl || null;
          const orgUrl = org.vanityName
            ? `https://www.linkedin.com/company/${org.vanityName}`
            : org.id
            ? `https://www.linkedin.com/company/${org.id}`
            : null;

          await db.insert(schema.zernioConnections).values({
            id: crypto.randomUUID(),
            zernioAccountId: accountId,
            zernioProfileId: fallbackProfileInternalId,
            connectionId: compoundConnectionId,
            platform: "linkedin_page",
            username: orgUsername,
            displayName: orgDisplayName,
            profilePicture: orgLogo,
            profileUrl: orgUrl,
            isActive: acc.isActive !== false ? 1 : 0,
            platformStatus:
              acc.platformStatus || (acc.isActive !== false ? "active" : "inactive"),
            followersCount: null,
          });
          insertedConnectionsCount++;
          if (acc.isActive !== false) {
            discoveredChannels.add("linkedin_page");
          }
        }
      }
    }
  }

  checkpointDb();

  return {
    profilesCount: insertedProfilesCount,
    connectionsCount: insertedConnectionsCount,
    availableChannels: Array.from(discoveredChannels),
  };
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

export interface ZernioMediaItem {
  type: "image" | "video" | "document";
  url: string;
  thumbnail?: string;
}

export interface ZernioPublishPayload {
  platform: "linkedin" | "youtube" | "instagram" | "facebook" | "threads" | "twitter" | "x" | "linkedin_page";
  accountId: string; // The social profile ID in Zernio
  content: string;
  title?: string | null;
  mediaItems?: ZernioMediaItem[];
  mediaUrls?: string[];
  postType?: "reel" | "video" | "document" | "carousel" | "feed";
  publishNow?: boolean;
  scheduledFor?: string | null;
  queuedFromProfile?: string | null;
  queueId?: string | null;
  platformSpecificData?: Record<string, any>;
}

/**
 * Publishes or queues a post to Zernio
 */
export async function publishPostToZernio(
  apiKey: string,
  payload: ZernioPublishPayload
): Promise<{ id: string; status: string; scheduledFor?: string | null; rawResponse: any }> {
  const idempotencyKey = crypto.randomUUID();

  // Normalize mediaItems array
  let mediaItems: ZernioMediaItem[] = payload.mediaItems ? [...payload.mediaItems] : [];
  if (mediaItems.length === 0 && payload.mediaUrls && payload.mediaUrls.length > 0) {
    mediaItems = payload.mediaUrls.map((url) => {
      let type: "image" | "video" | "document" = "image";
      if (
        payload.platform === "youtube" ||
        payload.postType === "video" ||
        payload.postType === "reel" ||
        /\.mp4(\?.*)?$/i.test(url)
      ) {
        type = "video";
      } else if (payload.postType === "document" || /\.pdf(\?.*)?$/i.test(url)) {
        type = "document";
      }
      return { type, url };
    });
  }

  let targetAccountId = payload.accountId;
  const specificData: Record<string, any> = { ...(payload.platformSpecificData || {}) };

  // Handle compound accountId for LinkedIn Organization: "baseAccountId::urn:li:organization:123"
  if (targetAccountId.includes("::")) {
    const [baseId, orgUrn] = targetAccountId.split("::");
    targetAccountId = baseId;
    if (!specificData.organizationUrn) {
      specificData.organizationUrn = orgUrn;
    }
  }

  // Normalize platform for Zernio API
  let zernioPlatform = payload.platform as string;
  if (payload.platform === "linkedin_page") {
    zernioPlatform = "linkedin";
  } else if (payload.platform === "x") {
    zernioPlatform = "twitter";
  }

  const platformEntry: any = {
    platform: zernioPlatform,
    accountId: targetAccountId,
  };

  if (zernioPlatform === "youtube") {
    // YouTube requires video title in platformSpecificData (max 100 chars)
    const rawTitle = payload.title || payload.content.split("\n")[0] || "Video";
    const cleanTitle = rawTitle
      .replace(/^(linkedin\s+(carousel\s+)?(caption|post):\s*)/i, "")
      .trim();
    specificData.title = cleanTitle.substring(0, 100);
    if (specificData.visibility === undefined) {
      specificData.visibility = "public";
    }
    if (specificData.madeForKids === undefined) {
      specificData.madeForKids = false;
    }
    if (specificData.categoryId === undefined) {
      specificData.categoryId = "28"; // Science & Technology
    }
    platformEntry.platformSpecificData = specificData;
  } else if (zernioPlatform === "linkedin") {
    if (payload.postType === "document" || mediaItems.some((m) => m.type === "document")) {
      specificData.documentTitle = (payload.title || "Document").substring(0, 100);
    }
    if (Object.keys(specificData).length > 0) {
      platformEntry.platformSpecificData = specificData;
    }
  } else if (Object.keys(specificData).length > 0) {
    platformEntry.platformSpecificData = specificData;
  }

  const body: any = {
    platforms: [platformEntry],
    content: payload.content,
  };

  if (specificData.tags && Array.isArray(specificData.tags)) {
    body.tags = specificData.tags;
  }

  if (payload.queuedFromProfile) {
    body.queuedFromProfile = payload.queuedFromProfile;
    if (payload.queueId) {
      body.queueId = payload.queueId;
    }
    // Omit publishNow and scheduledFor to let Zernio assign the profile's next queue slot
  } else if (payload.scheduledFor) {
    body.scheduledFor = payload.scheduledFor;
    body.publishNow = false;
  } else {
    body.publishNow = payload.publishNow ?? true;
  }

  if (payload.title) {
    body.title = payload.title;
  }

  if (mediaItems.length > 0) {
    body.mediaItems = mediaItems;
  }

  // Also include mediaUrls for backward compatibility
  if (payload.mediaUrls && payload.mediaUrls.length > 0) {
    body.mediaUrls = payload.mediaUrls;
  } else if (mediaItems.length > 0) {
    body.mediaUrls = mediaItems.map((m) => m.url);
  }

  // YouTube Shorts, Twitter, and Threads do not use postType field
  if (
    payload.postType &&
    zernioPlatform !== "youtube" &&
    zernioPlatform !== "twitter" &&
    zernioPlatform !== "threads"
  ) {
    body.postType = payload.postType;
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

  const postObj = responseJson.post || responseJson.data || responseJson;
  const postId = postObj._id || postObj.id || responseJson.id || responseJson.postId || idempotencyKey;
  const status = postObj.status || responseJson.status || (payload.queuedFromProfile ? "scheduled" : "published");
  const scheduledFor = postObj.scheduledFor || responseJson.scheduledFor || null;

  return {
    id: String(postId),
    status,
    scheduledFor,
    rawResponse: responseJson,
  };
}

export function constructPlatformPostUrl(
  platform: string,
  postId: string,
  username?: string | null
): string | null {
  if (!postId) return null;
  const p = (platform || "").toLowerCase();
  if (p === "linkedin" || p === "linkedin_page") {
    const urn = postId.startsWith("urn:li:") ? postId : `urn:li:ugcPost:${postId}`;
    return `https://www.linkedin.com/feed/update/${urn}/`;
  }
  if (p === "threads") {
    return username
      ? `https://www.threads.net/@${username}/post/${postId}`
      : `https://www.threads.net/post/${postId}`;
  }
  if (p === "youtube") {
    return `https://www.youtube.com/watch?v=${postId}`;
  }
  if (p === "twitter" || p === "x") {
    return username
      ? `https://x.com/${username}/status/${postId}`
      : `https://x.com/i/web/status/${postId}`;
  }
  if (p === "facebook") {
    return `https://www.facebook.com/${postId}`;
  }
  if (p === "instagram") {
    return `https://www.instagram.com/p/${postId}/`;
  }
  return null;
}

export interface QueuedPostPlatform {
  platform: string;
  status: string;
  username?: string | null;
  displayName?: string | null;
  profilePicture?: string | null;
  scheduledFor?: string | null;
  platformSpecificData?: Record<string, any>;
  platformPostUrl?: string | null;
  platformPostId?: string | null;
  publishedAt?: string | null;
}

export interface QueuedPostItem {
  id: string;
  zernioAccountId: string;
  zernioAccountName: string;
  profileId?: string | null;
  profileName?: string | null;
  title: string;
  content: string;
  scheduledFor: string | null;
  status: string;
  queueId?: string | null;
  mediaItems: Array<{
    url: string;
    type: "video" | "image" | "document" | string;
  }>;
  platforms: QueuedPostPlatform[];
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AccountQueueSummary {
  accountId: string;
  accountName: string;
  totalQueued: number;
  platforms: string[];
  profiles: Array<{
    id: string;
    name: string;
    queuedCount: number;
  }>;
}

export interface ZernioQueuesResponse {
  accounts: AccountQueueSummary[];
  posts: QueuedPostItem[];
  totalQueued: number;
  nextScheduledAt: string | null;
}

/**
 * Fetches all queued / scheduled posts across all configured Zernio accounts
 */
export async function getZernioQueues(options?: {
  accountId?: string;
  status?: string;
}): Promise<ZernioQueuesResponse> {
  const accounts = await db.select().from(schema.zernioAccounts);
  const profiles = await db.select().from(schema.zernioProfiles);

  const statusFilter = options?.status || "scheduled";
  const targetAccounts = options?.accountId
    ? accounts.filter((a) => a.id === options.accountId)
    : accounts;

  const allPosts: QueuedPostItem[] = [];
  const accountSummaries: AccountQueueSummary[] = [];

  for (const acc of targetAccounts) {
    let apiKey = "";
    try {
      apiKey = decrypt(acc.apiKey);
    } catch {
      continue;
    }

    try {
      const url =
        statusFilter === "all"
          ? `${ZERNIO_BASE_URL}/posts?limit=100`
          : `${ZERNIO_BASE_URL}/posts?status=${encodeURIComponent(statusFilter)}&limit=100`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        console.warn(`[Zernio Queues] Failed to fetch queues for account ${acc.name}: ${res.status}`);
        accountSummaries.push({
          accountId: acc.id,
          accountName: acc.name,
          totalQueued: 0,
          platforms: [],
          profiles: [],
        });
        continue;
      }

      const data = await res.json();
      const rawPosts = data.posts || [];
      const accountProfiles = profiles.filter((p) => p.zernioAccountId === acc.id);

      const platformsSet = new Set<string>();

      for (const p of rawPosts) {
        const matchingProfile = accountProfiles.find(
          (prof) => prof.profileId === p.queuedFromProfile || prof.id === p.queuedFromProfile
        );

        const platforms: QueuedPostPlatform[] = (p.platforms || []).map((pl: any) => {
          const platName = pl.platform || "unknown";
          platformsSet.add(platName);

          let postUrl = pl.platformPostUrl || p.platformPostUrl || null;
          const postId = pl.platformPostId || p.platformPostId || null;
          const username = pl.accountId?.username || null;

          if (!postUrl && postId) {
            postUrl = constructPlatformPostUrl(platName, String(postId), username);
          }

          return {
            platform: platName,
            status: pl.status || p.status || "pending",
            username,
            displayName: pl.accountId?.displayName || null,
            profilePicture: pl.accountId?.profilePicture || null,
            scheduledFor: pl.scheduledFor || p.scheduledFor || null,
            platformSpecificData: pl.platformSpecificData || {},
            platformPostUrl: postUrl,
            platformPostId: postId ? String(postId) : null,
            publishedAt: pl.publishedAt || p.publishedAt || null,
          };
        });

        allPosts.push({
          id: p._id || p.id,
          zernioAccountId: acc.id,
          zernioAccountName: acc.name,
          profileId: p.queuedFromProfile || null,
          profileName: matchingProfile?.profileName || null,
          title: p.title || "",
          content: p.content || "",
          scheduledFor: p.scheduledFor || null,
          status: p.status || statusFilter,
          queueId: p.queueId || null,
          mediaItems: (p.mediaItems || []).map((m: any) => ({
            url: m.url,
            type: m.type || "image",
          })),
          platforms,
          publishedAt: p.publishedAt || null,
          createdAt: p.createdAt || null,
          updatedAt: p.updatedAt || null,
        });
      }

      accountSummaries.push({
        accountId: acc.id,
        accountName: acc.name,
        totalQueued: rawPosts.length,
        platforms: Array.from(platformsSet),
        profiles: accountProfiles.map((prof) => ({
          id: prof.id,
          name: prof.profileName || prof.platform,
          queuedCount: rawPosts.filter((p: any) => p.queuedFromProfile === prof.profileId).length,
        })),
      });
    } catch (err: any) {
      console.error(`[Zernio Queues] Error querying account ${acc.name}:`, err);
      accountSummaries.push({
        accountId: acc.id,
        accountName: acc.name,
        totalQueued: 0,
        platforms: [],
        profiles: [],
      });
    }
  }

  // Sort chronologically ascending by scheduledFor (soonest scheduled first)
  allPosts.sort((a, b) => {
    if (!a.scheduledFor) return 1;
    if (!b.scheduledFor) return -1;
    return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
  });

  const nextScheduledAt =
    allPosts.find((p) => p.scheduledFor && new Date(p.scheduledFor).getTime() > Date.now())
      ?.scheduledFor ||
    allPosts[0]?.scheduledFor ||
    null;

  return {
    accounts: accountSummaries,
    posts: allPosts,
    totalQueued: allPosts.length,
    nextScheduledAt,
  };
}

/**
 * Deletes / cancels a queued post from Zernio
 */
export async function deleteZernioQueuedPost(
  postId: string,
  accountId: string
): Promise<boolean> {
  const accounts = await db
    .select()
    .from(schema.zernioAccounts)
    .where(eq(schema.zernioAccounts.id, accountId));

  if (accounts.length === 0) throw new Error("Zernio account not found");
  const apiKey = decrypt(accounts[0].apiKey);

  const res = await fetch(`${ZERNIO_BASE_URL}/posts/${postId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(
      errorJson.message || `Failed to delete queued post from Zernio: ${res.statusText}`
    );
  }

  return true;
}

/**
 * Fetches a single post by ID from Zernio to inspect its live status and post URL
 */
export async function getZernioPost(
  postId: string,
  accountId?: string | null
): Promise<{
  id: string;
  status: string;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  platformPostUrl?: string | null;
  platformPostId?: string | null;
  rawResponse?: any;
} | null> {
  const accounts = await db.select().from(schema.zernioAccounts);
  if (accounts.length === 0) return null;

  // Prioritize matching account ID if provided
  const targetAccounts = accountId
    ? [
        ...accounts.filter((a) => a.id === accountId),
        ...accounts.filter((a) => a.id !== accountId),
      ]
    : accounts;

  for (const acc of targetAccounts) {
    let apiKey = "";
    try {
      apiKey = decrypt(acc.apiKey);
    } catch {
      continue;
    }

    try {
      const res = await fetch(`${ZERNIO_BASE_URL}/posts/${postId}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const p = data.post || data;
      const pl = p.platforms?.[0];

      let postUrl = pl?.platformPostUrl || p.platformPostUrl || null;
      const platformPostId = pl?.platformPostId || p.platformPostId || null;
      const platName = pl?.platform || p.platform || "";
      const username = pl?.accountId?.username || null;

      if (!postUrl && platformPostId) {
        postUrl = constructPlatformPostUrl(platName, String(platformPostId), username);
      }

      return {
        id: String(p._id || p.id || postId),
        status: p.status || pl?.status || "unknown",
        scheduledFor: p.scheduledFor || pl?.scheduledFor || null,
        publishedAt: p.publishedAt || pl?.publishedAt || null,
        platformPostUrl: postUrl,
        platformPostId: platformPostId ? String(platformPostId) : null,
        rawResponse: p,
      };
    } catch {
      continue;
    }
  }

  return null;
}
