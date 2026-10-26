import { Client } from "@microsoft/microsoft-graph-client";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/crypto";
import { config } from "@/lib/config";

const SCOPES = ["User.Read", "Files.ReadWrite", "Files.ReadWrite.All", "offline_access"].join(" ");

export interface AzureCredentials {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
}

/**
 * Resolves Azure credentials, prioritizing UI-configured settings in database,
 * then falling back to environment variables.
 */
export async function getAzureCredentials(): Promise<AzureCredentials> {
  const dbSettings = await db.select().from(schema.settings);
  const getSetting = (key: string) => dbSettings.find((s) => s.key === key)?.value;

  const clientId = getSetting("azure_client_id") || config.AZURE_CLIENT_ID || "";
  const clientSecret = getSetting("azure_client_secret") || config.AZURE_CLIENT_SECRET || "";
  const tenantId = getSetting("azure_tenant_id") || config.AZURE_TENANT_ID || "common";
  const redirectUri = getSetting("azure_redirect_uri") || config.AZURE_REDIRECT_URI || "http://localhost:3000/auth/microsoft/callback";

  return { clientId, clientSecret, tenantId, redirectUri };
}

/**
 * Generates the Microsoft OAuth 2.0 Authorization URL
 */
export async function getAuthorizationUrl(state: string = "onedrive_auth"): Promise<string> {
  const creds = await getAzureCredentials();
  if (!creds.clientId) {
    throw new Error("Azure Client ID is not configured. Please provide it in Settings or .env.local");
  }

  const params = new URLSearchParams({
    client_id: creds.clientId,
    response_type: "code",
    redirect_uri: creds.redirectUri,
    response_mode: "query",
    scope: SCOPES,
    state,
    prompt: "select_account",
  });

  return `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

/**
 * Exchanges the authorization code for access and refresh tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}> {
  const creds = await getAzureCredentials();
  if (!creds.clientId || !creds.clientSecret) {
    throw new Error("Azure credentials are incomplete. Client ID and Client Secret are required.");
  }

  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope: SCOPES,
    code,
    redirect_uri: creds.redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Failed to exchange authorization code for tokens");
  }

  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

  // Save tokens in database (encrypted)
  const existing = await db
    .select()
    .from(schema.oauthTokens)
    .where(eq(schema.oauthTokens.provider, "microsoft"));

  if (existing.length > 0) {
    await db
      .update(schema.oauthTokens)
      .set({
        accessToken: encrypt(data.access_token),
        refreshToken: data.refresh_token ? encrypt(data.refresh_token) : existing[0].refreshToken,
        expiresAt,
      })
      .where(eq(schema.oauthTokens.id, existing[0].id));
  } else {
    await db.insert(schema.oauthTokens).values({
      id: crypto.randomUUID(),
      provider: "microsoft",
      accessToken: encrypt(data.access_token),
      refreshToken: data.refresh_token ? encrypt(data.refresh_token) : null,
      expiresAt,
    });
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Gets a valid access token, auto-refreshing if expired or close to expiry
 */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await db
    .select()
    .from(schema.oauthTokens)
    .where(eq(schema.oauthTokens.provider, "microsoft"));

  if (tokens.length === 0) {
    return null;
  }

  const tokenRecord = tokens[0];
  const expiresAt = tokenRecord.expiresAt ? new Date(tokenRecord.expiresAt).getTime() : 0;
  const now = Date.now();

  // If token is valid for at least 5 more minutes, return it
  if (expiresAt - now > 5 * 60 * 1000) {
    return decrypt(tokenRecord.accessToken);
  }

  // If expired and we have a refresh token, refresh it
  if (tokenRecord.refreshToken) {
    try {
      const creds = await getAzureCredentials();
      const plainRefreshToken = decrypt(tokenRecord.refreshToken);

      const body = new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        scope: SCOPES,
        refresh_token: plainRefreshToken,
        grant_type: "refresh_token",
      });

      const response = await fetch(
        `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        console.error("Token refresh failed:", data);
        return null;
      }

      const newExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
      const newAccessTokenEncrypted = encrypt(data.access_token);
      const newRefreshTokenEncrypted = data.refresh_token ? encrypt(data.refresh_token) : tokenRecord.refreshToken;

      await db
        .update(schema.oauthTokens)
        .set({
          accessToken: newAccessTokenEncrypted,
          refreshToken: newRefreshTokenEncrypted,
          expiresAt: newExpiresAt,
        })
        .where(eq(schema.oauthTokens.id, tokenRecord.id));

      return data.access_token;
    } catch (err) {
      console.error("Error refreshing Microsoft access token:", err);
      return null;
    }
  }

  return null;
}

/**
 * Initializes authenticated Microsoft Graph client
 */
export async function getGraphClient(): Promise<Client> {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("No active Microsoft OneDrive connection. Please connect your account in Settings.");
  }

  return Client.init({
    authProvider: (done) => {
      done(null, token);
    },
  });
}

/**
 * Fetches user profile from Microsoft Graph
 */
export async function getUserProfile(): Promise<{ displayName: string; email: string }> {
  const client = await getGraphClient();
  const res = await client.api("/me").select("displayName,userPrincipalName,mail").get();
  return {
    displayName: res.displayName || "Microsoft User",
    email: res.mail || res.userPrincipalName || "",
  };
}

export interface OneDriveFolderItem {
  id: string;
  name: string;
  webUrl: string;
  childCount?: number;
  parentReference?: { path?: string; id?: string };
}

/**
 * Lists all subfolders under root or a specific folder ID, following pagination
 */
export async function listFolders(parentId?: string): Promise<OneDriveFolderItem[]> {
  const client = await getGraphClient();
  let nextUrl: string | undefined = !parentId || parentId === "root"
    ? "/me/drive/root/children"
    : `/me/drive/items/${parentId}/children`;

  const allItems: any[] = [];
  let isFirst = true;

  while (nextUrl) {
    let req = client.api(nextUrl);
    if (isFirst) {
      req = req.select("id,name,webUrl,folder,parentReference").top(200);
      isFirst = false;
    }
    const res = await req.get();
    const items = res.value || [];
    allItems.push(...items);
    nextUrl = res["@odata.nextLink"];
  }

  return allItems
    .filter((item: any) => Boolean(item.folder))
    .map((item: any) => ({
      id: item.id,
      name: item.name,
      webUrl: item.webUrl,
      childCount: item.folder?.childCount,
      parentReference: item.parentReference,
    }));
}

/**
 * Renames a folder in OneDrive
 * Used by the post-publish workflow to append "-Done" to folder names
 */
export async function renameFolder(itemId: string, newName: string): Promise<{ id: string; name: string }> {
  const client = await getGraphClient();
  const res = await client.api(`/me/drive/items/${itemId}`).patch({
    name: newName,
  });

  return {
    id: res.id,
    name: res.name,
  };
}

/**
 * Disconnects OneDrive and removes tokens
 */
export async function disconnectOneDrive(): Promise<void> {
  await db.delete(schema.oauthTokens).where(eq(schema.oauthTokens.provider, "microsoft"));
}

export interface DriveChildItem {
  id: string;
  name: string;
  isFolder: boolean;
  size?: number;
  webUrl: string;
  downloadUrl?: string;
  mimeType?: string;
  childCount?: number;
}

/**
 * Lists all children (files and subfolders) inside a given folder ID, following pagination
 */
export async function listFolderChildren(folderId: string): Promise<DriveChildItem[]> {
  const client = await getGraphClient();
  let nextUrl: string | undefined = !folderId || folderId === "root"
    ? "/me/drive/root/children"
    : `/me/drive/items/${folderId}/children`;

  const allItems: any[] = [];
  let isFirst = true;

  while (nextUrl) {
    let req = client.api(nextUrl);
    if (isFirst) {
      req = req.select("id,name,file,folder,size,webUrl,@microsoft.graph.downloadUrl").top(200);
      isFirst = false;
    }
    const res = await req.get();
    const items = res.value || [];
    allItems.push(...items);
    nextUrl = res["@odata.nextLink"];
  }

  return allItems.map((item: any) => ({
    id: item.id,
    name: item.name,
    isFolder: Boolean(item.folder),
    size: item.size,
    webUrl: item.webUrl,
    downloadUrl: item["@microsoft.graph.downloadUrl"],
    mimeType: item.file?.mimeType,
    childCount: item.folder?.childCount,
  }));
}


/**
 * Fetches the text content of a file in OneDrive (e.g. .md, .txt)
 */
export async function getFileContentAsText(itemId: string, downloadUrl?: string): Promise<string> {
  // If downloadUrl is present, fetch directly from CDN
  if (downloadUrl) {
    try {
      const res = await fetch(downloadUrl);
      if (res.ok) {
        return await res.text();
      }
    } catch {
      // Fallback to Graph API if CDN fetch fails
    }
  }

  // Fallback to Graph API /content
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("No active Microsoft OneDrive token");
  }

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/content`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch file content for item ${itemId}: ${res.statusText}`);
  }

  return await res.text();
}

/**
 * Fetches binary buffer of a file in OneDrive (e.g. for SVG rasterization or uploads)
 */
export async function getFileBuffer(itemId: string, downloadUrl?: string): Promise<Buffer> {
  if (downloadUrl) {
    try {
      const res = await fetch(downloadUrl);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        return Buffer.from(arrayBuf);
      }
    } catch {
      // Fallback to Graph API
    }
  }

  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("No active Microsoft OneDrive token");
  }

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/content`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch file buffer for item ${itemId}: ${res.statusText}`);
  }

  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

