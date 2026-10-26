import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getUserProfile, getAzureCredentials } from "@/services/onedrive";

export async function GET() {
  try {
    const creds = await getAzureCredentials();
    const hasAzureCreds = Boolean(creds.clientId && creds.clientSecret);

    const tokens = await db
      .select()
      .from(schema.oauthTokens)
      .where(eq(schema.oauthTokens.provider, "microsoft"));

    const isConnected = tokens.length > 0;
    let user = null;

    if (isConnected) {
      try {
        user = await getUserProfile();
      } catch (e) {
        console.warn("Could not fetch user profile (token may need refresh or scopes):", e);
      }
    }

    const settingsList = await db.select().from(schema.settings);
    const getSetting = (k: string) => settingsList.find((s) => s.key === k)?.value;

    const folderId = getSetting("onedrive_parent_folder_id");
    const folderName = getSetting("onedrive_parent_folder_name");
    const folderPath = getSetting("onedrive_parent_folder_path");
    const autoRename = getSetting("auto_rename_onedrive_on_publish") !== "false";

    const selectedFolder = folderId
      ? { id: folderId, name: folderName || "Selected Folder", path: folderPath || "/" }
      : null;

    return NextResponse.json({
      connected: isConnected,
      user,
      selectedFolder,
      autoRename,
      hasAzureCreds,
      credentials: {
        clientId: creds.clientId,
        hasSecret: Boolean(creds.clientSecret),
        tenantId: creds.tenantId,
        redirectUri: creds.redirectUri,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to get OneDrive status" },
      { status: 500 }
    );
  }
}
